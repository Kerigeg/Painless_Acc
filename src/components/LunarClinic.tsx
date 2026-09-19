import { newCharacter, type Profile } from "../domain/model";
import { lunarCharacters, teamTemplates } from "../data/characters";
import { lunarState, templateAvailability } from "../domain/lunar";
import { sources, type SourceKey } from "../data/sources";
function Citation({ id }: { id: SourceKey }) {
  const s = sources[id];
  return (
    <p className="source">
      <a href={s.url} target="_blank" rel="noreferrer">
        {s.name} ↗
      </a>{" "}
      · {s.version} · 核实 2026-09-19 · 资料核对，非游戏内实测
    </p>
  );
}
export function LunarClinic({
  p,
  update,
  diagnose,
  profile,
}: {
  p: Profile;
  update: (p: Partial<Profile>) => void;
  diagnose: () => void;
  profile: () => void;
}) {
  const state = lunarState(p);
  return (
    <>
      <div className="heading">
        <div>
          <p className="eyebrow">LUNAR-CHARGED / 月感电专项</p>
          <h1>先让水雷衔接起来。</h1>
          <p className="muted">
            围绕当前队伍查覆盖、循环和生存，再决定怎么培养。
          </p>
        </div>
        <span className="seal">☾</span>
      </div>
      <section className="hero lunar-hero">
        <div className="card-top">
          <h2>当前队伍的月感电条件</h2>
          <span className="pill">
            {p.focus === "月感电" ? "专项诊断已启用" : "尚未启用专项"}
          </span>
        </div>
        <div className="lunar-status">
          <div>
            <small>反应开启者</small>
            <strong>
              {state.enablers.map((c) => c.name).join(" / ") || "尚未确认"}
            </strong>
          </div>
          <div>
            <small>已确认月兆</small>
            <strong>
              {state.moonLevel >= 2
                ? "二级条件已具备"
                : `至少 ${state.moonLevel} 级`}
            </strong>
          </div>
          <div>
            <small>元素覆盖角色</small>
            <strong>
              水 {state.hydro ? "✓" : "待确认"} / 雷{" "}
              {state.electro ? "✓" : "待确认"}
            </strong>
          </div>
        </div>
        <p>
          这是队伍结构检查，不表示雷云已稳定出现。爱诺提高月兆，但自身不能开启月感电；未知角色机制不会被当作没有。
        </p>
        <button
          className="gold"
          onClick={() => {
            update({ focus: "月感电" });
            diagnose();
          }}
        >
          启用专项并查看诊断 →
        </button>
      </section>
      <section className="card">
        <h3>记录这一轮发生了什么</h3>
        <div className="grid3">
          {(
            [
              {
                key: "cloud",
                label: "雷云观察",
                options: ["未知", "持续", "中断", "未出现"],
              },
              {
                key: "hydro",
                label: "后台水覆盖",
                options: ["未知", "持续", "中断"],
              },
              {
                key: "flinsSwap",
                label: "菲林斯战技状态中途切人",
                options: ["未知", "是", "否"],
              },
              {
                key: "flinsBurst",
                label: "菲林斯使用的爆发",
                options: ["未知", "短爆发", "普通爆发"],
              },
              {
                key: "safeScene",
                label: "已有能应对的低风险场景",
                options: ["未知", "已确认", "未确认"],
              },
              {
                key: "hexerei",
                label: "魔导相关解锁情况（不计数值）",
                options: ["未知", "已解锁", "未解锁"],
              },
            ] as const
          ).map((f) => (
            <label className="field" key={f.key}>
              <span>{f.label}</span>
              <select
                value={p.lunar[f.key]}
                onChange={(e) =>
                  update({
                    focus: "月感电",
                    lunar: { ...p.lunar, [f.key]: e.target.value },
                  })
                }
              >
                {f.options.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <div className="grid2">
          <label className="field">
            <span>已解锁练习地区</span>
            <input
              value={p.region}
              placeholder="填你实际可以进入的地区"
              onChange={(e) => update({ region: e.target.value })}
            />
          </label>
          <label className="field">
            <span>本阶段可投入时间（分钟）</span>
            <input
              type="number"
              min={1}
              max={1440}
              value={p.minutes ?? ""}
              placeholder="未知"
              onChange={(e) =>
                update({
                  minutes:
                    e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </label>
        </div>
        <p>
          首次练习与下一轮反馈分开保存；改变队伍或观测资料后会重新核查任务前置。
        </p>
      </section>
      <div className="section-title">
        <h2>六位角色，各司其职</h2>
        <button onClick={profile}>UID 导入 / 详细档案 →</button>
      </div>
      <div className="lunar-grid">
        {lunarCharacters.map((g) => {
          const c = p.characters.find((c) => c.name === g.name);
          return (
            <section className="card lunar-character" key={g.name}>
              <div className="card-top">
                <div>
                  <span className={`element element-${g.element}`}>
                    {g.element}
                  </span>
                  <h3>
                    {g.name}
                    {g.name === "菲谢尔" && <small> · 皇女</small>}
                  </h3>
                </div>
                <span className="pill">
                  {g.enabler ? "开启月感电" : g.moon ? "提高月兆" : "协同队员"}
                </span>
              </div>
              <p>{g.summary}</p>
              {c ? (
                <label className="field">
                  <span>{g.name}能否应对练习场景</span>
                  <select
                    value={c.ready}
                    onChange={(e) =>
                      update({
                        characters: p.characters.map((x) =>
                          x.id === c.id
                            ? { ...x, ready: e.target.value as typeof c.ready }
                            : x,
                        ),
                      })
                    }
                  >
                    {["未知", "可用", "待培养"].map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                </label>
              ) : (
                <button
                  onClick={() =>
                    update({
                      characters: [
                        ...p.characters,
                        { ...newCharacter(g.name), role: g.role },
                      ],
                    })
                  }
                >
                  我已拥有，加入档案
                </button>
              )}
              <details>
                <summary>操作、培养与装备方向</summary>
                <ol>
                  {g.steps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
                <p>{g.talents}</p>
                <p>{g.stats}</p>
                <p className="warning">{g.caution}</p>
                <p>
                  阶段目标：先维持当前等级、突破、武器与天赋；按瓶颈确定下一项投入。未收录材料成本时不生成刷取要求。
                </p>
              </details>
              <Citation id={g.source} />
            </section>
          );
        })}
      </div>
      <section className="card">
        <h2>从已拥有角色中选择练习队伍</h2>
        <p>
          模板用于教学，不是最优排名。只有成员全部已录入、已确认可用且保留角色不被移除时，才可应用。
        </p>
        {teamTemplates.map((t) => {
          const check = templateAvailability(p, t.id);
          return (
            <div className="team-template" key={t.id}>
              <h3>{t.name}</h3>
              <p>{t.names.join(" / ")}</p>
              {check.missing.length > 0 && (
                <p className="warning">
                  尚未确认拥有：{check.missing.join("、")}。不是抽卡建议。
                </p>
              )}
              {check.unready.length > 0 && (
                <p>是否可用待确认：{check.unready.join("、")}</p>
              )}
              {check.kept.length > 0 && (
                <p>此模板无法保留指定角色，不能自动替换。</p>
              )}
              <button
                disabled={!check.usable}
                onClick={() => update({ focus: "月感电", team: check.ids })}
              >
                {check.usable &&
                JSON.stringify(p.team) === JSON.stringify(check.ids)
                  ? "当前使用此队伍"
                  : "应用这支已可用队伍"}
              </button>
              <Citation id={t.source} />
            </div>
          );
        })}
      </section>
      <section className="card">
        <h3>两种伤害要分清</h3>
        <p>
          雷云造成的反应月感电，与角色天赋造成的直接月感电，不共用同一套完整计算。普通雷伤加成不能直接当月感电增伤；本版不会把原有常规伤害工具套成月感电模拟器。
        </p>
        <p>
          圣遗物先用合法散件，随机刷取预算为0。没有全队伤害排序、命座收益计算或固定充能毕业线；魔导效果、特殊武器与新机制未自动计入。
        </p>
        <Citation id="lunar" />
      </section>
    </>
  );
}
