import { checkup } from "./checkup";
import type { Profile } from "./model";
import type { Diagnosis } from "./rules";
import { guideFor } from "../data/characters";

// A public showcase is a configuration sample, never an inferred combat team.
export function diagnoseShowcase(p: Profile): Diagnosis[] {
  if (!p.showcase) return [];
  return p.characters
    .filter(
      (c) =>
        c.id.startsWith(`enka-${p.showcase!.uid}-`) ||
        c.weapon.id.startsWith(`enka-${p.showcase!.uid}-`),
    )
    .map((c) => {
      const guide = guideFor(c.name);
      const equipment = p.artifacts.filter((a) => a.owner === c.id);
      const low =
        p.ar !== null &&
        p.ar >= 25 &&
        ((c.level !== null && c.level < 40) ||
          (c.weapon.level !== null && c.weapon.level < 40));
      const incomplete =
        c.level === null ||
        c.weapon.level === null ||
        c.talents.some((t) => t === null) ||
        equipment.length < 5;
      const pieces = equipment
        .map(
          (a) => `${a.slot}：${a.main ?? "主词条未知"}，+${a.level ?? "未知"}`,
        )
        .join("；");
      const checks = checkup(p, c);
      const first = [...checks].sort((a, b) => b.priority - a.priority)[0];
      return {
        id: `showcase-${c.id}`,
        title: first.priority
          ? `${c.name}：先检查${first.label}（${first.verdict}）`
          : `${c.name}：${low ? "优先核对基础投入" : incomplete ? "配置已读取，部分信息待补充" : "配置可分析，实战瓶颈待验证"}`,
        status: first.priority ? "疑似" : "待补充",
        symptom: "公开展柜配置检查；未由展柜推断实战症状",
        cause: low
          ? "若此角色承担当前主要职责，较低的角色或武器等级可能限制表现"
          : "仅凭配置不能确认伤害、回能或生存的实际瓶颈",
        evidence: `角色等级 ${c.level ?? "未知"}；武器 ${c.weapon.name || "未知"}，等级 ${c.weapon.level ?? "未知"}；普攻／战技／爆发 ${c.talents.map((t) => t ?? "未知").join("／")}（可能含额外等级）；充能 ${c.panel.er ?? "未知"}%；${equipment.length}/5 个部位有记录。${pieces}`,
        missing:
          "实际使用队伍、目标场景、主要困难、可用资源；未读取部位不代表未装备；展柜面板增益来源未知",
        verify:
          "确认此角色是否实际使用，在同一场景观察一轮；若更换装备，重新导入或更新档案后比较。",
        action: first.priority
          ? first.next
          : low
            ? "先核对游戏内等级上限与库存；确认是常用角色后再决定投入，不立即刷取"
            : guide
              ? `先检查当前职责：${guide.summary}`
              : "保留现有配置，补充实际职责与场景；该角色专属机制尚未支持",
        teaching: `${low ? "40 级只是冒险等阶 25 以上的排查触发值，并非毕业标准。" : "数值读取成功不代表配置毕业；不同职责需要不同条件。"}${guide ? `天赋方向：${guide.talents} 装备方向：${guide.stats} 限制：${guide.caution}` : "不根据未知角色的天赋顺序或新机制生成培养目标。"}`,
        source: guide?.source ?? "method",
        scope:
          "公开展柜中的单角色配置初筛；不是完整账号评分、配队结论或伤害模拟",
      } satisfies Diagnosis;
    });
}
