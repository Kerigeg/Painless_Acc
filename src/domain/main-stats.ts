import type { Profile, Character } from "./model";
import { mainStatGuides } from "../data/main-stat-guides";
export function assessMainStats(p: Profile, c: Character) {
  const guide = mainStatGuides[c.name];
  const applicable =
    !!guide &&
    (["砂糖", "爱诺"].includes(c.name)
      ? ["未知", "辅助"].includes(c.role)
      : c.name === "菲谢尔"
        ? ["未知", "后台输出"].includes(c.role)
        : c.name === "芭芭拉"
          ? c.role === "治疗"
          : c.name === "凯亚"
            ? c.role === "后台输出"
            : p.focus === "月感电");
  const gear = p.artifacts.filter((a) => a.owner === c.id);
  const rows = ["时之沙", "空之杯", "理之冠"].map((slot) => {
    const main = gear.find((a) => a.slot === slot)?.main ?? null,
      rule = guide?.slots[slot];
    const conditional = main ? rule?.conditional?.[main] : undefined;
    return {
      slot,
      main,
      recommended: rule?.preferred.join(" / ") ?? "暂无核实资料",
      status: !main
        ? "未知"
        : !applicable
          ? "待确认职责"
          : rule.preferred.includes(main)
            ? "符合方向"
            : conditional
              ? "需核实条件"
              : "建议调整",
      reason: !applicable
        ? `仅可参考${guide?.scope ?? "已核实职责"}，当前玩法未确认。`
        : !main
          ? "未读取该部位主词条，不按未装备处理。"
          : (conditional ??
            (rule.preferred.includes(main)
              ? "属于当前职责的常见选择，尚未比较副词条。"
              : `先比较已有的 ${rule.preferred.join(" / ")}；没有可继续用过渡装。`)),
    };
  });
  if (
    applicable &&
    c.name === "哥伦比娅" &&
    rows.every((r) => r.main === "生命值%")
  ) {
    const crown = rows[2];
    crown.status = "建议调整";
    crown.reason =
      "三生命组合不在指南推荐范围；优先比较已有暴击头，或在回能需要时比较充能沙 + 生命杯 + 生命头。";
  }
  return { guide, applicable, rows };
}
