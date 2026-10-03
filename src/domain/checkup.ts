import type { Character, Profile } from "./model";
import { slots } from "./model";
import { assessMainStats } from "./main-stats";
import { lunarState } from "./lunar";
export type Check = {
  label: string;
  current: string;
  verdict: string;
  next: string;
  priority: number;
};
export function checkup(p: Profile, c: Character): Check[] {
  const gear = p.artifacts.filter((a) => a.owner === c.id);
  const stage =
    p.ar === null
      ? null
      : p.ar >= 45
        ? [70, 80]
        : p.ar >= 35
          ? [60, 60]
          : p.ar >= 25
            ? [40, 40]
            : null;
  const levels = (
    label: string,
    level: number | null,
    target: number | null,
  ): Check => ({
    label,
    current: level === null ? "未读取" : `${level} 级`,
    verdict:
      level === null
        ? "缺少等级数据"
        : target !== null && level < target
          ? `低于本阶段排查参考 ${target} 级`
          : "暂不列为优先问题",
    next:
      level === null
        ? "在游戏内确认等级后，更新展柜并重新导入。"
        : target !== null && level < target
          ? `如果这是常用角色，先核对突破和库存，再分阶段向 ${target} 级推进；不是毕业线，不自动安排刷材料。`
          : "保持当前等级，先检查下面的装备。",
    priority: level !== null && target !== null && level < target ? 2 : 0,
  });
  const known = gear.filter((a) => a.level !== null && a.rarity !== null);
  const low = known.filter(
    (a) => a.level! < Math.min(12, [0, 4, 4, 12, 16, 20][a.rarity!]),
  );
  const missing = slots.filter((slot) => !gear.some((a) => a.slot === slot));
  const assessment = assessMainStats(p, c);
  const mismatch = assessment.rows.filter((r) => r.status === "建议调整");
  const s = lunarState(p);
  const inTeam = p.team.includes(c.id);
  const gaps = [
    !s.hydro ? "水元素" : null,
    !s.electro ? "雷元素" : null,
    !s.enablers.length ? "已支持的月感电开启者" : null,
  ].filter(Boolean);
  return [
    levels("角色等级", c.level, stage?.[0] ?? null),
    {
      ...levels("武器等级", c.weapon.level, stage?.[1] ?? null),
      current: `${c.weapon.name || "武器名称未知"} · ${c.weapon.level ?? "未知"} 级`,
    },
    {
      label: "圣遗物强化",
      current: gear.length
        ? gear.map((a) => `${a.slot} +${a.level ?? "未知"}`).join("；")
        : "未读取圣遗物",
      verdict: low.length
        ? `${low.length} 件强化较低，先检查是否值得继续用`
        : missing.length
          ? `缺少 ${missing.join("、")} 记录`
          : "已记录部位暂未发现低强化项",
      next: low.length
        ? "先确认主词条适合，再用已有材料逐件强化至 +12（低星以自身上限为限）；每件后试用，够用就停，不先刷副词条。"
        : missing.length
          ? "在游戏内更新展柜并重新导入装备。没读到不等于没装备。"
          : "保留当前装备；不会仅凭强化等级判定毕业或要求全套 +20。",
      priority: low.length ? 2 : 0,
    },
    {
      label: "圣遗物主词条",
      current: assessment.rows
        .map((r) => `${r.slot}：${r.main ?? "未知"}`)
        .join("；"),
      verdict: mismatch.length
        ? `${mismatch.map((r) => r.slot).join("、")} 建议调整`
        : assessment.rows.some((r) => r.status === "需核实条件")
          ? "部分主词条有适用条件"
          : assessment.rows.some((r) => r.status === "未知")
            ? "有主词条未读取"
            : assessment.applicable
              ? "已知主词条符合当前职责的常见方向"
              : "当前职责尚未匹配资料",
      next: mismatch.length
        ? mismatch.map((r) => r.reason).join(" ")
        : "查看下方逐部位对照；先用已有装备，不因单件结论立即刷取。",
      priority: mismatch.length ? 3 : 0,
    },
    {
      label: "队伍搭配",
      current: s.team.length
        ? s.team.map((x) => x.name).join(" / ")
        : "尚未确认实际队伍",
      verdict: !inTeam
        ? "先确认是否在你实际使用的队伍中"
        : p.focus !== "月感电"
          ? "已记录队伍，未进行月感电专项检查"
          : s.unknown.length
            ? "部分队员机制未支持，不能确认功能齐全"
            : gaps.length
              ? `当前队伍缺少${gaps.join("、")}`
              : "具备水、雷与月感电开启者，仍需实战验证",
      next: !inTeam
        ? "在上方“实际使用队伍”中勾选；展柜中的角色不会自动算成一队。"
        : gaps.length && p.focus === "月感电"
          ? "先从已拥有且可用的角色中补齐功能；到月感电专题查看可用模板，不要求抽新角色。"
          : "确认生存与出手顺序；队伍结构齐全不等于伤害或回能达标。",
      priority:
        inTeam && p.focus === "月感电" && !s.unknown.length && gaps.length
          ? 3
          : 0,
    },
  ];
}
