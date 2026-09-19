import type { SourceKey } from "./sources";
export const normalizeName = (name: string) =>
  ({ 皇女: "菲谢尔", "菲谢尔（皇女）": "菲谢尔", 伊涅夫: "伊涅芙" })[
    name.trim()
  ] ?? name.trim();
export type CharacterGuide = {
  name: string;
  element: "风" | "水" | "雷";
  role: "辅助" | "后台输出" | "站场输出" | "护盾";
  moon: boolean;
  enabler: boolean;
  source: SourceKey;
  summary: string;
  talents: string;
  stats: string;
  steps: string[];
  caution: string;
};
export const lunarCharacters: CharacterGuide[] = [
  {
    name: "砂糖",
    element: "风",
    role: "辅助",
    moon: false,
    enabler: false,
    source: "sucrose",
    summary: "扩散、精通分享与聚怪；可辅助菲林斯，或在无菲林斯队伍站场。",
    talents: "先验证扩散与增益覆盖；不为了月感电盲目升级普攻。",
    stats:
      "通常先用已有精通装；翠绿之影四件需实际触发对应扩散，不能把风伤加成当月感电加成。",
    steps: [
      "先让水、雷队友施加元素。",
      "砂糖上场施放战技，确认扩散后交给主力；无主力时再用普通攻击站场。",
    ],
    caution: "风伤角色不自动等于月感电触发器；不模拟扩散附着量或魔导增益。",
  },
  {
    name: "哥伦比娅",
    element: "水",
    role: "后台输出",
    moon: true,
    enabler: true,
    source: "columbina",
    summary: "开启月感电，战技提供后台水与直接月反应伤害，爆发提供增益。",
    talents: "后台玩法看战技与爆发；爆发是否每轮施放先看实际回能。",
    stats:
      "先保证所选循环的回能；生命、暴击可考虑，充能沙视需求；不把水伤杯直接等同月感电增伤。",
    steps: [
      "先用战技维持后台水。",
      "本轮计划用爆发且能量足够时再放；记录下一轮是否需要等待。",
    ],
    caution: "仅支持后台月感电，不支持站场月绽放；不强制每轮爆发。",
  },
  {
    name: "菲林斯",
    element: "雷",
    role: "站场输出",
    moon: true,
    enabler: true,
    source: "flins",
    summary: "站场直接月感电输出；战技状态下有特殊战技和短爆发。",
    talents:
      "先核查爆发，再考虑等级与战技；强化普攻按战技倍率，不盲升普通攻击天赋。",
    stats:
      "常见方向为攻击沙／攻击杯、暴击头，精通散件可过渡；先解决循环，雷伤杯不增加月感电伤害。",
    steps: [
      "队友先铺好后台技能，再让菲林斯开启战技状态。",
      "施放特殊战技后，在有效窗口内使用短爆发；用普通攻击衔接，先练一次完整段落。",
    ],
    caution:
      "切走会结束战技状态；先按低操作要求练习，不强制固定次数或命座连招。",
  },
  {
    name: "伊涅芙",
    element: "雷",
    role: "护盾",
    moon: true,
    enabler: true,
    source: "ineffa",
    summary: "开启月感电；提供护盾、后台雷与直接月感电伤害。",
    talents: "等级影响反应部分；战技关系护盾。先区分护盾不足和伤害不足。",
    stats: "攻击沙／攻击杯、暴击头是常见方向；精通可过渡，爆发回能按循环验证。",
    steps: [
      "先施放战技建立护盾与后台攻击。",
      "确认水雷反应后再交给站场角色；爆发按能量计划使用。",
    ],
    caution: "护盾不等于治疗；不要把全部伤害视为普通战技伤害。",
  },
  {
    name: "爱诺",
    element: "水",
    role: "辅助",
    moon: true,
    enabler: false,
    source: "aino",
    summary: "爆发提供后台水并提高月兆等级；自身不能将感电转成月感电。",
    talents: "挂水职责先保证爆发循环，天赋投入再看实际需求。",
    stats: "充能沙或已有精通装过渡；西风武器另看暴击触发，不给固定充能毕业线。",
    steps: [
      "先确认队里已有月感电开启者。",
      "施放爆发与战技，观察水覆盖是否持续到主力输出结束。",
    ],
    caution: "C1／C6效果不能按默认拥有处理；未充好爆发时先记录能量问题。",
  },
  {
    name: "菲谢尔",
    element: "雷",
    role: "后台输出",
    moon: false,
    enabler: false,
    source: "fischl",
    summary: "皇女；奥兹提供后台雷与产球，是月感电体系的可选队员。",
    talents: "奥兹对应战技优先；先保证召唤衔接，不为了反应改成全精通。",
    stats:
      "保留兼顾普通雷伤的常规输出装；雷伤杯不能一概判错，不能照搬伊涅芙的套装评价。",
    steps: [
      "用战技召唤奥兹后切到其他角色。",
      "奥兹退场后，按爆发可用情况衔接下一次召唤，不把战技与爆发无脑同时交掉。",
    ],
    caution: "4.0资料仅用于基础奥兹机制；新魔导效果未自动计入。",
  },
];
export const guideFor = (name: string) =>
  lunarCharacters.find((c) => c.name === normalizeName(name));
export const teamTemplates = [
  {
    id: "flins-columbina",
    name: "菲林斯站场 · 护盾与后台水",
    names: ["菲林斯", "哥伦比娅", "伊涅芙", "砂糖"],
    source: "flins" as SourceKey,
  },
  {
    id: "flins-aino",
    name: "菲林斯站场 · 爱诺供水",
    names: ["菲林斯", "爱诺", "伊涅芙", "砂糖"],
    source: "flins" as SourceKey,
  },
  {
    id: "sucrose-driver",
    name: "砂糖站场 · 奥兹与后台核心",
    names: ["砂糖", "哥伦比娅", "伊涅芙", "菲谢尔"],
    source: "ineffa" as SourceKey,
  },
];
