import { assessMainStats } from "../domain/main-stats";
import { mainStatVerification } from "../data/main-stat-guides";
import { useState } from "react";
import type { Character, Profile } from "../domain/model";
import { checkup } from "../domain/checkup";
import { guideFor } from "../data/characters";
import { sources } from "../data/sources";
export function CharacterCheckup({ p, c }: { p: Profile; c: Character }) {
  const rows = checkup(p, c);
  const assessment = assessMainStats(p, c);
  const statSource = assessment.guide ? sources[assessment.guide.source] : null;
  const first = [...rows].sort((a, b) => b.priority - a.priority)[0];
  const source = sources[guideFor(c.name)?.source ?? "method"];
  return (
    <section className="card checkup">
      <h2>{c.name} · 基础体检</h2>
      <div className="hint">
        <strong>
          {first.priority
            ? `先处理：${first.label} — ${first.verdict}`
            : "已知配置没有触发优先问题，先确认实际队伍与玩法"}
        </strong>
        <p>
          {first.priority
            ? first.next
            : "这不代表毕业或强度达标；下面逐项列出了已知数据和未支持的判断。"}
        </p>
      </div>
      <div className="checkup-grid">
        {rows.map((row) => (
          <article key={row.label}>
            <h3>{row.label}</h3>
            <p className="muted">当前：{row.current}</p>
            <p>
              <strong>{row.verdict}</strong>
            </p>
            <p>{row.next}</p>
          </article>
        ))}
      </div>
      <details className="main-stat-details" open>
        <summary>圣遗物主词条 · 逐部位对照</summary>
        {assessment.guide ? (
          <>
            <p>
              适用：{assessment.guide.scope}。
              {assessment.applicable
                ? "正在按此职责检查。"
                : "当前职责未匹配，以下仅供参考，不直接判错。"}
            </p>
            {assessment.rows.map((row) => (
              <div className="stat-comparison" key={row.slot}>
                <strong>
                  {row.slot} · {row.status}
                </strong>
                <p>
                  当前：{row.main ?? "未知"} → 常见选择：{row.recommended}
                </p>
                <p>{row.reason}</p>
              </div>
            ))}
            <p>{assessment.guide.note}</p>
            <p className="source">
              <a
                href={statSource!.url + "#artifact-stats"}
                target="_blank"
                rel="noreferrer"
              >
                {statSource!.name} · {statSource!.version}
              </a>{" "}
              · 核实{" "}
              {statSource && "checkedAt" in statSource
                ? String(statSource.checkedAt)
                : mainStatVerification.date}{" "}
              · {mainStatVerification.status}
            </p>
            <p className="muted">
              条件未满足前不判毕业；先比较已有散件，随机刷取预算为
              0。没有合适替换也可继续。
            </p>
          </>
        ) : (
          <p>暂未找到已核实的该角色主词条资料，不使用其他角色的模板代替。</p>
        )}
      </details>
      <details>
        <summary>判断依据与限制</summary>
        <p>
          等级按冒险等阶分段做经验筛查：25 / 35 / 45 阶分别参考角色 40 / 60 /
          70、武器 40 / 60 /
          80。用于定位可能遗漏的基础投入，不是通用毕业标准。强化 +12
          为有限投入检查点，不计算收益或费用；必须先确认主词条与库存。随机刷取预算为
          0。
        </p>
        <p>
          主词条按所列职责与来源版本判断，特殊武器与不同玩法有条件差异；未知字段不按零处理。
        </p>
        <a href={source.url} target="_blank" rel="noreferrer">
          {source.name} · {source.version}
        </a>
      </details>
    </section>
  );
}

export function CharacterCheckups({ p }: { p: Profile }) {
  const [selected, setSelected] = useState("");
  const ordered = [...p.characters].sort(
    (a, b) =>
      Math.max(...checkup(p, b).map((r) => r.priority)) -
      Math.max(...checkup(p, a).map((r) => r.priority)),
  );
  const c = ordered.find((c) => c.id === selected) ?? ordered[0];
  if (!c) return null;
  return (
    <>
      <label className="field">
        查看角色体检
        <select value={c.id} onChange={(e) => setSelected(e.target.value)}>
          {ordered.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
      </label>
      <CharacterCheckup p={p} c={c} />
    </>
  );
}
