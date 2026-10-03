import { it, expect } from "vitest";
import { Readable } from "node:stream";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createAccounts } from "../server/accounts.mjs";
import { initialStore } from "../src/domain/model";
async function request(
  api: any,
  path: string,
  method = "GET",
  body: any = undefined,
  cookie = "",
  extra: any = {},
) {
  const req: any = Readable.from(
    body === undefined ? [] : [Buffer.from(JSON.stringify(body))],
  );
  Object.assign(req, {
    url: path,
    method,
    headers: {
      host: "localhost",
      origin: "http://localhost",
      "content-type": "application/json",
      cookie,
      ...extra,
    },
    socket: { remoteAddress: "test" },
  });
  const headers: any = {};
  let status = 200,
    payload = "";
  const res: any = {
    setHeader: (k: string, v: any) => (headers[k] = v),
    writeHead: (s: number) => (status = s),
    end: (v: string) => (payload = v),
  };
  await api.handler(req, res);
  return {
    status,
    body: payload ? JSON.parse(payload) : null,
    cookie: headers["Set-Cookie"]?.split(";")[0],
    headers,
  };
}
const credentials = { username: "test_user", password: "test_password_123" };
it("register/login/logout, protected APIs and session invalidation", async () => {
  const api = createAccounts({ path: ":memory:" });
  try {
    expect((await request(api, "/api/showcase")).status).toBe(401);
    const a = await request(api, "/api/auth/register", "POST", credentials);
    expect(a.status).toBe(200);
    expect(a.headers["Set-Cookie"]).toContain("HttpOnly");
    expect(a.headers["Set-Cookie"]).toContain("SameSite=Strict");
    expect(
      (await request(api, "/api/auth/me", "GET", undefined, a.cookie)).body.user
        .username,
    ).toBe("test_user");
    expect(
      (await request(api, "/api/auth/register", "POST", credentials)).status,
    ).toBe(409);
    expect(
      (
        await request(api, "/api/auth/login", "POST", {
          ...credentials,
          password: "wrong_password_123",
        })
      ).status,
    ).toBe(401);
    expect(
      (await request(api, "/api/auth/logout", "POST", {}, a.cookie)).status,
    ).toBe(200);
    expect(
      (await request(api, "/api/account/data", "GET", undefined, a.cookie))
        .status,
    ).toBe(401);
    const login = await request(api, "/api/auth/login", "POST", credentials);
    expect(login.status).toBe(200);
    expect(login.cookie).not.toBe(a.cookie);
  } finally {
    api.close();
  }
});
it("isolates user archives, validates schema and blocks stale versions and account switches", async () => {
  const api = createAccounts({ path: ":memory:" });
  try {
    const a = await request(api, "/api/auth/register", "POST", credentials);
    const b = await request(api, "/api/auth/register", "POST", {
      ...credentials,
      username: "other_user",
    });
    const h = { "x-account-id": a.body.user.id };
    const state = initialStore();
    state.profile.difficulty = "private A";
    expect(
      (
        await request(
          api,
          "/api/account/data",
          "PUT",
          { store: state, revision: 0 },
          a.cookie,
          h,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await request(api, "/api/account/data", "GET", undefined, b.cookie, {
          "x-account-id": b.body.user.id,
        })
      ).body.store,
    ).toBeNull();
    expect(
      (await request(api, "/api/account/data", "GET", undefined, b.cookie, h))
        .status,
    ).toBe(409);
    expect(
      (
        await request(
          api,
          "/api/account/data",
          "PUT",
          { store: state, revision: 0 },
          a.cookie,
          h,
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await request(
          api,
          "/api/account/data",
          "PUT",
          { store: {}, revision: 1 },
          a.cookie,
          h,
        )
      ).status,
    ).toBe(400);
    expect(
      (await request(api, "/api/account/data", "GET", undefined, a.cookie, h))
        .body.store.profile.difficulty,
    ).toBe("private A");
  } finally {
    api.close();
  }
});
it("rejects cross-origin mutations, invalid credentials and limits repeated attempts", async () => {
  const api = createAccounts({ path: ":memory:" });
  try {
    expect(
      (
        await request(api, "/api/auth/register", "POST", credentials, "", {
          origin: "https://evil.example",
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(api, "/api/auth/register", "POST", {
          username: "a",
          password: "123",
        })
      ).status,
    ).toBe(400);
    for (let i = 0; i < 10; i++)
      await request(api, "/api/auth/login", "POST", credentials);
    expect(
      (await request(api, "/api/auth/login", "POST", credentials)).status,
    ).toBe(429);
  } finally {
    api.close();
  }
});
it("persists hashed credentials, restores sessions after restart and expires them", async () => {
  const dir = mkdtempSync(join(tmpdir(), "clinic-auth-"));
  const path = join(dir, "auth.sqlite");
  let now = 10000;
  let api = createAccounts({ path, clock: () => now });
  try {
    const a = await request(api, "/api/auth/register", "POST", credentials);
    api.close();
    const db = new DatabaseSync(path);
    const row = db.prepare("SELECT * FROM users").get()!;
    expect(row.hash).not.toBe(credentials.password);
    expect(String(row.hash)).toHaveLength(128);
    expect(String(row.salt)).toHaveLength(32);
    db.close();
    api = createAccounts({ path, clock: () => now });
    expect(
      (await request(api, "/api/auth/me", "GET", undefined, a.cookie)).body.user
        .username,
    ).toBe(credentials.username);
    now += 8 * 86400000;
    expect(
      (await request(api, "/api/auth/me", "GET", undefined, a.cookie)).body
        .user,
    ).toBeNull();
  } finally {
    api.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
