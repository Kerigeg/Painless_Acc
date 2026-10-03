import { it, expect, vi } from "vitest";
import { convertShowcase } from "../src/domain/showcase";
import { createEnkaService } from "../server/enka.mjs";
const response = (body: unknown, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
it("server honors TTL and coalesces UID requests; never enumerates", async () => {
  let time = 10000;
  const fetcher = vi.fn(async (url: string) =>
    url.includes("/api/uid/")
      ? response({ playerInfo: { level: 50 }, avatarInfoList: [], ttl: 60 })
      : response(url.includes("locs.json") ? { "zh-cn": {} } : {}),
  );
  const service = createEnkaService(fetcher, () => time);
  const [a, b] = await Promise.all([
    service.load("123456789"),
    service.load("123456789"),
  ]);
  expect(a.uid).toBe(b.uid);
  expect(
    fetcher.mock.calls.filter((c) => c[0].includes("/api/uid/")),
  ).toHaveLength(1);
  time += 20000;
  const cached = await service.load("123456789");
  expect(cached.cached).toBe(true);
  expect(cached.ttl).toBe(40);
  time += 41000;
  await service.load("123456789");
  expect(
    fetcher.mock.calls.filter((c) => c[0].includes("/api/uid/")),
  ).toHaveLength(2);
  expect(fetcher.mock.calls[0][0]).toBe(
    "https://enka.network/api/uid/123456789/",
  );
});
it("rejects malformed UID before network and preserves HTTP status", async () => {
  const fetcher = vi.fn(async () => response({}, 404));
  const service = createEnkaService(fetcher);
  await expect(service.load("../../credentials")).rejects.toMatchObject({
    status: 400,
  });
  expect(fetcher).not.toHaveBeenCalled();
  await expect(service.load("123456789")).rejects.toMatchObject({
    status: 404,
  });
});
it("429 cooldown and metadata outage remain explicit", async () => {
  let t = 10000;
  const limited = createEnkaService(
    async () => response({}, 429, { "Retry-After": "60" }),
    () => t,
  );
  await expect(limited.load("123456789")).rejects.toMatchObject({
    status: 429,
  });
  t += 3000;
  await expect(limited.load("987654321")).rejects.toMatchObject({
    status: 429,
  });
  const service = createEnkaService(async (url: string) =>
    url.includes("/api/uid/")
      ? response({ playerInfo: {}, avatarInfoList: [], ttl: 10 })
      : response({}, 503),
  );
  const result = await service.load("123456789");
  expect(result.warning).toContain("映射暂不可用");
  expect(result.avatarInfoList).toEqual([]);
});

// Metadata fields independently checked against Enka store/gi on 2026-09-28.
it("uses current gi assets and maps new character names and talent order", async () => {
  const avatars = {
    "10000148": {
      NameTextMapHash: 2727450010,
      SkillOrder: [11481, 11482, 11485],
      ProudMap: { 11481: 14831, 11482: 14832, 11485: 14839 },
    },
    "10000150": {
      NameTextMapHash: 2417850,
      SkillOrder: [11501, 11502, 11505],
      ProudMap: { 11501: 15031, 11502: 15032, 11505: 15039 },
    },
  };
  const fetcher = vi.fn(async (url: string) => {
    if (url === "https://enka.network/api/uid/123456789/")
      return response({
        playerInfo: {},
        ttl: 60,
        avatarInfoList: [
          {
            avatarId: 10000148,
            skillLevelMap: { 11481: 1, 11482: 6, 11485: 8 },
            proudSkillExtraLevelMap: { 14839: 3 },
          },
          {
            avatarId: 10000150,
            skillLevelMap: { 11501: 1, 11502: 9, 11505: 6 },
          },
        ],
      });
    if (
      url ===
      "https://raw.githubusercontent.com/EnkaNetwork/API-docs/master/store/gi/avatars.json"
    )
      return response(avatars);
    if (
      url ===
      "https://raw.githubusercontent.com/EnkaNetwork/API-docs/master/store/gi/locs.json"
    )
      return response({
        "zh-cn": { "2727450010": "阿罗夏", "2417850": "奥黛塔" },
      });
    throw new Error("Unexpected source: " + url);
  });
  const converted = convertShowcase(
    await createEnkaService(fetcher).load("123456789"),
  );
  expect(converted.characters.map((c) => c.name)).toEqual(["阿罗夏", "奥黛塔"]);
  expect(converted.characters.map((c) => c.talents)).toEqual([
    [1, 6, 11],
    [1, 9, 6],
  ]);
  expect(converted.characters.map((c) => c.level)).toEqual([null, null]);
  expect(converted.warnings.join(" ")).not.toContain("在线名称映射缺失");
  expect(fetcher).toHaveBeenCalledTimes(3);
});
