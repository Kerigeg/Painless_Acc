import {
  AccountGate,
  accountRequest,
  type Account,
} from "./components/AccountGate";
import React, { useEffect, useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import { UidImport } from "./components/UidImport";
import { CharacterCheckups } from "./components/CharacterCheckup";
import { LunarClinic } from "./components/LunarClinic";
import {
  initialStore,
  parseStore,
  storeSchema,
  type Profile,
  type Store,
} from "./domain/model";
import { lunarDiagnoses } from "./domain/lunar";
import { sources } from "./data/sources";
import "./style.css";
const KEY = "teyvat-clinic-v1";
function App({
  account,
  loggedOut,
}: {
  account: Account;
  loggedOut: () => void;
}) {
  const [store, setStore] = useState<Store>(account.store),
    [page, setPage] = useState<"uid" | "lunar">("uid"),
    [error, setError] = useState(""),
    [save, setSave] = useState("已读取账号档案"),
    [loggingOut, setLoggingOut] = useState(false);
  const revision = useRef(account.revision),
    queue = useRef<Promise<unknown>>(Promise.resolve());
  const p = store.profile;
  function persist(next: Store) {
    const work = queue.current
      .catch(() => {})
      .then(async () => {
        storeSchema.parse(next);
        const result = await accountRequest("/api/account/data", {
          method: "PUT",
          headers: { "X-Account-Id": account.user.id },
          body: JSON.stringify({ store: next, revision: revision.current }),
        });
        revision.current = result.revision;
      });
    queue.current = work;
    return work;
  }
  useEffect(() => {
    if (store === account.store) return;
    setSave("正在保存到账号…");
    const timer = setTimeout(() => {
      void persist(store)
        .then(() => setSave("已保存到账号"))
        .catch((e) => {
          setSave("保存失败，请下载备份");
          setError(e.message);
        });
    }, 350);
    return () => clearTimeout(timer);
  }, [store]);
  async function logout() {
    setLoggingOut(true);
    try {
      await persist(store);
      await accountRequest("/api/auth/logout", { method: "POST", body: "{}" });
      loggedOut();
    } catch (e) {
      setError(e instanceof Error ? e.message : "退出失败");
    } finally {
      setLoggingOut(false);
    }
  }
  const update = (patch: Partial<Profile>) =>
    setStore((s) => ({ ...s, profile: { ...s.profile, ...patch } }));
  const go = (next: "uid" | "lunar") => {
    setPage(next);
    window.scrollTo(0, 0);
  };
  function backup() {
    const raw = JSON.stringify(store, null, 2);
    const url = URL.createObjectURL(
      new Blob([raw], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "提瓦特会诊室备份.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function restore(file?: File) {
    if (!file) return;
    try {
      const next = parseStore(await file.text());
      setStore(next);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "无法导入备份");
    }
  }
  return (
    <div className="shell">
      <aside>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            go("uid");
          }}
        >
          <span className="sigil">✧</span>
          <span>
            提瓦特会诊室<small>角 色 配 置 体 检</small>
          </span>
        </a>
        <nav aria-label="主要功能">
          <button
            className={page === "uid" ? "active" : ""}
            onClick={() => go("uid")}
          >
            UID 导入与分析
          </button>
          <button
            className={page === "lunar" ? "active" : ""}
            onClick={() => go("lunar")}
          >
            ☾ 月感电专题
          </button>
        </nav>
        <div className="sidebar-bottom">
          <p>导入配置，看清下一步。</p>
          <small>公开展柜 · 无需游戏密码</small>
        </div>
      </aside>
      <main>
        <div className="topbar">
          <span>{page === "uid" ? "UID 导入与分析" : "月感电专题"}</span>
          <span role="status">{save}</span>
          <span>
            {account.user.username}{" "}
            <button disabled={loggingOut} onClick={() => void logout()}>
              {loggingOut ? "正在保存并退出…" : "退出登录"}
            </button>
          </span>
        </div>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {page === "uid" ? (
          <>
            <div className="heading">
              <div>
                <p className="eyebrow">YOUR CHARACTERS</p>
                <h1>导入角色，直接看分析。</h1>
                <p className="muted">
                  等级、武器、圣遗物和队伍，先看最值得调整的一项。
                </p>
              </div>
            </div>
            <UidImport
              profile={p}
              onApply={(profile, uid) => {
                const next = parseStore(
                  JSON.stringify({
                    ...store,
                    profile,
                    imports: [
                      ...store.imports,
                      {
                        at: new Date().toISOString(),
                        uid,
                        before: structuredClone(p),
                        after: structuredClone(profile),
                      },
                    ],
                  }),
                );
                setStore(next);
                setError("");
              }}
            />
            {p.characters.length ? (
              <>
                <section className="card">
                  <label className="field">
                    本次检查的玩法
                    <select
                      value={p.focus}
                      onChange={(e) =>
                        update({ focus: e.target.value as Profile["focus"] })
                      }
                    >
                      <option>通用</option>
                      <option>月感电</option>
                    </select>
                  </label>
                  <details>
                    <summary>实际使用队伍（可选，最多四人）</summary>
                    <p className="muted">
                      只勾选你实际一起使用的角色。展柜不会自动算成一队。
                    </p>
                    <div className="chips">
                      {p.characters.map((c) => (
                        <label className="button" key={c.id}>
                          <input
                            type="checkbox"
                            checked={p.team.includes(c.id)}
                            disabled={
                              !p.team.includes(c.id) && p.team.length >= 4
                            }
                            onChange={() =>
                              update({
                                team: p.team.includes(c.id)
                                  ? p.team.filter((id) => id !== c.id)
                                  : [...p.team, c.id],
                              })
                            }
                          />
                          {c.name}
                        </label>
                      ))}
                    </div>
                  </details>
                </section>
                <CharacterCheckups p={p} />
                <p className="muted">
                  游戏内调整后，等待 UID
                  刷新倒计时结束，再次读取并合并即可更新分析。
                </p>
              </>
            ) : (
              <section className="card">
                <h2>先导入你的公开角色展柜</h2>
                <p>上方输入 UID，确认要导入的角色即可。无需填写问卷。</p>
              </section>
            )}
          </>
        ) : (
          <>
            <LunarClinic
              p={p}
              update={update}
              diagnose={() =>
                document
                  .getElementById("lunar-results")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
              profile={() => go("uid")}
            />
            <section id="lunar-results">
              <h2>当前队伍 · 月感电分析</h2>
              {p.focus === "月感电" ? (
                lunarDiagnoses(p).map((d) => (
                  <article className="card" key={d.id}>
                    <h3>{d.title}</h3>
                    <p>{d.action}</p>
                    <details>
                      <summary>原因与适用范围</summary>
                      <p>{d.evidence}</p>
                      <p>{d.teaching}</p>
                      <a
                        href={sources[d.source].url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {sources[d.source].name} · {sources[d.source].version}
                      </a>
                    </details>
                  </article>
                ))
              ) : (
                <p>点击上方“启用专项并查看分析”，按当前队伍检查。</p>
              )}
            </section>
          </>
        )}
        <details className="card">
          <summary>本地备份</summary>
          {localStorage.getItem(KEY) && (
            <button
              onClick={() => {
                try {
                  const old = parseStore(localStorage.getItem(KEY)!);
                  if (store.profile.characters.length) {
                    setError(
                      "当前账号已有角色，请下载旧备份后按需恢复，避免覆盖。",
                    );
                    return;
                  }
                  setStore(old);
                  setError("");
                } catch {
                  setError("旧本地档案格式异常，无法迁移；原数据仍保留。");
                }
              }}
            >
              将此浏览器的旧档案迁入当前账号
            </button>
          )}
          <p className="muted">
            保留原有档案。导入备份会替换本机数据，建议先下载当前备份。
          </p>
          <div className="data-actions">
            <button onClick={backup}>下载备份</button>
            <label className="button">
              恢复备份
              <input
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(e) => {
                  void restore(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </details>
        <footer>提瓦特会诊室 · 非官方玩家工具 · 仅分析已读取配置</footer>
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <AccountGate>
    {(account, done) => (
      <App key={account.user.id} account={account} loggedOut={done} />
    )}
  </AccountGate>,
);
