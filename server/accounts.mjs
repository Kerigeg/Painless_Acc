import { DatabaseSync } from "node:sqlite";
import {
  randomBytes,
  randomUUID,
  createHash,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { mkdirSync, chmodSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { storeSchema } from "../src/domain/model.ts";
const derive = promisify(scrypt);
const digest = (value) => createHash("sha256").update(value).digest("hex");
const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
const DAY = 86400000;
export function createAccounts({
  path = process.env.ACCOUNT_DB ?? resolve("data/accounts.sqlite"),
  clock = Date.now,
  origin = process.env.APP_ORIGIN,
  secure = process.env.COOKIE_SECURE === "true",
} = {}) {
  if (path !== ":memory:")
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  if (path !== ":memory:") chmodSync(path, 0o600);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, salt TEXT NOT NULL, hash TEXT NOT NULL, created INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS archives(user_id TEXT PRIMARY KEY REFERENCES users(id), body TEXT NOT NULL, revision INTEGER NOT NULL);`);
  const limits = new Map();
  let hashing = 0;
  function throttle(key, max) {
    const now = clock();
    for (const [k, v] of limits) if (v.until <= now) limits.delete(k);
    if (limits.size > 10000) fail(429, "请求过多，请稍后重试");
    const v = limits.get(key) ?? { count: 0, until: now + 15 * 60 * 1000 };
    v.count++;
    limits.set(key, v);
    if (v.count > max) fail(429, "尝试过多，请 15 分钟后重试");
  }
  async function hash(password, salt) {
    if (hashing >= 4) fail(503, "登录服务繁忙，请稍后重试");
    hashing++;
    try {
      return await derive(password, salt, 64, {
        N: 32768,
        r: 8,
        p: 3,
        maxmem: 64 * 1024 * 1024,
      });
    } finally {
      hashing--;
    }
  }
  function token(req) {
    return (
      (req.headers.cookie ?? "")
        .split(";")
        .map((x) => x.trim())
        .find((x) => x.startsWith("clinic_session="))
        ?.slice(15) ?? ""
    );
  }
  function user(req) {
    const t = token(req);
    if (!/^[a-f0-9]{64}$/.test(t)) return null;
    return (
      db
        .prepare(
          "SELECT u.id,u.username FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>?",
        )
        .get(digest(t), clock()) ?? null
    );
  }
  function cookie(res, t, age = 7 * 86400) {
    res.setHeader(
      "Set-Cookie",
      `clinic_session=${t}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${secure ? "; Secure" : ""}`,
    );
  }
  function session(req, res, u) {
    db.prepare("DELETE FROM sessions WHERE expires<=? OR token=?").run(
      clock(),
      digest(token(req)),
    );
    const t = randomBytes(32).toString("hex");
    db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
      digest(t),
      u.id,
      clock() + 7 * DAY,
    );
    cookie(res, t);
  }
  async function body(req, max) {
    let size = 0;
    const chunks = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > max) fail(413, "数据过大");
      chunks.push(chunk);
    }
    try {
      return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      fail(400, "JSON 格式不正确");
    }
  }
  function send(res, status, value) {
    res.writeHead(status);
    res.end(JSON.stringify(value));
  }
  async function handler(req, res, next) {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (!url.pathname.startsWith("/api/")) {
      if (next) return next();
      return false;
    }
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    try {
      if (!["GET", "HEAD"].includes(req.method)) {
        const expected =
          origin ??
          `${req.socket.encrypted ? "https" : "http"}://${req.headers.host}`;
        if (
          req.headers.origin !== expected ||
          req.headers["sec-fetch-site"] === "cross-site"
        )
          fail(403, "请求来源不正确，请从本站操作");
        if (!req.headers["content-type"]?.startsWith("application/json"))
          fail(415, "请使用 JSON 请求");
      }
      const route = url.pathname;
      if (["/api/auth/register", "/api/auth/login"].includes(route)) {
        if (req.method !== "POST") fail(405, "仅支持 POST");
        throttle(`ip:${req.socket.remoteAddress}`, 60);
        const input = await body(req, 4096);
        const username =
          typeof input?.username === "string"
            ? input.username.normalize("NFKC").trim().toLowerCase()
            : "";
        if (
          !/^[\p{L}\p{N}_-]{3,32}$/u.test(username) ||
          typeof input?.password !== "string" ||
          input.password.length < 10 ||
          input.password.length > 128
        )
          fail(
            400,
            "用户名需 3—32 个字母、汉字、数字、下划线或短横线；密码需 10—128 个字符",
          );
        throttle(`name:${username}`, 10);
        let u = db
          .prepare("SELECT * FROM users WHERE username=?")
          .get(username);
        if (route.endsWith("register")) {
          if (u) fail(409, "用户名已被使用");
          const salt = randomBytes(16).toString("hex");
          const hashed = await hash(input.password, salt);
          u = { id: randomUUID(), username };
          try {
            db.prepare("INSERT INTO users VALUES(?,?,?,?,?)").run(
              u.id,
              username,
              salt,
              hashed.toString("hex"),
              clock(),
            );
          } catch (e) {
            if (e.code?.includes("CONSTRAINT") || e.message?.includes("UNIQUE"))
              fail(409, "用户名已被使用");
            throw e;
          }
        } else {
          const computed = await hash(
            input.password,
            u?.salt ?? "00000000000000000000000000000000",
          );
          if (!u || !timingSafeEqual(computed, Buffer.from(u.hash, "hex")))
            fail(401, "用户名或密码不正确");
        }
        session(req, res, u);
        send(res, 200, { user: { id: u.id, username: u.username } });
        return true;
      }
      const u = user(req);
      if (route === "/api/auth/me") {
        if (req.method !== "GET") fail(405, "仅支持 GET");
        send(res, 200, { user: u });
        return true;
      }
      if (!u) fail(401, "请先登录");
      if (route === "/api/auth/logout") {
        if (req.method !== "POST") fail(405, "仅支持 POST");
        db.prepare("DELETE FROM sessions WHERE token=?").run(
          digest(token(req)),
        );
        cookie(res, "", 0);
        send(res, 200, { ok: true });
        return true;
      }
      if (route === "/api/account/data") {
        if (req.headers["x-account-id"] !== u.id)
          fail(409, "登录账号已变化，请刷新后重试");
        const archive = db
          .prepare("SELECT body,revision FROM archives WHERE user_id=?")
          .get(u.id);
        if (req.method === "GET") {
          send(res, 200, {
            store: archive ? JSON.parse(archive.body) : null,
            revision: archive?.revision ?? 0,
          });
          return true;
        }
        if (req.method !== "PUT") fail(405, "仅支持 GET / PUT");
        const input = await body(req, 5_000_000);
        const valid = storeSchema.safeParse(input?.store);
        if (
          !valid.success ||
          !Number.isSafeInteger(input?.revision) ||
          input.revision < 0
        )
          fail(400, "档案格式不正确，未保存");
        const serialized = JSON.stringify(valid.data);
        if (archive) {
          const result = db
            .prepare(
              "UPDATE archives SET body=?,revision=revision+1 WHERE user_id=? AND revision=?",
            )
            .run(serialized, u.id, input.revision);
          if (!result.changes)
            fail(409, "另一页面已更新档案，请先下载当前备份，再刷新");
        } else {
          if (input.revision !== 0) fail(409, "档案版本变化，请刷新");
          try {
            db.prepare("INSERT INTO archives VALUES(?,?,1)").run(
              u.id,
              serialized,
            );
          } catch {
            fail(409, "另一页面已更新档案，请刷新");
          }
        }
        send(res, 200, { revision: input.revision + 1 });
        return true;
      }
      if (route === "/api/showcase") {
        if (next) {
          next();
          return true;
        }
        return false;
      }
      fail(404, "接口不存在");
    } catch (e) {
      const status = e.status ?? 500;
      if (status === 429) res.setHeader("Retry-After", "900");
      send(res, status, {
        error: status === 500 ? "服务器暂时无法完成操作" : e.message,
      });
      return true;
    }
  }
  return { handler, close: () => db.close() };
}
