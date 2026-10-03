import { assessMainStats } from "./main-stats";
import type { Profile, History } from "./model";
import type { Diagnosis } from "./rules";
import type { Task } from "./planner";
import {
  guideFor,
  lunarCharacters,
  normalizeName,
  teamTemplates,
} from "../data/characters";
export function lunarState(p: Profile) {
  const team = p.characters.filter((c) => p.team.includes(c.id));
  const supported = team.map((c) => guideFor(c.name));
  const unknown = team.filter(
    (c) => !guideFor(c.name) && !["芭芭拉", "凯亚"].includes(c.name),
  );
  const enablers = team.filter((c) => guideFor(c.name)?.enabler);
  const moon = team.filter((c) => guideFor(c.name)?.moon);
  return {
    team,
    unknown,
    enablers,
    moon,
    moonLevel: Math.min(2, moon.length),
    hydro: team.some(
      (c) => guideFor(c.name)?.element === "水" || c.name === "芭芭拉",
    ),
    electro: supported.some((c) => c?.element === "雷"),
    shield: team.some((c) => c.name === "伊涅芙" || c.role === "护盾"),
    active: p.focus === "月感电",
    fullMoon: moon.length >= 2,
  };
}
export function lunarDiagnoses(p: Profile): Diagnosis[] {
  if (p.focus !== "月感电") return [];
  const s = lunarState(p),
    out: Diagnosis[] = [];
  const add = (
    id: string,
    title: string,
    cause: string,
    evidence: string,
    action: string,
    teaching: string,
    status: Diagnosis["status"] = "疑似",
    source: Diagnosis["source"] = "lunar",
  ) =>
    out.push({
      id: `lunar-${id}`,
      title,
      status,
      symptom: p.symptoms.join("、") || "月感电专项检查",
      cause,
      evidence,
      action,
      teaching,
      source,
      missing: "同一场景的雷云、水覆盖、出手顺序及战斗面板记录",
      verify:
        "只改变一项；在已能应对的场景观察一轮，并记录无效或中断的具体位置。",
      scope: "仅已登记角色的月感电结构与操作排查；不计算整队伤害或命座收益",
    });
  if (!s.enablers.length)
    add(
      "enabler",
      "先确认谁开启月感电",
      "水雷反应不自动变为月感电",
      s.unknown.length
        ? "部分队员机制未收录，不能断言没有开启者"
        : "当前已知队员中没有菲林斯、伊涅芙或哥伦比娅",
      "检查当前队伍；爱诺只能提高月兆，不能单独完成转化。",
      "先满足反应转化条件，再检查伤害。没有已拥有的开启者时可继续普通感电，不要求抽卡。",
      s.unknown.length ? "待补充" : "已确认",
    );
  if (!s.hydro || !s.electro)
    add(
      "elements",
      "检查水与雷的实际覆盖",
      "已知队伍可能缺少反应所需的一侧",
      `已知水：${s.hydro ? "有" : "未确认"}；已知雷：${s.electro ? "有" : "未确认"}`,
      "先确认谁挂水、谁挂雷；未收录角色请补机制说明。",
      "有开启者仍需要敌人身上的水与雷，不能只看队伍里有月兆角色。",
      s.unknown.length ? "待补充" : "疑似",
    );
  if (s.enablers.length && !s.fullMoon)
    add(
      "moonsign",
      "月兆等级尚未确认达到二级",
      "某些角色与装备的二级月兆条件可能未满足",
      `已确认提高月兆的队员：${s.moon.map((c) => c.name).join("、") || "无"}`,
      "先核对已有第二位月兆角色；不用未拥有的角色凑模板。",
      "月兆等级与开启月感电是两件事。一级仍可触发，二级会改变部分效果。",
      s.unknown.length ? "待补充" : "已确认",
    );
  if (["中断", "未出现"].includes(p.lunar.cloud) || p.lunar.hydro === "中断")
    add(
      "coverage",
      "先复核雷云与挂水断点",
      "反应附着或技能覆盖可能中断",
      `雷云：${p.lunar.cloud}；水覆盖：${p.lunar.hydro}`,
      "保持装备不变，逐段记录谁的后台技能先结束。",
      "雷云出现过不代表整轮持续有效；先检查附着，再考虑精通或暴击。",
    );
  const flins = s.team.find((c) => c.name === "菲林斯");
  if (
    flins &&
    (p.lunar.flinsSwap === "是" ||
      p.lunar.flinsBurst === "普通爆发" ||
      p.symptoms.includes("不会操作"))
  )
    add(
      "flins",
      "菲林斯先练短爆发窗口",
      "提前切人或未进入特殊爆发窗口可能打断输出段",
      `中途切人：${p.lunar.flinsSwap}；使用爆发：${p.lunar.flinsBurst}`,
      "队友技能先铺好；菲林斯开启战技后，特殊战技→短爆发，先只练一段。",
      "短爆发与普通爆发的消耗和节奏不同；不能用一个固定充能阈值解释所有情况。",
      "疑似",
      "flins",
    );
  const aino = s.team.find((c) => c.name === "爱诺");
  if (aino && p.symptoms.includes("第二轮没能量"))
    add(
      "aino-energy",
      "爱诺先保住下一轮挂水",
      "爆发回能不足可能造成水覆盖空窗",
      `爱诺充能：${aino.panel.er ?? "未知"}%；面板来源：${aino.panel.kind}`,
      "记录战技接球与爆发空窗，再比较已有充能散件。",
      "这里的目标是稳定供水，不是给爱诺凑统一双爆标准。",
      "疑似",
      "aino",
    );
  if (
    s.team.some((c) => c.name === "哥伦比娅") &&
    p.symptoms.includes("第二轮没能量")
  )
    add(
      "columbina-energy",
      "哥伦比娅不必强求每轮爆发",
      "循环预期可能超过当前回能条件",
      "存在第二轮能量等待反馈",
      "先保留战技覆盖；尝试隔轮爆发并记录队伍舒适度。",
      "按当前玩法决定爆发频率，不将未满能量直接归因于装备。",
      "疑似",
      "columbina",
    );
  for (const c of s.team) {
    const g = guideFor(c.name);
    if (!g) continue;
    const bad = p.artifacts.find(
      (a) =>
        a.owner === c.id &&
        a.slot === "空之杯" &&
        assessMainStats(p, c).rows.some(
          (r) => r.slot === a.slot && r.status === "建议调整",
        ) &&
        ((["菲林斯", "伊涅芙"].includes(c.name) && a.main === "雷元素伤害%") ||
          (c.name === "哥伦比娅" && a.main === "水元素伤害%")),
    );
    if (bad)
      add(
        `goblet-${c.id}`,
        `${c.name}：先区分普通伤害与月感电`,
        "元素伤害杯不直接放大月感电部分",
        `已装备 ${bad.main}；套装 ${bad.set || "未知"}`,
        "只比较已有同部位散件，保持其余配置再观察；不立即刷取。",
        g.stats,
        "疑似",
        g.source,
      );
  }
  if (
    s.team.some((c) => c.name === "砂糖") &&
    s.team.some((c) => c.name === "菲谢尔") &&
    p.lunar.hexerei === "未知"
  )
    add(
      "hexerei",
      "魔导相关效果暂不计入",
      "解锁条件未确认",
      "砂糖与菲谢尔同队；魔导解锁情况未知",
      "补录解锁状态；本站仍不计算魔导数值。",
      "角色同队不能替代解锁确认，不将未核实效果加到面板。",
      "待补充",
      "sucrose",
    );
  if (!s.shield && p.symptoms.some((x) => ["容易死", "经常被打断"].includes(x)))
    add(
      "survival",
      "当前月感电队先处理生存",
      "反应配置并不自动提供护盾或治疗",
      "未确认护盾；用户反馈容易死或打断",
      "优先已有可用生存角色和躲避；不为套模板牺牲舒适度。",
      "已拥有但待培养的角色不会被推荐为立即可用的救场方案。",
    );
  if (!out.length)
    add(
      "verify",
      "结构已具备，先验证一轮实际循环",
      "队伍结构完整不代表技能覆盖已验证",
      `开启者：${s.enablers.map((c) => c.name).join("、")}；已确认月兆至少 ${s.moonLevel} 级`,
      "在安全场景记录一轮雷云、水覆盖和能量等待。",
      "先证明循环可重复，再决定是否增加投入。",
      "待补充",
    );
  return out;
}
export function lunarTasks(p: Profile): Task[] {
  if (p.focus !== "月感电") return [];
  const s = lunarState(p);
  const blockers: string[] = [];
  if (!s.enablers.length) blockers.push("尚未确认月感电开启者");
  if (!s.hydro || !s.electro) blockers.push("水／雷角色未齐全");
  if (s.team.some((c) => !guideFor(c.name)))
    blockers.push("当前队伍包含尚未支持的角色机制，先补充或选已支持配置");
  if (s.team.some((c) => c.ready !== "可用"))
    blockers.push("当前队员尚未全部确认可用，不使用待培养队伍作战");
  if (p.lunar.safeScene !== "已确认") blockers.push("请确认已有低风险场景");
  if (!p.region.trim()) blockers.push("请填写已解锁的练习地区");
  if ((p.minutes ?? 0) < 1) blockers.push("至少需要1分钟时间预算");
  const flins = s.team.some((c) => c.name === "菲林斯");
  const ordered = [
    "伊涅芙",
    "哥伦比娅",
    "爱诺",
    "菲谢尔",
    "砂糖",
    "菲林斯",
  ].filter((name) => s.team.some((c) => c.name === name));
  return [
    {
      id: "lunar-cycle",
      title: flins
        ? "月感电 · 后台铺场到菲林斯短爆发"
        : s.team.some((c) => c.name === "砂糖")
          ? "月感电 · 砂糖与后台技能衔接"
          : "月感电 · 当前队伍覆盖观察",
      problem: "以当前实际队伍验证月感电，不要求补角色或刷装备",
      depends: ["baseline"],
      team: s.team.map((c) => c.id),
      blocked: blockers,
      steps: [
        "先固定敌人、世界等级和装备；只观察一轮，不为测伤主动承受攻击。",
        ...ordered.map((name) => `${name}：${guideFor(name)!.steps.join(" ")}`),
        "观察雷云与水覆盖，在月感电专题补录中断位置；记录等待、死亡和舒适度，然后反馈。",
      ],
      accept:
        "完成一轮观察并记录水覆盖、雷云与能量；未改善可反馈，不把结构达标当作通关成功。",
      stop: "达到本阶段时间预算或血线危险立即结束；一次仅改一项，够用即停止。",
      budget: `最多 ${Math.min(p.minutes ?? 0, 10)} 分钟；0树脂 / 0摩拉 / 0材料；随机刷取预算0。`,
      location: `用户已解锁地区：${p.region || "未知"}；仅在已确认能应对的场景，不前往新首领或秘境。`,
      alternatives:
        "未解锁或打不过：退回角色菜单检查配置。无开启者：继续普通感电。没刷到：保留现有散件。操作困难：只练挂水→挂雷→观察，暂缓完整连招。",
      source: "lunar",
      growth: s.team.map(
        (c) =>
          `${c.name}：等级 ${c.level ?? "未知"} / 突破 ${c.ascension ?? "未知"} → 本阶段保持；${guideFor(c.name)?.talents ?? "机制未支持，暂缓投入"} ${guideFor(c.name)?.stats ?? ""}`,
      ),
      fingerprint: JSON.stringify(p),
    },
  ];
}
export function templateAvailability(p: Profile, id: string) {
  const t = teamTemplates.find((t) => t.id === id)!;
  const chars = t.names.map((name) =>
    p.characters.find((c) => normalizeName(c.name) === name),
  );
  const missing = t.names.filter((_, i) => !chars[i]);
  const unready = chars
    .filter((c) => c && c.ready !== "可用")
    .map((c) => c!.name);
  const ids = chars.filter((c) => !!c).map((c) => c!.id);
  const kept = p.keep.filter((id) => !ids.includes(id));
  return {
    template: t,
    ids,
    missing,
    unready,
    kept,
    usable: !missing.length && !unready.length && !kept.length,
  };
}
