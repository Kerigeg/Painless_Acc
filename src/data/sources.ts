export const sources = {
  lunar: {
    name: "KQM · 月反应机制",
    url: "https://keqingmains.com/misc/lunar-reactions/",
    version: "Luna VI；月感电与月兆",
  },
  sucrose: {
    name: "KQM · 砂糖",
    url: "https://keqingmains.com/q/sucrose-quickguide/",
    version: "Luna VI",
  },
  columbina: {
    name: "KQM · 哥伦比娅",
    url: "https://keqingmains.com/q/columbina-quickguide/",
    version: "7.0（仅复核后台月反应主词条）",
    checkedAt: "2026-09-28",
  },
  flins: {
    name: "KQM · 菲林斯",
    url: "https://keqingmains.com/q/flins-quickguide/",
    version: "Luna VI",
  },
  ineffa: {
    name: "KQM · 伊涅芙",
    url: "https://keqingmains.com/q/ineffa-quickguide/",
    version: "Luna V",
  },
  aino: {
    name: "KQM · 爱诺",
    url: "https://keqingmains.com/q/aino-quickguide/",
    version: "Luna I",
  },
  fischl: {
    name: "KQM · 菲谢尔",
    url: "https://keqingmains.com/q/fischl-quickguide/",
    version: "4.0；仅奥兹基础机制",
  },
  enka: {
    name: "Enka.Network · 原始 API 文档",
    url: "https://github.com/EnkaNetwork/API-docs/blob/master/docs/gi/api.md",
    version: "公开展柜 API；不代表完整账号",
  },
  materials: {
    name: "原神 BWIKI · 芭芭拉技能升级材料",
    url: "https://wiki.biligame.com/ys/芭芭拉",
    version: "页面未标游戏版本；仅核实天赋 1→2 材料",
  },
  barbara: {
    name: "KQM · 芭芭拉快速指南",
    url: "https://keqingmains.com/q/barbara-quickguide/",
    version: "3.2（仅采用基础治疗机制）",
  },
  kaeya: {
    name: "KQM · 凯亚快速指南",
    url: "https://keqingmains.com/q/kaeya-quickguide/",
    version: "6.1 / Luna II（后台冰伤）",
  },
  energy: {
    name: "KQM TCL · 能量机制",
    url: "https://library.keqingmains.com/combat-mechanics/energy",
    version: "页面未标游戏版本；基础能量机制",
  },
  damage: {
    name: "KQM TCL · 伤害公式",
    url: "https://library.keqingmains.com/combat-mechanics/damage/damage-formula",
    version: "页面未标游戏版本；常规伤害",
  },
  method: {
    name: "本站诊疗方法 v1",
    url: "#method",
    version: "经验规则 v1；非游戏数值结论",
  },
};
export type SourceKey = keyof typeof sources;
export const verified = "2026-09-19";
export const characterData = {
  芭芭拉: { role: "治疗", source: "barbara" },
  凯亚: { role: "后台输出", source: "kaeya" },
} as const;
export const symptoms = [
  "伤害低",
  "第二轮没能量",
  "容易死",
  "经常被打断",
  "不会操作",
  "清小怪准备太久",
  "材料不足",
  "任务卡住",
];
export const terms = {
  接球: "让需要能量的角色留在场上，等元素微粒飞到身上后再切人。",
  充能效率: "改变微粒／晶球转化为能量的倍率，不会增加战技产出的微粒数量。",
  主词条: "圣遗物最上方的主要属性。先看是否服务当前职责，再考虑套装与副词条。",
  后台: "切换到其他角色后，效果仍可持续。",
};
