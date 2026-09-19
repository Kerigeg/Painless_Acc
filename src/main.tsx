import { UidImport } from "./components/UidImport";
import { LunarClinic } from "./components/LunarClinic";
import { guideFor, normalizeName } from "./data/characters";
import { reportedName } from "./data/character-identities";
import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  blank,
  newCharacter,
  initialStore,
  parseStore,
  storeSchema,
  profileSchema,
  artifactSchema,
  slots,
  stats,
  feedbackOptions,
  emptyMetrics,
  type Profile,
  type Character,
  type Artifact,
  type Store,
  type Metrics,
} from "./domain/model";
import { diagnose, type Diagnosis } from "./domain/rules";
import {
  plan,
  blocked,
  completed,
  response,
  compareArtifacts,
  type Task,
} from "./domain/planner";
import {
  sources,
  verified,
  terms,
  symptoms,
  type SourceKey,
} from "./data/sources";
import { example } from "./data/example";
import { crit, resistance, energy } from "./domain/math";
import "./style.css";
const KEY = "teyvat-clinic-v1";
const tabs = [
  "会诊首页",
  "快速问诊",
  "账号档案",
  "诊断与教学",
  "行动计划",
  "反馈与历史",
  "资料与工具",
  "月感电专题",
];
function read() {
  try {
    const raw = localStorage.getItem(KEY);
    return { store: raw ? parseStore(raw) : initialStore(), error: "" };
  } catch (e) {
    return {
      store: initialStore(),
      error: `本地档案读取失败，原数据未覆盖。请先导出备份或导入有效档案。${String(e)}`,
    };
  }
}
const start = read();
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function N({
  label,
  value,
  onChange,
  max = 999999,
  min = 0,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  max?: number;
  min?: number;
}) {
  return (
    <Field label={label}>
      <input
        type="number"
        min={min}
        max={max}
        value={value ?? ""}
        placeholder="不知道"
        onChange={(e) =>
          onChange(e.target.value === "" ? null : Number(e.target.value))
        }
      />
    </Field>
  );
}
function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((v) => (
          <option key={v}>{v}</option>
        ))}
      </select>
    </Field>
  );
}
function Source({ id }: { id: SourceKey }) {
  const s = sources[id];
  return (
    <p className="source">
      <a
        href={s.url}
        target={id === "method" ? undefined : "_blank"}
        rel="noreferrer"
      >
        {s.name} ↗
      </a>{" "}
      · {s.version} · {id === "method" ? "设计规则，非外部事实" : "已核对资料"}{" "}
      {verified}；不代表已验证当前全版本。
    </p>
  );
}
function App() {
  const [store, setStore] = useState<Store>(start.store),
    [page, setPage] = useState(0),
    [step, setStep] = useState(0),
    [error, setError] = useState(start.error),
    [save, setSave] = useState("本地草稿"),
    [protectedData, setProtected] = useState(!!start.error),
    [notice, setNotice] = useState(""),
    [importing, setImporting] = useState(false),
    [selected, setSelected] = useState("baseline"),
    [result, setResult] = useState<Metrics>(emptyMetrics()),
    [feedback, setFeedback] =
      useState<(typeof feedbackOptions)[number]>("完成，有改善");
  const p = store.profile;
  const diagnostics = diagnose(p, store.history),
    tasks = plan(p, store.history);
  const ended = store.history.some(
    (h) =>
      h.feedback === "现在已经够用了" && h.fingerprint === JSON.stringify(p),
  );
  const pending = tasks.filter((t) => !completed(t, store.history));
  useEffect(() => {
    if (protectedData) return;
    const parsed = storeSchema.safeParse(store);
    if (!parsed.success) {
      setSave("有输入错误，尚未保存");
      return;
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(store));
      setSave("草稿已保存到本机");
    } catch {
      setSave("保存失败，请导出备份");
    }
  }, [store, protectedData, p]);
  const update = (patch: Partial<Profile>) =>
    setStore((s) => ({ ...s, profile: { ...s.profile, ...patch } }));
  const changeChar = (c: Character) =>
    update({ characters: p.characters.map((x) => (x.id === c.id ? c : x)) });
  const go = (n: number) => {
    setPage(n);
    setNotice("");
    window.scrollTo(0, 0);
  };
  const valid = profileSchema.safeParse(p);
  const validation = valid.success
    ? ""
    : valid.error.issues
        .map((i) => `${i.path.join(".")}：${i.message}`)
        .slice(0, 5)
        .join("；");
  function exportData() {
    if (!protectedData && !storeSchema.safeParse(store).success) {
      setError("请先修正输入错误，再导出有效档案");
      return;
    }
    const blob = new Blob(
      [
        protectedData
          ? (localStorage.getItem(KEY) ?? "")
          : JSON.stringify(store, null, 2),
      ],
      { type: "application/json" },
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "提瓦特会诊档案.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }
  async function importData(file?: File) {
    if (!file || importing) return;
    setImporting(true);
    setNotice("正在校验并导入档案…");
    try {
      if (file.size > 5_000_000) throw Error("文件超过5 MB");
      const next = parseStore(await file.text());
      setStore(next);
      setProtected(false);
      setError("");
      setNotice("导入完成，档案与历史已恢复");
    } catch (e) {
      setError(`导入失败：${String(e)}`);
      setNotice("");
    } finally {
      setImporting(false);
    }
  }
  function submit() {
    const t = tasks.find((t) => t.id === selected);
    if (!t) return;
    const reasons = blocked(t, tasks, store.history);
    if (
      ["完成，有改善", "现在已经够用了"].includes(feedback) &&
      reasons.length
    ) {
      setError(reasons.join("；"));
      return;
    }
    if (
      t.id === "baseline" &&
      ["完成，有改善", "现在已经够用了"].includes(feedback) &&
      (!store.baseline.scene ||
        Object.entries(store.baseline)
          .filter(([k]) => k !== "scene")
          .every(([, v]) => v === null))
    ) {
      setError("基线需要场景名称和至少一项观察值");
      return;
    }
    try {
      const next = {
        ...store,
        history: [
          ...store.history,
          {
            id: crypto.randomUUID(),
            at: new Date().toISOString(),
            taskId: t.id,
            title: t.title,
            fingerprint: t.fingerprint,
            feedback,
            before:
              store.history.filter((h) => h.taskId === "baseline").at(-1)
                ?.after ?? p,
            after: structuredClone(p),
            baseline: structuredClone(store.baseline),
            result: structuredClone(result),
          },
        ],
      };
      const checked = parseStore(JSON.stringify(next));
      setStore(checked);
      setError("");
      setNotice(response(feedback));
    } catch (e) {
      setError(String(e));
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
            go(0);
          }}
        >
          <span className="sigil">✧</span>
          <span>
            提瓦特会诊室<small>冒 险 诊 疗 手 册</small>
          </span>
        </a>
        <div className="sidebar-label">我的冒险手册</div>
        <nav>
          {tabs.map((t, i) => (
            <button
              key={t}
              className={page === i ? "active" : ""}
              onClick={() => go(i)}
            >
              <span>{["⌂", "＋", "▤", "◇", "☷", "◷", "⌘", "☾"][i]}</span>
              {t}
              {i === 4 && <b>{pending.length}</b>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="tiny-star">✦</span>
          <p>旅途有自己的节奏</p>
          <small>以你想玩的方式，走得更轻松。</small>
          <div className="local">◉ 本机存储 · 无需游戏账号登录</div>
        </div>
      </aside>
      <main>
        <header>
          <span>
            冒险手册 <span className="muted"> / {tabs[page]}</span>
          </span>
          <span className="save">{save}</span>
        </header>
        {p.example && (
          <div className="banner">
            示例账号 · 所有数据仅用于体验，不是你的真实账号。
            <button
              onClick={() => {
                update(blank());
                setStore(initialStore());
              }}
            >
              新建自己的档案
            </button>
          </div>
        )}
        {error && (
          <div className="error" role="alert">
            {error}
            <button onClick={() => setError("")}>关闭提示</button>
          </div>
        )}
        {validation && (
          <div className="error" role="alert">
            {validation}
          </div>
        )}
        {notice && (
          <div className="banner" role="status">
            {notice}
          </div>
        )}
        {page === 7 && (
          <LunarClinic
            p={p}
            update={update}
            diagnose={() => go(3)}
            profile={() => go(2)}
          />
        )}
        {page === 0 && (
          <>
            <div className="heading">
              <div>
                <p className="eyebrow">ADVENTURE CHECK-IN / 冒险会诊</p>
                <h1>下一段旅途，轻松一点。</h1>
                <p className="muted">
                  从一个具体困难开始，找到现在最值得做的小改变。
                </p>
              </div>
              <span className="seal">✧</span>
            </div>
            <div className="focus-strip">
              <div>
                <span className="eyebrow">本期重点 · 月感电</span>
                <strong>砂糖、哥伦比娅、菲林斯、伊涅芙、爱诺、菲谢尔</strong>
                <p>从公开展柜导入配置，检查反应条件与循环。</p>
              </div>
              <div className="focus-actions">
                <button onClick={() => go(2)}>UID 导入配置</button>
                <button className="primary" onClick={() => go(7)}>
                  进入月感电专题 →
                </button>
              </div>
            </div>
            <div className="dashboard">
              <section className="hero">
                <span className="pill">
                  {ended
                    ? "本阶段已结束"
                    : p.symptoms.length
                      ? "当前优先关注"
                      : "你的第一次会诊"}
                </span>
                <h2>
                  {ended
                    ? "已经够用，就继续冒险吧。"
                    : p.symptoms.length
                      ? (diagnostics.find((d) => d.status !== "待补充")
                          ?.title ?? diagnostics[0].title)
                      : "不必先懂配队，也能找到方向。"}
                </h2>
                <p>
                  {ended
                    ? "目标变了、遇到新困难时，再回来调整计划。"
                    : p.symptoms.length
                      ? diagnostics[0].action
                      : "告诉我们想玩什么、哪里不顺手。不了解的数值可以留空，先从零成本的改善开始。"}
                </p>
                <button
                  className="gold"
                  onClick={() => go(p.symptoms.length ? 3 : 1)}
                >
                  {p.symptoms.length ? "查看本次诊断" : "开始快速问诊"}{" "}
                  <span>→</span>
                </button>
                <div className="hero-footer">
                  {p.goal} ·{" "}
                  {p.minutes === null
                    ? "投入时间待填写"
                    : `愿意投入 ${p.minutes} 分钟`}{" "}
                  · 不做账号强度排名
                </div>
              </section>
              <section className="card overview">
                <p className="eyebrow">ACCOUNT NOTES</p>
                <h3>这次冒险的目标</h3>
                <div className="statline">
                  <span>想玩的内容</span>
                  <strong>{p.goal}</strong>
                </div>
                <div className="statline">
                  <span>当前队伍</span>
                  <strong>
                    {p.team.length ? p.team.length + " 位已录入" : "尚未确认"}
                  </strong>
                </div>
                <div className="statline">
                  <span>冒险等阶 / 世界等级</span>
                  <strong>
                    {p.ar ?? "未知"} / {p.world ?? "未知"}
                  </strong>
                </div>
                <button className="text-button" onClick={() => go(2)}>
                  补充账号档案 ↗
                </button>
              </section>
            </div>
            <div className="section-title">
              <h2>
                接下来三件事 <small>按你的节奏来</small>
              </h2>
              <button className="text-button" onClick={() => go(4)}>
                全部行动 →
              </button>
            </div>
            {ended ? (
              <section className="card">本阶段已结束，历史记录已保留。</section>
            ) : (
              <div className="three">
                {(p.symptoms.length
                  ? pending.slice(0, 3)
                  : [
                      {
                        id: "start",
                        title: "告诉我们哪里不顺手",
                        problem: "选择玩法和症状，约一分钟即可开始。",
                      },
                      {
                        id: "info",
                        title: "补充你知道的信息",
                        problem: "角色、装备和操作偏好；未知可以留空。",
                      },
                      {
                        id: "try",
                        title: "试一个小改变",
                        problem: "先看原因，再展开手把手教程。",
                      },
                    ]
                ).map((t, i) => (
                  <button
                    className="action-card"
                    key={t.id}
                    onClick={() => go(p.symptoms.length ? 4 : i === 0 ? 1 : 2)}
                  >
                    <span className="number">0{i + 1}</span>
                    <h3>{t.title}</h3>
                    <p>{t.problem}</p>
                    <span className="action-link">
                      {p.symptoms.length ? "查看任务" : "开始填写"} ↗
                    </span>
                  </button>
                ))}
              </div>
            )}
            <div className="bottom-strip">
              <div>
                <strong>先理解，再投入。</strong>
                <p>
                  每条结论都有依据；疑似问题需要验证，未知信息不会被当作零。
                </p>
              </div>
              <button
                onClick={() => {
                  setStore({ ...initialStore(), profile: example() });
                  setNotice("已加载示例账号");
                }}
                disabled={p.characters.length > 0}
              >
                用示例体验
              </button>
            </div>
          </>
        )}
        {page === 1 && (
          <>
            <Title
              eyebrow="QUICK CONSULTATION"
              title="先说说，你遇到了什么？"
              text="快速问诊只填你知道的。档案随填写保存，不需要密码或登录凭据。"
            />
            <div className="steps">
              {["目标与困难", "冒险进度", "队伍与偏好"].map((s, i) => (
                <button
                  className={step === i ? "current" : ""}
                  onClick={() => setStep(i)}
                  key={s}
                >
                  {i + 1} · {s}
                </button>
              ))}
            </div>
            <section className="card form-card">
              {step === 0 ? (
                <>
                  <Select
                    label="目标玩法"
                    value={p.goal}
                    options={["大世界", "任务", "首领", "限时挑战"]}
                    onChange={(v) => update({ goal: v as Profile["goal"] })}
                  />
                  <Field label="具体卡在哪里？">
                    <textarea
                      value={p.difficulty}
                      onChange={(e) => update({ difficulty: e.target.value })}
                      placeholder="例如：探索时总要停下来回血，不追求极限伤害"
                    />
                  </Field>
                  <p>常见症状（可多选）</p>
                  <div className="chips">
                    {symptoms.map((s) => (
                      <button
                        key={s}
                        aria-pressed={p.symptoms.includes(s)}
                        className={p.symptoms.includes(s) ? "chosen" : ""}
                        onClick={() =>
                          update({
                            symptoms: p.symptoms.includes(s)
                              ? p.symptoms.filter((x) => x !== s)
                              : [...p.symptoms, s],
                          })
                        }
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <div className="grid3">
                    <N
                      label="本阶段可投入时间（分钟）"
                      value={p.minutes}
                      max={1440}
                      onChange={(v) => update({ minutes: v })}
                    />
                    <N
                      label="树脂预算（点）"
                      value={p.resin}
                      max={200}
                      onChange={(v) => update({ resin: v })}
                    />
                    <N
                      label="可用摩拉"
                      value={p.mora}
                      onChange={(v) => update({ mora: v })}
                      max={1e10}
                    />
                  </div>
                </>
              ) : step === 1 ? (
                <>
                  <div className="grid3">
                    <N
                      label="冒险等阶"
                      value={p.ar}
                      max={60}
                      min={1}
                      onChange={(v) => update({ ar: v })}
                    />
                    <N
                      label="世界等级"
                      value={p.world}
                      max={9}
                      onChange={(v) => update({ world: v })}
                    />
                    <Select
                      label="蒙德区域"
                      value={p.mondstadt}
                      options={["未知", "已解锁", "未解锁"]}
                      onChange={(v) =>
                        update({ mondstadt: v as Profile["mondstadt"] })
                      }
                    />
                  </div>
                  <Field label="目前活动地区">
                    <input
                      value={p.region}
                      placeholder="不知道可留空"
                      onChange={(e) => update({ region: e.target.value })}
                    />
                  </Field>
                  <Field label="相关任务、秘境与内容解锁情况">
                    <textarea
                      value={p.unlocks}
                      onChange={(e) => update({ unlocks: e.target.value })}
                    />
                  </Field>
                  <Field label="敌人／任务具体名称">
                    <input
                      value={p.enemy}
                      onChange={(e) => update({ enemy: e.target.value })}
                    />
                  </Field>
                </>
              ) : (
                <>
                  <Roster p={p} update={update} />
                  <div className="grid2">
                    <Select
                      label="设备"
                      value={p.device}
                      options={["未知", "手机", "电脑", "手柄"]}
                      onChange={(v) =>
                        update({ device: v as Profile["device"] })
                      }
                    />
                    <N
                      label="同时正在培养几位角色？"
                      value={p.investing}
                      max={100}
                      onChange={(v) => update({ investing: v })}
                    />
                  </div>
                  <Field label="操作偏好">
                    <input
                      value={p.preference}
                      onChange={(e) => update({ preference: e.target.value })}
                      placeholder="例如：不擅长瞄准，希望少切人"
                    />
                  </Field>
                  <Field label="通常的出手顺序">
                    <textarea
                      value={p.rotation}
                      onChange={(e) => update({ rotation: e.target.value })}
                      placeholder="不知道也可以留空"
                    />
                  </Field>
                </>
              )}
              <div className="form-footer">
                <button
                  onClick={() => setStep(Math.max(0, step - 1))}
                  disabled={step === 0}
                >
                  上一步
                </button>
                <span className="muted">空白数值 = 不知道</span>
                <button
                  className="primary"
                  disabled={!valid.success}
                  onClick={() => (step < 2 ? setStep(step + 1) : go(3))}
                >
                  {step < 2 ? "下一步 →" : "生成诊断 →"}
                </button>
              </div>
            </section>
          </>
        )}
        {page === 2 && (
          <>
            <Title
              eyebrow="ACCOUNT PROFILE"
              title="你的账号档案"
              text="先记录现状。未知留空；原始面板与战斗增益分开标记，不重复叠加。"
            />
            <UidImport
              profile={p}
              onApply={(profile, uid) => {
                if (protectedData)
                  throw Error("本地档案损坏，请先导出原文备份");
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
              }}
            />
            <section className="card">
              <Roster p={p} update={update} />
              <div className="data-actions">
                <button onClick={exportData}>导出 JSON 备份</button>
                <label className="button">
                  导入 JSON
                  <input
                    type="file"
                    accept="application/json,.json"
                    disabled={importing}
                    hidden
                    onChange={(e) => {
                      void importData(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
                <span className="muted">
                  导入会替换本机档案及历史，请先导出备份。
                </span>
              </div>
            </section>
            {p.characters.map((c) => (
              <CharacterEditor key={c.id} c={c} change={changeChar} />
            ))}
            <section className="card">
              <h3>有限养成 · 已有材料库存</h3>
              <p>
                仅支持芭芭拉战技1→2；数量未知时保持待补充，不生成可执行升级。
              </p>
              <div className="grid3">
                <N
                  label="可用摩拉"
                  value={p.mora}
                  max={1e10}
                  onChange={(v) => update({ mora: v })}
                />
                <N
                  label="自由的教导（本）"
                  value={p.inventory.freedom}
                  onChange={(v) =>
                    update({ inventory: { ...p.inventory, freedom: v } })
                  }
                />
                <N
                  label="导能绘卷（个）"
                  value={p.inventory.scroll}
                  onChange={(v) =>
                    update({ inventory: { ...p.inventory, scroll: v } })
                  }
                />
              </div>
              <Source id="materials" />
            </section>
            <Artifacts p={p} update={update} />
          </>
        )}
        {page === 3 && (
          <>
            <Title
              eyebrow="DIAGNOSIS & LEARNING"
              title="先找到原因，再决定投入"
              text="症状不是原因。以下是可复核的候选判断，不是伤害模拟或全局最优配队。"
            />
            {!valid.success ? (
              <section className="card">
                请先修正档案输入错误，再查看有效诊断。
              </section>
            ) : (
              diagnostics.map((d) => (
                <DiagnosisCard key={d.id} d={d} tutorial={() => go(4)} />
              ))
            )}
            <section className="card">
              <h3>遇到术语，随时展开</h3>
              <div className="grid2">
                {Object.entries(terms).map(([k, v]) => (
                  <details key={k}>
                    <summary>{k}</summary>
                    <p>{v}</p>
                  </details>
                ))}
              </div>
            </section>
          </>
        )}
        {page === 4 && (
          <>
            <Title
              eyebrow="YOUR NEXT STEPS"
              title="一小步，也算向前"
              text="先记录起点，再尝试零成本调整。前置未满足时，可直接反馈困难，使用过渡方案。"
            />
            {ended ? (
              <section className="card">
                <h2>本阶段结束</h2>
                <p>
                  已经够用，暂时不安排更多投入。修改目标或档案后将重新评估。
                </p>
              </section>
            ) : valid.success ? (
              tasks.map((t, i) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  index={i}
                  p={p}
                  done={completed(t, store.history)}
                  reasons={blocked(t, tasks, store.history)}
                  onFeedback={() => {
                    setSelected(t.id);
                    setResult({
                      ...emptyMetrics(),
                      scene: store.baseline.scene,
                    });
                    go(5);
                  }}
                />
              ))
            ) : (
              <div className="error">请先修正输入，任务暂不执行。</div>
            )}
          </>
        )}
        {page === 5 && (
          <>
            <Title
              eyebrow="REFLECT & REPLAN"
              title="试过之后，感觉如何？"
              text="有效就保留，无效就重新检查。反馈来自你的实际体验，不自动宣称任务成功。"
            />
            <section className="card">
              <h3>改动前 · 固定比较起点</h3>
              <MetricsEditor
                value={store.baseline}
                change={(v) => setStore((s) => ({ ...s, baseline: v }))}
              />
            </section>
            <section className="card">
              <h3>提交执行反馈</h3>
              <Field label="本次任务">
                <select
                  value={selected}
                  onChange={(e) => setSelected(e.target.value)}
                >
                  {tasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </Field>
              <Select
                label="实际执行结果"
                value={feedback}
                options={feedbackOptions}
                onChange={(v) => setFeedback(v as typeof feedback)}
              />
              <p className="hint">{response(feedback)}</p>
              <h4>改动后 · 相同场景再记录</h4>
              <MetricsEditor value={result} change={setResult} />
              <button
                className="primary"
                disabled={!valid.success}
                onClick={submit}
              >
                保存反馈并更新计划
              </button>
            </section>
            <div className="section-title">
              <h2>
                历史记录 <small>{store.history.length} 条</small>
              </h2>
            </div>
            {store.imports.length > 0 && (
              <section className="card">
                <h3>UID 导入快照 · {store.imports.length} 次</h3>
                {store.imports
                  .slice()
                  .reverse()
                  .map((item, i) => (
                    <details key={item.at + i}>
                      <summary>
                        UID {item.uid} ·{" "}
                        {new Date(item.at).toLocaleString("zh-CN")}
                      </summary>
                      <p>导入前后队伍和目标保留；未公开角色没有被删除。</p>
                      <pre>
                        {JSON.stringify(
                          { before: item.before, after: item.after },
                          null,
                          2,
                        )}
                      </pre>
                    </details>
                  ))}
              </section>
            )}
            {!store.history.length ? (
              <section className="card empty">
                还没有执行记录。第一次尝试后，在这里留下起点。
              </section>
            ) : (
              store.history
                .slice()
                .reverse()
                .map((h) => (
                  <section className="card" key={h.id}>
                    <div className="card-top">
                      <h3>{h.title}</h3>
                      <span className="pill">{h.feedback}</span>
                    </div>
                    <small>{new Date(h.at).toLocaleString("zh-CN")}</small>
                    <p>{response(h.feedback)}</p>
                    {h.fingerprint !== JSON.stringify(p) && (
                      <p className="warning">
                        档案已变化：此任务属于旧快照，记录仍保留；需要重新核对前置与效果。
                      </p>
                    )}
                    <p>
                      {h.baseline.scene &&
                      h.baseline.scene === h.result.scene &&
                      JSON.stringify(h.before.team) ===
                        JSON.stringify(h.after.team) &&
                      h.before.world === h.after.world
                        ? "场景、队伍与世界等级一致；仍需人工确认敌人、增益和操作相同。"
                        : "比较条件不完整或已变化，本次不能推断提升。"}
                    </p>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>观察指标</th>
                            <th>改动前</th>
                            <th>改动后</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(
                            [
                              "seconds",
                              "wait",
                              "deaths",
                              "interruptions",
                              "comfort",
                            ] as const
                          ).map((key, i) => (
                            <tr key={key}>
                              <td>
                                {
                                  [
                                    "耗时（秒）",
                                    "充能等待（秒）",
                                    "死亡次数",
                                    "打断次数",
                                    "舒适度（1—5）",
                                  ][i]
                                }
                              </td>
                              <td>{h.baseline[key] ?? "未知"}</td>
                              <td>{h.result[key] ?? "未知"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <details>
                      <summary>查看不可变档案快照</summary>
                      <pre>
                        {JSON.stringify(
                          { before: h.before, after: h.after },
                          null,
                          2,
                        )}
                      </pre>
                    </details>
                  </section>
                ))
            )}
          </>
        )}
        {page === 6 && <Tools />}
        <footer>
          提瓦特会诊室 · 非官方玩家工具 <span>少一点焦虑，多一点冒险。</span>
        </footer>
      </main>
    </div>
  );
}
function Title({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text: string;
}) {
  return (
    <div className="heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="muted">{text}</p>
      </div>
    </div>
  );
}
function Roster({
  p,
  update,
}: {
  p: Profile;
  update: (v: Partial<Profile>) => void;
}) {
  const [name, setName] = useState("");
  return (
    <>
      <h3>已拥有角色与当前队伍</h3>
      <p className="muted">
        只添加你确认拥有的角色；未录入不代表未拥有。新增月感电六角色指导；皇女自动识别为菲谢尔，伊涅夫识别为伊涅芙。
      </p>
      <div className="inline">
        <input
          aria-label="角色名称"
          value={name}
          placeholder="输入角色名称"
          onChange={(e) => setName(e.target.value)}
        />
        <button
          onClick={() => {
            if (
              name.trim() &&
              !p.characters.some((c) => c.name === normalizeName(name))
            ) {
              update({
                characters: [...p.characters, newCharacter(name.trim())],
              });
              setName("");
            }
          }}
          disabled={
            !name.trim() ||
            p.characters.some((c) => c.name === normalizeName(name))
          }
        >
          添加角色
        </button>
      </div>
      {p.characters.map((c) => (
        <div className="roster" key={c.id}>
          <span className="avatar">{c.name.slice(0, 1)}</span>
          <strong>{c.name}</strong>
          <label>
            <input
              type="checkbox"
              checked={p.team.includes(c.id)}
              disabled={!p.team.includes(c.id) && p.team.length >= 4}
              onChange={(e) =>
                update({
                  team: e.target.checked
                    ? [...p.team, c.id]
                    : p.team.filter((id) => id !== c.id),
                })
              }
            />
            当前队伍
          </label>
          <label>
            <input
              type="checkbox"
              checked={p.keep.includes(c.id)}
              onChange={(e) =>
                update({
                  keep: e.target.checked
                    ? [...p.keep, c.id]
                    : p.keep.filter((id) => id !== c.id),
                })
              }
            />
            希望保留
          </label>
          <button
            className="text-button"
            onClick={() =>
              update({
                characters: p.characters.filter((x) => x.id !== c.id),
                team: p.team.filter((id) => id !== c.id),
                keep: p.keep.filter((id) => id !== c.id),
                artifacts: p.artifacts.map((a) =>
                  a.owner === c.id ? { ...a, owner: "" } : a,
                ),
              })
            }
          >
            移除
          </button>
        </div>
      ))}
    </>
  );
}
function CharacterEditor({
  c,
  change,
}: {
  c: Character;
  change: (v: Character) => void;
}) {
  const put = (v: Partial<Character>) => change({ ...c, ...v });
  const [correctedName, setCorrectedName] = useState(c.nameOverride ?? "");
  return (
    <details className="card" open>
      <summary>
        {c.name} <span className="muted"> · 精确档案</span>
      </summary>
      {c.id.startsWith("enka-") && (
        <div>
          <p className="muted">
            导入角色 ID：{c.id.split("-").at(-1)} · 名称来源：
            {c.nameOverride
              ? "用户校正"
              : reportedName(c.id) === c.name
                ? "用户确认的 ID 映射（上游待核实）"
                : c.name.startsWith("未知角色 #")
                  ? "上游映射缺失"
                  : "Enka 名称表"}
            。名称校正不会解锁未经核实的专属机制。
          </p>
          <Field label="校正角色名称">
            <input
              value={correctedName}
              maxLength={100}
              placeholder="例如：奥黛塔、阿罗夏"
              onChange={(e) => setCorrectedName(e.target.value)}
            />
          </Field>
          <button
            disabled={!correctedName.trim()}
            onClick={() =>
              put({
                name: normalizeName(correctedName.trim()),
                nameOverride: normalizeName(correctedName.trim()),
              })
            }
          >
            保存校正名称
          </button>
        </div>
      )}
      {!guideFor(c.name) && !["凯亚", "芭芭拉"].includes(c.name) && (
        <p className="warning">
          此角色未收录专属机制，仅提供通用排查，不推断技能或最佳装备。
        </p>
      )}
      <div className="grid3">
        <Select
          label="当前职责"
          value={c.role}
          options={["未知", "站场输出", "后台输出", "治疗", "护盾", "辅助"]}
          onChange={(v) => put({ role: v as Character["role"] })}
        />
        <Select
          label="能否应对当前低风险场景"
          value={c.ready}
          options={["未知", "可用", "待培养"]}
          onChange={(v) => put({ ready: v as Character["ready"] })}
        />
        <N
          label="角色等级"
          value={c.level}
          min={1}
          max={100}
          onChange={(v) => put({ level: v })}
        />
        <N
          label="突破阶段（0—6）"
          value={c.ascension}
          max={6}
          onChange={(v) => put({ ascension: v })}
        />
        <N
          label="命座（0—6）"
          value={c.constellation}
          max={6}
          onChange={(v) => put({ constellation: v })}
        />
        {c.talents.map((v, i) => (
          <N
            key={i}
            label={["普通攻击天赋", "元素战技天赋", "元素爆发天赋"][i]}
            value={v}
            min={1}
            max={15}
            onChange={(n) => {
              const t = [...c.talents] as Character["talents"];
              t[i] = n;
              put({ talents: t });
            }}
          />
        ))}
      </div>
      <h4>当前武器</h4>
      <div className="grid3">
        <Field label="武器名称">
          <input
            value={c.weapon.name}
            placeholder="不知道"
            onChange={(e) =>
              put({
                weapon: {
                  ...c.weapon,
                  name: e.target.value,
                  id: c.weapon.id || crypto.randomUUID(),
                },
              })
            }
          />
        </Field>
        <N
          label="武器等级"
          value={c.weapon.level}
          min={1}
          max={90}
          onChange={(v) => put({ weapon: { ...c.weapon, level: v } })}
        />
        <N
          label="武器突破"
          value={c.weapon.ascension}
          max={6}
          onChange={(v) => put({ weapon: { ...c.weapon, ascension: v } })}
        />
        <N
          label="精炼（1—5）"
          value={c.weapon.refinement}
          min={1}
          max={5}
          onChange={(v) => put({ weapon: { ...c.weapon, refinement: v } })}
        />
      </div>
      <h4>面板记录（不会与装备重复相加）</h4>
      <Select
        label="面板来源"
        value={c.panel.kind}
        options={["未知", "原始面板", "战斗增益后", "展柜快照（增益未知）"]}
        onChange={(v) =>
          put({ panel: { ...c.panel, kind: v as Character["panel"]["kind"] } })
        }
      />
      <div className="grid3">
        {(["hp", "atk", "def", "em", "er", "cr", "cd"] as const).map((k, i) => (
          <N
            key={k}
            label={
              [
                "生命值",
                "攻击力",
                "防御力",
                "元素精通",
                "元素充能效率（%）",
                "暴击率（%）",
                "暴击伤害（%）",
              ][i]
            }
            value={c.panel[k]}
            onChange={(v) => put({ panel: { ...c.panel, [k]: v } })}
          />
        ))}
      </div>
    </details>
  );
}
function DiagnosisCard({
  d,
  tutorial,
}: {
  d: Diagnosis;
  tutorial: () => void;
}) {
  const [level, setLevel] = useState(0);
  return (
    <section className="card diagnosis">
      <div className="card-top">
        <div>
          <span className="eyebrow">
            {d.source === "method" ? "经验筛查" : "基于机制的规则"}
          </span>
          <h2>{d.title}</h2>
        </div>
        <span className={"pill " + (d.status === "已确认" ? "green" : "")}>
          {d.status}
        </span>
      </div>
      <p>
        <strong>观察症状：</strong>
        {d.symptom}
      </p>
      <p>
        <strong>候选原因：</strong>
        {d.cause}
      </p>
      <div className="evidence">依据：{d.evidence}</div>
      <div className="switcher">
        {["简短建议", "基础教学", "手把手教程"].map((l, i) => (
          <button
            key={l}
            className={level === i ? "selected" : ""}
            onClick={() => setLevel(i)}
          >
            {l}
          </button>
        ))}
      </div>
      <p className="advice">
        {level === 0 ? d.action : level === 1 ? d.teaching : d.verify}
      </p>
      {level === 2 && (
        <button onClick={tutorial}>查看有前置检查的任务卡 →</button>
      )}
      <details>
        <summary>缺失信息、验证方法与适用范围</summary>
        <p>待补：{d.missing}</p>
        <p>验证：{d.verify}</p>
        <p>适用：{d.scope}</p>
      </details>
      <Source id={d.source} />
    </section>
  );
}
function TaskCard({
  task: t,
  index,
  p,
  done,
  reasons,
  onFeedback,
}: {
  task: Task;
  index: number;
  p: Profile;
  done: boolean;
  reasons: string[];
  onFeedback: () => void;
}) {
  return (
    <section className="card task">
      <div className="card-top">
        <span className="number">{String(index + 1).padStart(2, "0")}</span>
        <div>
          <h2>{t.title}</h2>
          <p>{t.problem}</p>
        </div>
        <span className="pill">
          {done ? "已完成" : reasons.length ? "待满足前置" : "可以开始"}
        </span>
      </div>
      <p className={reasons.length ? "warning" : "hint"}>
        前置：{reasons.join("；") || "已满足；无需新增培养或资源"}
      </p>
      <p>
        执行队伍：
        {t.team.length
          ? t.team
              .map((id) => p.characters.find((c) => c.id === id)?.name)
              .join(" / ")
          : "无需战斗队伍，仅做记录"}
        {t.blocked.length ? "（仅为候选，前置满足后才可执行）" : ""}
      </p>
      <p>地点与目标：{t.location}</p>
      <details open>
        <summary>手把手操作</summary>
        <ol>
          {t.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </details>
      {t.growth.length > 0 && (
        <details>
          <summary>本阶段培养目标与装备分配</summary>
          {t.growth.map((s) => (
            <p key={s}>{s}</p>
          ))}
          <p>
            不从其他队员自动借装备；仅使用本人的当前装备或未分配散件。后续套装、副词条优化暂缓。
          </p>
        </details>
      )}
      <div className="task-meta">
        <div>
          <b>投入预算</b>
          <p>{t.budget}</p>
        </div>
        <div>
          <b>完成标准</b>
          <p>{t.accept}</p>
        </div>
        <div>
          <b>停止条件</b>
          <p>{t.stop}</p>
        </div>
      </div>
      <details>
        <summary>卡住了？查看替代方案</summary>
        <p>{t.alternatives}</p>
      </details>
      <button className="primary" onClick={onFeedback}>
        {done ? "追加观察反馈" : "记录执行结果"}
      </button>
      <Source id={t.source} />
    </section>
  );
}
function MetricsEditor({
  value: v,
  change,
}: {
  value: Metrics;
  change: (v: Metrics) => void;
}) {
  return (
    <>
      <Field label="场景标识（敌人、地点、难度、增益）">
        <input
          value={v.scene}
          onChange={(e) => change({ ...v, scene: e.target.value })}
          placeholder="相同比较请使用完全相同的描述"
        />
      </Field>
      <div className="grid3">
        {(
          ["seconds", "wait", "deaths", "interruptions", "comfort"] as const
        ).map((k, i) => (
          <N
            key={k}
            label={
              [
                "完成耗时（秒）",
                "充能等待（秒）",
                "死亡次数",
                "被打断次数",
                "舒适度（1—5）",
              ][i]
            }
            value={v[k]}
            max={k === "comfort" ? 5 : 86400}
            min={k === "comfort" ? 1 : 0}
            onChange={(n) => change({ ...v, [k]: n })}
          />
        ))}
      </div>
    </>
  );
}
function Artifacts({
  p,
  update,
}: {
  p: Profile;
  update: (v: Partial<Profile>) => void;
}) {
  const fresh = (): Artifact => ({
    id: crypto.randomUUID(),
    owner: "",
    slot: "理之冠",
    set: "",
    rarity: null,
    level: null,
    main: null,
    mainValue: null,
    subs: [],
  });
  const [a, setA] = useState<Artifact>(fresh),
    [message, setMessage] = useState(""),
    [target, setTarget] = useState("");
  const valid = artifactSchema.safeParse(a);
  const put = (v: Partial<Artifact>) => setA({ ...a, ...v });
  const old = p.artifacts.find((x) => x.owner === target && x.slot === a.slot);
  return (
    <section className="card">
      <h3>圣遗物记录与有限比较</h3>
      <p className="muted">
        记录原始装备。通用模式比较纯治疗主词条；月感电模式结合已收录角色职责。均不计算全仓库最优或伤害提升。
      </p>
      <div className="grid3">
        <Select
          label="部位"
          value={a.slot}
          options={slots}
          onChange={(v) => put({ slot: v as Artifact["slot"] })}
        />
        <Field label="套装名称">
          <input
            value={a.set}
            placeholder="不知道可留空"
            onChange={(e) => put({ set: e.target.value })}
          />
        </Field>
        <Select
          label="星级"
          value={a.rarity === null ? "未知" : String(a.rarity)}
          options={["未知", "1", "2", "3", "4", "5"]}
          onChange={(v) => put({ rarity: v === "未知" ? null : Number(v) })}
        />
        <N
          label="强化等级"
          value={a.level}
          max={20}
          onChange={(v) => put({ level: v })}
        />
        <Select
          label="主词条"
          value={a.main ?? "未知"}
          options={["未知", ...stats]}
          onChange={(v) =>
            put({ main: v === "未知" ? null : (v as Artifact["main"]) })
          }
        />
        <N
          label="主词条数值（对应属性单位）"
          value={a.mainValue}
          onChange={(v) => put({ mainValue: v })}
        />
        <Field label="装备归属">
          <select
            value={a.owner}
            onChange={(e) => put({ owner: e.target.value })}
          >
            <option value="">未分配 / 新获得</option>
            {p.characters.map((c) => (
              <option value={c.id} key={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <h4>副词条（未录入的部分保持未知）</h4>
      {a.subs.map((s, i) => (
        <div className="inline" key={i}>
          <Select
            label="副词条"
            value={s.stat}
            options={stats}
            onChange={(v) =>
              put({
                subs: a.subs.map((x, j) =>
                  i === j ? { ...x, stat: v as typeof x.stat } : x,
                ),
              })
            }
          />
          <N
            label="数值（对应词条单位）"
            value={s.value}
            onChange={(v) =>
              put({
                subs: a.subs.map((x, j) => (i === j ? { ...x, value: v } : x)),
              })
            }
          />
          <button
            onClick={() => put({ subs: a.subs.filter((_, j) => i !== j) })}
          >
            删除
          </button>
        </div>
      ))}
      <button
        disabled={a.subs.length >= 4}
        onClick={() =>
          put({ subs: [...a.subs, { stat: "生命值", value: null }] })
        }
      >
        添加副词条
      </button>
      {!valid.success && (
        <p className="error">
          {valid.error.issues.map((i) => i.message).join("；")}
        </p>
      )}
      <div className="data-actions">
        <button
          className="primary"
          disabled={!valid.success}
          onClick={() => {
            const next = {
              ...p,
              artifacts: [...p.artifacts.filter((x) => x.id !== a.id), a],
            };
            const r = profileSchema.safeParse(next);
            if (!r.success) {
              setMessage(r.error.issues.map((i) => i.message).join("；"));
              return;
            }
            update({ artifacts: next.artifacts });
            setA(fresh());
            setMessage("装备已保存");
          }}
        >
          保存这件装备
        </button>
      </div>
      <div className="inline">
        <Field label="比较目标角色">
          <select value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">请选择</option>
            {p.characters.map((c) => (
              <option value={c.id} key={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <button
          disabled={!valid.success || !target}
          onClick={() =>
            setMessage(
              compareArtifacts(
                old,
                a,
                p.characters.find((c) => c.id === target)?.role ?? "未知",
                p.focus === "月感电"
                  ? p.characters.find((c) => c.id === target)?.name
                  : undefined,
              ),
            )
          }
        >
          与当前同部位比较
        </button>
      </div>
      {message && (
        <p role="status" className="hint">
          {message}
        </p>
      )}
      <p>
        本阶段：现有合法散件可用；治疗职责优先检查生命／治疗主词条。后续套装与副词条暂缓。随机刷取预算
        0 树脂；一次试穿复测后重新评估，没刷到也能继续。
      </p>
      {p.artifacts.map((x) => (
        <div className="roster" key={x.id}>
          <span>
            {x.set || "未知套装"} · {x.slot} +{x.level ?? "未知"} ·{" "}
            {x.main ?? "未知主词条"} ·{" "}
            {p.characters.find((c) => c.id === x.owner)?.name ?? "未分配"}
          </span>
          <button
            onClick={() => {
              setA(structuredClone(x));
              setMessage("正在编辑已保存装备；点击保存后才会替换原记录");
            }}
          >
            编辑
          </button>
          <button
            onClick={() =>
              update({ artifacts: p.artifacts.filter((v) => v.id !== x.id) })
            }
          >
            移除
          </button>
        </div>
      ))}
      <Source
        id={
          p.focus === "月感电"
            ? (guideFor(p.characters.find((c) => c.id === target)?.name ?? "")
                ?.source ?? "lunar")
            : "barbara"
        }
      />
    </section>
  );
}
function Tools() {
  const [cr, setCr] = useState<number | null>(50),
    [cd, setCd] = useState<number | null>(100),
    [res, setRes] = useState<number | null>(10),
    [base, setBase] = useState<number | null>(30),
    [er, setEr] = useState<number | null>(150),
    [flat, setFlat] = useState<number | null>(0),
    [cost, setCost] = useState<number | null>(60);
  const safe = (f: () => number) => {
    try {
      return f().toFixed(3) + " 倍";
    } catch {
      return "输入不合法";
    }
  };
  return (
    <>
      <Title
        eyebrow="SCOPE & SOURCES"
        title="知道边界，才值得信任"
        text="确定性计算、经验规则与主观反馈分别记录。没有 AI API、全局配队搜索或完整战斗模拟。"
      />
      <section className="card">
        <h2>首版公开支持范围</h2>
        <p>
          新增月感电专项：砂糖、哥伦比娅、菲林斯、伊涅芙、爱诺、菲谢尔的职责、反应条件和低成本循环检查。保留芭芭拉与凯亚旧教程。月感电不套用普通伤害公式，不支持完整战斗模拟。
        </p>
        <p>
          练习使用用户确认已解锁、已能应对的地区；旧教程仍限定蒙德。无固定刷取坐标，不提供未经核实的地图标点。
        </p>
        <p>
          材料成本仅收录芭芭拉单个天赋1→2：12500摩拉、3本自由的教导、6个导能绘卷。只在库存和突破满足时提供战技升级步骤；不预测材料刷取天数。其余升级费用不支持。
        </p>
      </section>
      <section className="card">
        <h3>确定性计算 · 常规可暴击伤害</h3>
        <div className="grid2">
          <N label="暴击率（%）" value={cr} max={200} onChange={setCr} />
          <N label="暴击伤害（%）" value={cd} max={1000} onChange={setCd} />
        </div>
        <output>
          {cr === null || cd === null ? "等待输入" : safe(() => crit(cr, cd))}
        </output>
        <p>
          期望暴击倍率 = 1 + min(暴击率, 100%) × 暴击伤害。独立推导：(1−p)×1 +
          p×(1+d)。只表示暴击部分，不是总伤害或提升百分比；不适用不可暴击反应与特殊暴击机制。
        </p>
        <Source id="damage" />
      </section>
      <section className="card">
        <h3>确定性计算 · 敌人抗性倍率</h3>
        <N
          label="减抗后的有效抗性（%）"
          value={res}
          min={-1000}
          max={1000}
          onChange={setRes}
        />
        <output>
          {res === null ? "等待输入" : safe(() => resistance(res))}
        </output>
        <p>
          r 为百分比转换后的小数：r&lt;0 时 1−r/2；0≤r&lt;0.75 时 1−r；r≥0.75 时
          1/(4r+1)。不含防御、护盾、等级与反应机制，不自动查询敌人抗性。
        </p>
        <Source id="damage" />
      </section>
      <section className="card">
        <h3>确定性计算 · 简化回能检查</h3>
        <p>
          必须先明确每轮接球输入：基础能量已经包含微粒种类、元素匹配和前后台系数，不能填微粒数量。
        </p>
        <div className="grid2">
          <N
            label="每轮微粒／晶球基础能量（点）"
            value={base}
            onChange={setBase}
          />
          <N label="充能效率（%）" value={er} onChange={setEr} />
          <N label="固定回能（点，不乘充能）" value={flat} onChange={setFlat} />
          <N label="爆发消耗（点）" value={cost} onChange={setCost} />
        </div>
        <output>
          {[base, er, flat, cost].some((x) => x === null)
            ? "等待全部输入"
            : Math.min(base!, er!, flat!, cost!) < 0
              ? "输入不能为负"
              : `回能 ${energy(base!, er!, flat!, cost!).total.toFixed(1)} 点 / 缺口 ${energy(base!, er!, flat!, cost!).gap.toFixed(1)} 点`}
        </output>
        <p>
          E = 基础能量 × 充能效率 / 100 +
          固定回能。示例：30×150%+0=45，消耗60则缺15。忽略溢出、时间轴、敌人掉球变化和特殊机制；假设错误时结果没有预测意义。
        </p>
        <Source id="energy" />
      </section>
      <section className="card" id="method">
        <h3>诊疗方法与来源登记</h3>
        <p>
          经验规则
          v1：以症状触发排查，只有直接输入可确认的事实标记“已确认”。冒险等阶≥25且角色／武器&lt;40、并行培养&gt;4
          是产品筛查阈值，不是游戏机制或毕业标准。用户舒适度不转化为伤害结论。
        </p>
        {(Object.keys(sources) as SourceKey[])
          .filter((k) => k !== "method")
          .map((k) => (
            <Source id={k} key={k} />
          ))}
        <p>
          资料核实日期 {verified}
          。旧版来源仅用于列明的基础机制，不宣称适配当前所有游戏内容。
        </p>
      </section>
      <section className="card">
        <h3>路线图 · UID 导入已接入</h3>
        <div className="roadmap">
          <p>
            <b>P0 · 已实现</b>{" "}
            本机档案、规则诊断、分层教学、有限计算与数据校验。
          </p>
          <p>
            <b>P1 · 已实现（有限范围）</b>{" "}
            两条零投入具体教程、芭芭拉战技1→2库存规划、依赖检查、装备条件比较、反馈分支和历史快照。
          </p>
          <p>
            <b>P2 · 部分实现</b> 已接入 Enka 公开展柜 UID
            导入与手动补全。全仓库数据、更完整装备分配与培养比较、gcsim
            接入仍未实现。
          </p>
          <p>
            <b>P3 · 未实现</b>{" "}
            版本发现→候选变更→回归校验→发布／回滚。数值与新机制独立审核；未知机制保持不支持。无定时任务、无自动发布。
          </p>
        </div>
      </section>
    </>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
