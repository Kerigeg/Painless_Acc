import { useEffect, useRef, useState } from "react";
import type { Profile } from "../domain/model";
import {
  convertShowcase,
  mergeShowcase,
  type Showcase,
} from "../domain/showcase";
export function UidImport({
  profile,
  onApply,
}: {
  profile: Profile;
  onApply: (p: Profile, uid: string) => void;
}) {
  const [uid, setUid] = useState(profile.showcase?.uid ?? ""),
    [data, setData] = useState<Showcase | null>(null),
    [selected, setSelected] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [cooldown, setCooldown] = useState({ uid: "", until: 0 }),
    [now, setNow] = useState(Date.now());
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(timer);
      request.current?.abort();
    };
  }, []);
  const remaining =
    cooldown.uid === uid
      ? Math.max(0, Math.ceil((cooldown.until - now) / 1000))
      : 0;
  async function query() {
    if (!/^[1-9]\d{8,9}$/.test(uid)) {
      setError("请输入9或10位数字 UID，不需要密码或验证码");
      return;
    }
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const requestedUid = uid;
    setBusy(true);
    setError("");
    setNotice("");
    setData(null);
    setSelected([]);
    try {
      const response = await fetch(
        `/api/showcase?uid=${encodeURIComponent(requestedUid)}`,
        { signal: controller.signal },
      );
      const raw = await response.json();
      if (!response.ok) {
        const retry =
          Number(response.headers.get("retry-after")) || raw.retryAfter;
        if (retry)
          setCooldown({ uid: requestedUid, until: Date.now() + retry * 1000 });
        throw Error(raw.error ?? "读取失败，请稍后再试");
      }
      const preview = convertShowcase(raw);
      if (controller.signal.aborted) return;
      if (preview.uid !== requestedUid)
        throw Error("返回 UID 不一致，已停止导入");
      setData(preview);
      setSelected(preview.characters.map((c) => c.id));
      setCooldown({
        uid: requestedUid,
        until: Date.now() + preview.ttl * 1000,
      });
    } catch (e) {
      if (!controller.signal.aborted)
        setError(e instanceof Error ? e.message : "网络请求失败");
    } finally {
      if (request.current === controller) setBusy(false);
    }
  }
  return (
    <section className="card uid-import">
      <div className="card-top">
        <div>
          <p className="eyebrow">PUBLIC SHOWCASE / 公开角色展柜</p>
          <h2>用 UID 导入角色配置</h2>
        </div>
        <span className="pill">Enka.Network</span>
      </div>
      <p>
        只读取你公开展示的角色、武器和圣遗物，不代表整个账号。请在游戏个人资料的角色展柜开启“显示角色详情”，更新后等待缓存刷新。
      </p>
      <div className="inline">
        <label className="field">
          <span>游戏 UID</span>
          <input
            inputMode="numeric"
            autoComplete="off"
            value={uid}
            placeholder="9或10位数字"
            maxLength={10}
            onChange={(e) => {
              request.current?.abort();
              request.current = null;
              setBusy(false);
              setUid(e.target.value.trim());
              setData(null);
              setError("");
              setNotice("");
            }}
          />
        </label>
        <button
          className="primary"
          disabled={busy || remaining > 0}
          onClick={() => void query()}
        >
          {busy
            ? "正在读取…"
            : remaining > 0
              ? `${remaining} 秒后可刷新`
              : "读取公开展柜"}
        </button>
      </div>
      <small className="muted">
        点击读取会将 UID 发送给
        Enka；本站不索取游戏登录凭据。服务器仅按缓存期限临时保留查询。
      </small>
      {busy && <p role="status">正在读取公开配置与名称资料，请稍候…</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="hint" role="status">
          {notice}
        </p>
      )}
      {data && (
        <div className="import-preview">
          <h3>导入预览 · {data.nickname}</h3>
          <p>
            UID {data.uid} · 冒险等阶 {data.ar ?? "未知"} · 世界等级{" "}
            {data.world ?? "未知"} · {data.cached ? "服务端缓存" : "本次读取"} ·{" "}
            {new Date(data.at).toLocaleString("zh-CN")}
            （本站读取时间，并非游戏内更新时间）
          </p>
          {!data.characters.length ? (
            <p className="warning" role="status">
              未读取到公开角色详情。可能未开启显示详情、展柜为空或资料尚未刷新；没有导入任何角色，也不会清空现有档案。
            </p>
          ) : (
            <>
              <p className="hint">
                选择要合并的角色。同名角色的公开配置会更新；队伍、目标、可用状态和历史保留。未知天赋不补成0。面板标记为“展柜快照（增益未知）”。
              </p>
              {data.characters.map((c) => (
                <details key={c.id} className="import-character" open>
                  <summary>
                    {c.name} · 等级 {c.level ?? "未知"}
                  </summary>
                  <label>
                    <input
                      type="checkbox"
                      checked={selected.includes(c.id)}
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? [...selected, c.id]
                            : selected.filter((id) => id !== c.id),
                        )
                      }
                    />
                    导入 {c.name}
                    {profile.characters.some((x) => x.name === c.name)
                      ? "（更新同名角色）"
                      : "（新增，是否可用待确认）"}
                  </label>
                  <p>
                    突破 {c.ascension ?? "未知"} · 命座{" "}
                    {c.constellation ?? "未知"} · 普攻／战技／爆发：
                    {c.talents.map((n) => n ?? "未知").join(" / ")}
                    （含接口提供的额外等级）
                  </p>
                  <p>
                    武器：{c.weapon.name || "未知"} · 等级{" "}
                    {c.weapon.level ?? "未知"} · 精炼{" "}
                    {c.weapon.refinement ?? "未知"}
                  </p>
                  <p>
                    面板：生命 {c.panel.hp?.toFixed(0) ?? "未知"} / 攻击{" "}
                    {c.panel.atk?.toFixed(0) ?? "未知"} / 精通{" "}
                    {c.panel.em?.toFixed(0) ?? "未知"} / 充能{" "}
                    {c.panel.er ?? "未知"}%
                  </p>
                  <ul>
                    {data.artifacts
                      .filter((a) => a.owner === c.id)
                      .map((a) => (
                        <li key={a.id}>
                          {a.slot} +{a.level ?? "?"} · {a.set || "未知套装"} ·{" "}
                          {a.main ?? "未知主词条"} {a.mainValue ?? ""} ·{" "}
                          {a.subs.length}条副词条
                        </li>
                      ))}
                  </ul>
                </details>
              ))}
              <button
                className="primary"
                disabled={!selected.length}
                onClick={() => {
                  try {
                    onApply(mergeShowcase(profile, data, selected), data.uid);
                    setNotice(
                      `已合并 ${selected.length} 位角色，导入前后快照已保留。`,
                    );
                    setData(null);
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "合并失败");
                  }
                }}
              >
                合并选中的 {selected.length} 位角色
              </button>
            </>
          )}
          {data.warnings.length > 0 && (
            <details open>
              <summary>需要补充的信息</summary>
              <ul>
                {data.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
      <p className="source">
        <a
          href="https://github.com/EnkaNetwork/API-docs/blob/master/api.md"
          target="_blank"
          rel="noreferrer"
        >
          Enka 原始 API 文档 ↗
        </a>{" "}
        · 仅公开展柜，无法读取背包、地区解锁或完整角色名单。
      </p>
    </section>
  );
}
