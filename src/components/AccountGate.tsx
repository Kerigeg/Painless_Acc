import { useEffect, useState, type ReactNode } from "react";
import { initialStore, parseStore, type Store } from "../domain/model";
export type Account = {
  user: { id: string; username: string };
  store: Store;
  revision: number;
};
export async function accountRequest(path: string, options: RequestInit = {}) {
  const r = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const data = await r.json();
  if (!r.ok) throw Error(data.error ?? "请求失败");
  return data;
}
export function AccountGate({
  children,
}: {
  children: (account: Account, done: () => void) => ReactNode;
}) {
  const [account, setAccount] = useState<Account | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [register, setRegister] = useState(false),
    [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    setLoading(true);
    setError("");
    try {
      const { user } = await accountRequest("/api/auth/me");
      if (!user) {
        setAccount(null);
        return;
      }
      const data = await accountRequest("/api/account/data", {
        headers: { "X-Account-Id": user.id },
      });
      const store = data.store
        ? parseStore(JSON.stringify(data.store))
        : initialStore();
      let revision = data.revision;
      // Persist a migrated archive with the same optimistic concurrency check
      // as ordinary edits. Never clear the account to refresh display names.
      if (data.store && JSON.stringify(store) !== JSON.stringify(data.store)) {
        const saved = await accountRequest("/api/account/data", {
          method: "PUT",
          headers: { "X-Account-Id": user.id },
          body: JSON.stringify({ store, revision }),
        });
        revision = saved.revision;
      }
      setAccount({ user, store, revision });
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  if (account)
    return children(account, () => {
      setAccount(null);
      setPassword("");
      setConfirm("");
      setError("");
    });
  return (
    <main className="auth-shell">
      <section className="card auth-card">
        <p className="eyebrow">提瓦特会诊室</p>
        <h1>
          {loading ? "正在读取账号…" : register ? "创建你的账号" : "欢迎回来"}
        </h1>
        <p className="muted">
          登录后导入
          UID，分析结果和角色档案随账号保存。这是本站账号，不需要游戏密码。
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
            <button type="button" onClick={() => void load()}>
              重新连接
            </button>
          </p>
        )}
        {!loading && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setError("");
              if (register && password !== confirm) {
                setError("两次密码不一致");
                return;
              }
              setBusy(true);
              try {
                await accountRequest(
                  register ? "/api/auth/register" : "/api/auth/login",
                  {
                    method: "POST",
                    body: JSON.stringify({ username, password }),
                  },
                );
                setPassword("");
                setConfirm("");
                await load();
              } catch (e) {
                setError(e instanceof Error ? e.message : "操作失败");
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="field">
              用户名
              <input
                required
                minLength={3}
                maxLength={32}
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={busy}
              />
            </label>
            <p className="muted">
              3—32 个汉字、字母、数字、下划线或短横线；英文字母不区分大小写。
            </p>
            <label className="field">
              密码
              <input
                type="password"
                required
                minLength={10}
                maxLength={128}
                autoComplete={register ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
              />
            </label>
            {register && (
              <>
                <p className="muted">
                  10—128 个字符，请妥善保管；暂不提供密码找回。
                </p>
                <label className="field">
                  确认密码
                  <input
                    type="password"
                    required
                    minLength={10}
                    maxLength={128}
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    disabled={busy}
                  />
                </label>
              </>
            )}
            <button className="primary" disabled={busy} type="submit">
              {busy ? "正在处理…" : register ? "注册并登录" : "登录"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setRegister(!register);
                setError("");
                setPassword("");
                setConfirm("");
              }}
            >
              {register ? "已有账号，去登录" : "没有账号，去注册"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
