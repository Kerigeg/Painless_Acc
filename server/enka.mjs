const CHARACTER_URL =
  "https://raw.githubusercontent.com/EnkaNetwork/API-docs/master/store/characters.json";
const LOCALE_URL =
  "https://raw.githubusercontent.com/EnkaNetwork/API-docs/master/store/loc.json";
export const UID_PATTERN = /^[1-9]\d{8,9}$/;
const messages = {
  400: "UID 格式不正确",
  404: "未找到该 UID，请核对区服和数字",
  424: "游戏维护或版本更新，暂时无法读取",
  429: "查询过于频繁，请稍后再试",
  500: "展柜服务暂时异常",
  502: "展柜服务返回了无法识别的数据",
  503: "展柜服务暂不可用",
  504: "请求超时，请稍后重试",
};
export function createEnkaService(fetcher = fetch, clock = Date.now) {
  const cache = new Map(),
    pending = new Map();
  let assets,
    assetsAt = 0,
    assetPromise,
    blockedUntil = 0,
    lastRequest = -Infinity;
  async function json(url) {
    const r = await fetcher(url, {
      headers: {
        "User-Agent":
          "TeyvatClinic/0.2 (+https://github.com/Kerigeg/Painless_Acc)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) {
      const error = new Error(messages[r.status] ?? "外部服务暂不可用");
      error.status = r.status;
      error.retryAfter = Math.min(
        3600,
        Math.max(10, Number(r.headers.get("retry-after")) || 30),
      );
      throw error;
    }
    return r.json();
  }
  async function metadata() {
    if (assets && clock() - assetsAt < 86400000) return assets;
    if (!assetPromise)
      assetPromise = Promise.all([json(CHARACTER_URL), json(LOCALE_URL)])
        .then(([characters, locales]) => {
          assets = { characters, names: locales["zh-cn"] ?? {} };
          assetsAt = clock();
          return assets;
        })
        .finally(() => (assetPromise = undefined));
    return assetPromise;
  }
  async function load(uid) {
    if (!UID_PATTERN.test(uid)) {
      const e = new Error(messages[400]);
      e.status = 400;
      throw e;
    }
    const now = clock();
    const saved = cache.get(uid);
    if (saved && saved.expires > now)
      return {
        ...saved.data,
        ttl: Math.ceil((saved.expires - now) / 1000),
        cached: true,
      };
    if (pending.has(uid)) return pending.get(uid);
    if (now < blockedUntil || now - lastRequest < 2000) {
      const e = new Error(messages[429]);
      e.status = 429;
      e.retryAfter = Math.max(2, Math.ceil((blockedUntil - now) / 1000));
      throw e;
    }
    lastRequest = now;
    const request = (async () => {
      try {
        const raw = await json(`https://enka.network/api/uid/${uid}/`);
        if (
          !raw ||
          typeof raw !== "object" ||
          !raw.playerInfo ||
          typeof raw.playerInfo !== "object"
        )
          throw Object.assign(new Error(messages[502]), { status: 502 });
        let meta;
        let warning = "";
        try {
          meta = await metadata();
        } catch {
          meta = { characters: {}, names: {} };
          warning = "名称与天赋映射暂不可用，未知字段不会补成零；可稍后重试。";
        }
        const avatars = Array.isArray(raw.avatarInfoList)
          ? raw.avatarInfoList.slice(0, 30)
          : [];
        const characters = {},
          names = {};
        for (const avatar of avatars) {
          const id = String(avatar.avatarId);
          const key = `${id}-${avatar.skillDepotId}`;
          const data = meta.characters[key] ?? meta.characters[id];
          if (data) {
            characters[key] = data;
            const hash = data.NameTextMapHash;
            if (meta.names[hash]) names[hash] = meta.names[hash];
          }
          for (const equip of avatar.equipList ?? []) {
            for (const hash of [
              equip.flat?.nameTextMapHash ?? equip.flat?.nameTextHashMap,
              equip.flat?.setNameTextMapHash ?? equip.flat?.setNameTextHashMap,
            ])
              if (meta.names[hash]) names[hash] = meta.names[hash];
          }
        }
        const ttl = Number.isFinite(raw.ttl)
          ? Math.min(86400, Math.max(1, Math.ceil(raw.ttl)))
          : 60;
        const data = {
          uid,
          fetchedAt: new Date(clock()).toISOString(),
          ttl,
          cached: false,
          warning,
          playerInfo: {
            nickname: raw.playerInfo.nickname,
            level: raw.playerInfo.level,
            worldLevel: raw.playerInfo.worldLevel,
          },
          avatarInfoList: avatars,
          characters,
          names,
        };
        if (cache.size >= 100) {
          const oldest = cache.keys().next().value;
          clearTimeout(cache.get(oldest)?.timer);
          cache.delete(oldest);
        }
        clearTimeout(cache.get(uid)?.timer);
        const entry = { data, expires: clock() + ttl * 1000, timer: undefined };
        entry.timer = setTimeout(() => {
          if (cache.get(uid) === entry) cache.delete(uid);
        }, ttl * 1000);
        entry.timer.unref?.();
        cache.set(uid, entry);
        return data;
      } catch (e) {
        if (e.status === 429)
          blockedUntil = clock() + (e.retryAfter ?? 30) * 1000;
        throw e;
      } finally {
        pending.delete(uid);
      }
    })();
    pending.set(uid, request);
    return request;
  }
  return { load };
}
export function createEnkaHandler(service = createEnkaService()) {
  return async function (req, res, next) {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname !== "/api/showcase") {
      if (next) return next();
      return false;
    }
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (req.method !== "GET") {
      res.writeHead(405);
      res.end(JSON.stringify({ error: "仅支持 GET 查询" }));
      return true;
    }
    try {
      const data = await service.load(url.searchParams.get("uid") ?? "");
      res.writeHead(200);
      res.end(JSON.stringify(data));
    } catch (e) {
      const status =
        e.name === "TimeoutError" || e.name === "AbortError"
          ? 504
          : [400, 404, 424, 429, 500, 502, 503].includes(e.status)
            ? e.status
            : 502;
      if (e.retryAfter) res.setHeader("Retry-After", String(e.retryAfter));
      res.writeHead(status);
      res.end(
        JSON.stringify({
          error: messages[status],
          retryAfter: e.retryAfter ?? null,
        }),
      );
    }
    return true;
  };
}
