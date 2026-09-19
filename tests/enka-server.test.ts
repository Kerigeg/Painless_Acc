import { it, expect, vi } from "vitest";
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
      : response(url.includes("loc.json") ? { "zh-cn": {} } : {}),
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
