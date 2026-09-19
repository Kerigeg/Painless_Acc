import { lunarDiagnoses } from "./lunar";
import type { Profile, History } from "./model";
import type { SourceKey } from "../data/sources";
export type Diagnosis = {
  id: string;
  title: string;
  status: "已确认" | "疑似" | "待补充";
  symptom: string;
  cause: string;
  evidence: string;
  missing: string;
  verify: string;
  action: string;
  teaching: string;
  source: SourceKey;
  scope: string;
};
export function diagnose(p: Profile, history: History[] = []): Diagnosis[] {
  const out: Diagnosis[] = [...lunarDiagnoses(p)];
  const add = (
    id: string,
    title: string,
    symptom: string,
    cause: string,
    evidence: string,
    action: string,
    teaching: string,
    source: SourceKey = "method",
    status: Diagnosis["status"] = "疑似",
    missing = "同一场景的改动前后记录",
    verify = "只改一项，重复同一场景，记录等待、死亡和舒适度",
  ) =>
    out.push({
      id,
      title,
      status,
      symptom,
      cause,
      evidence,
      missing,
      verify,
      action,
      teaching,
      source,
      scope:
        source === "method"
          ? "通用经验筛查，不代表角色强度"
          : source === "barbara"
            ? "芭芭拉纯治疗；不覆盖反应输出玩法"
            : "常规微粒回能／凯亚后台玩法",
    });
  const team = p.characters.filter((c) => p.team.includes(c.id));
  if (!team.length || !p.symptoms.length)
    add(
      "unknown",
      "先补齐这次冒险的问题",
      "信息不足",
      "无法建立可验证的候选原因",
      `已录入 ${team.length} 位队员、${p.symptoms.length} 项症状`,
      "填写目标、至少一个症状并确认当前队伍",
      "不知道就留空。未知等级不等于等级 0，未录入角色不等于没有该角色。",
      "method",
      "待补充",
      "目标场景、症状、当前队伍",
    );
  for (const c of team) {
    if (
      p.ar !== null &&
      p.ar >= 25 &&
      ((c.level !== null && c.level < 40) ||
        (c.weapon.level !== null && c.weapon.level < 40))
    )
      add(
        `investment-${c.id}`,
        `${c.name}：基础投入值得检查`,
        "伤害或容错不足",
        "等级或武器投入可能限制表现",
        `冒险等阶 ${p.ar}；角色 ${c.level ?? "未知"}；武器 ${c.weapon.level ?? "未知"}`,
        "先核对等级上限与现有材料，再决定是否只培养这一位",
        "40 级仅为冒险等阶 25 以上的排查触发值，不是毕业线。先做零成本调整，升级费用未知时不安排刷取。",
      );
    const key = c.name === "芭芭拉" ? 1 : c.name === "凯亚" ? 2 : null;
    if (
      key !== null &&
      c.level !== null &&
      c.level >= 40 &&
      c.talents[key] !== null &&
      c.talents[key]! <= 1
    )
      add(
        `talent-${c.id}`,
        `${c.name}：关键天赋尚未投入`,
        "关键技能效果弱",
        "关键天赋仍为 1 级",
        `等级 ${c.level}；${key === 1 ? "战技" : "爆发"} ${c.talents[key]}`,
        "打开天赋页核对可升级条件，优先于无目的刷圣遗物",
        "职责决定投入顺序；先确认能否升级，材料不足时保留当前等级练习。",
        c.name === "芭芭拉" ? "barbara" : "kaeya",
        "已确认",
      );
  }
  if (p.symptoms.includes("第二轮没能量"))
    add(
      "energy",
      "先找能量去了哪里",
      "第二轮没能量",
      "漏放战技、接球对象或循环长度可能不合适",
      `用户反馈；出手顺序：${p.rotation || "未知"}`,
      "先记录一次完整循环，再练习接球",
      "像把包裹送给正确的人：先确认谁收到微粒，再考虑提高充能效率。",
      "energy",
      "疑似",
      "充能面板、产球次数、接球角色、循环时长",
    );
  if (p.symptoms.some((s) => ["容易死", "经常被打断"].includes(s)))
    add(
      "survival",
      "先让这场战斗安全下来",
      "容易死／被打断",
      "治疗空窗、躲避时机或抗打断可能不足",
      `队伍治疗／护盾职责：${
        team
          .filter((c) => ["治疗", "护盾"].includes(c.role))
          .map((c) => c.name)
          .join("、") || "未确认"
      }`,
      "先保留闪避体力；已有可用治疗时再练恢复窗口",
      "治疗不能自动提供抗打断。频繁倒地时先缩短站场与躲避，不把换双爆装备当作解法。",
    );
  if (
    team.length &&
    team.every((c) => c.role !== "未知") &&
    !team.some((c) => ["治疗", "护盾"].includes(c.role))
  )
    add(
      "gap",
      "队伍缺少已声明的生存职责",
      "队伍功能检查",
      "没有声明治疗或护盾",
      team.map((c) => `${c.name}：${c.role}`).join("；"),
      "从已拥有且可用的角色中检查生存选项；未知能力先补资料",
      "功能缺口是相对当前困难的，不要求每支队伍必须带治疗。",
      "method",
      "已确认",
    );
  if (team.filter((c) => c.role === "站场输出").length > 1)
    add(
      "field",
      "多位角色都需要站场",
      "队伍节奏不顺",
      "站场时间可能冲突",
      team
        .filter((c) => c.role === "站场输出")
        .map((c) => c.name)
        .join("、"),
      "先明确一位主要站场角色；希望保留的角色不自动替换",
      "一个时刻只能操作一位角色，先减少等待再判断伤害。",
    );
  const b = team.find((c) => c.name === "芭芭拉" && c.role === "治疗");
  if (
    b &&
    p.artifacts.some(
      (a) =>
        a.owner === b.id &&
        ["时之沙", "空之杯", "理之冠"].includes(a.slot) &&
        a.main &&
        !["生命值%", "治疗加成%"].includes(a.main),
    )
  )
    add(
      "artifact",
      "治疗装备与职责可能不一致",
      "治疗容错不足",
      "主词条可能偏向其他玩法",
      "芭芭拉治疗职责；部分主词条不是生命或治疗",
      "先比较已有同部位生命／治疗散件",
      "只比较纯治疗用途，不评价反应队或输出玩法。",
      "barbara",
    );
  if (b && p.enemy.includes("冰"))
    add(
      "freeze-risk",
      "冰攻击环境：留意自身潮湿",
      "冰环境下容易失去行动能力",
      "芭芭拉战技的潮湿可能增加冻结风险",
      `敌人描述：${p.enemy}；芭芭拉承担治疗`,
      "先避免在冰攻击窗口开战技，记录是否被冻住",
      "这是环境适配问题；不建议靠增加生命来解决冻结。",
      "barbara",
    );
  if (p.enemy || p.symptoms.includes("任务卡住"))
    add(
      "enemy",
      "先核对敌人与任务条件",
      "敌人／任务适配",
      "免疫、护盾或任务机制可能影响体验",
      `目标：${p.enemy || p.difficulty || "未填写"}`,
      "补充敌人名称、任务提示与失败步骤",
      "机制信息缺失时，不把卡关归咎于角色练度。",
      "method",
      "待补充",
      "敌人机制、任务阶段及解锁情况",
    );
  if (p.goal === "大世界" && p.symptoms.includes("清小怪准备太久"))
    add(
      "startup",
      "小战斗不必启动完整循环",
      "清小怪准备太久",
      "过度依赖爆发与长准备",
      `目标：${p.goal}；症状由用户报告`,
      "试一次只用战技与普通攻击的短战斗",
      "验收是过程舒适、能继续探索，不是单次伤害最高。",
    );
  if (
    p.investing !== null &&
    p.investing > 4 &&
    p.symptoms.includes("材料不足")
  )
    add(
      "resources",
      "先收拢这一阶段的投入",
      "材料不足",
      "并行培养目标过多",
      `同时培养 ${p.investing} 位`,
      "本阶段只选一个瓶颈，其他培养暂缓",
      "这是预算管理建议，不是断言所有材料不足都来自分散。",
    );
  if (p.symptoms.includes("不会操作"))
    add(
      "controls",
      "把手法缩短到能稳定完成",
      "不会操作",
      "连招复杂度可能超出当前偏好",
      `${p.device}；偏好：${p.preference || "未填写"}`,
      "取消取消后摇等进阶操作，先做战技→等接球→切人",
      "稳定重复比一次完成复杂连招更适合检查问题。",
    );
  if (team.some((c) => c.level === null || c.role === "未知"))
    add(
      "details",
      "部分队员资料仍然未知",
      "信息不足",
      "无法确认投入与职责",
      team
        .filter((c) => c.level === null || c.role === "未知")
        .map((c) => c.name)
        .join("、"),
      "在精确档案中补等级和职责；也可以继续保留未知",
      "不会用空白字段推断角色未培养。",
      "method",
      "待补充",
      "角色等级、职责、装备与原始面板",
    );
  if (!out.length)
    add(
      "review",
      "目前没有命中明确瓶颈",
      "尚无足够证据",
      "规则覆盖有限，不能据此证明账号没有问题",
      "已填写数据未命中首版规则",
      "记录一次具体困难后再诊断",
      "首版不是战斗模拟器，也不提供统一账号分数。",
      "method",
      "待补充",
    );
  return out.map((d) => {
    const related = d.id.startsWith("lunar-")
      ? "lunar-cycle"
      : d.id === "energy"
        ? "kaeya"
        : d.id === "survival" || d.id === "artifact"
          ? "barbara"
          : `check-${d.id}`;
    const last = history
      .filter(
        (h) => h.taskId === related && h.fingerprint === JSON.stringify(p),
      )
      .at(-1);
    if (last?.feedback === "完成，没有改善")
      return {
        ...d,
        status: "待补充" as const,
        evidence: d.evidence + "；用户照做无效，原判断未被验证",
        action: "暂停追加投入；补充同场景记录，重新核查其他候选原因",
      };
    return d;
  });
}
