import { mainStatGuides } from "../data/main-stat-guides";
import { lunarMainStats } from "../data/equipment";
import { guideFor } from "../data/characters";
import { lunarTasks } from "./lunar";
import type { SourceKey } from "../data/sources";
import { barbaraSkillUpgrade as upgrade } from "../data/upgrades";
import type { Profile, History, Artifact } from "./model";
import { diagnose } from "./rules";
import { materialGap } from "./math";
import { tutorials } from "../data/tutorials";
export type Task = {
  id: string;
  title: string;
  problem: string;
  depends: string[];
  team: string[];
  blocked: string[];
  steps: string[];
  accept: string;
  stop: string;
  budget: string;
  location: string;
  alternatives: string;
  source: SourceKey;
  growth: string[];
  fingerprint: string;
};
export const fingerprint = (p: Profile) => JSON.stringify(p);
export function plan(p: Profile, history: History[] = []): Task[] {
  const fp = fingerprint(p),
    d = diagnose(p, history);
  const team = p.characters.filter(
    (c) => p.team.includes(c.id) && c.ready === "可用",
  );
  const base: Task = {
    id: "baseline",
    title: "记录一次，作为比较起点",
    problem: "避免把不同敌人或队伍误当作改善",
    depends: [],
    team: team.map((c) => c.id),
    blocked: [],
    steps: [
      "在反馈页填写固定场景与改动前记录。",
      "后续每次只改变一项，尽量保持队伍、敌人、世界等级和增益一致。",
    ],
    accept: "已记录场景和至少一项观察值；这是用户观察，不是模拟结果。",
    stop: "无需战斗也能补录；不清楚的数据留空。",
    budget: "0 树脂 / 0 摩拉 / 0 材料；记录不要求游戏在线",
    location: "本页反馈与历史；使用自己已体验过的场景",
    alternatives: "无法回忆就留空，下次安全战斗再记录。",
    source: "method",
    growth: [],
    fingerprint: fp,
  };
  const out = [base, ...lunarTasks(p)];
  for (const t of p.focus === "月感电" ? [] : tutorials) {
    const c = p.characters.find((c) => c.name === t.character);
    if (!c) continue;
    const relevant =
      t.id === "barbara"
        ? d.some((x) => ["survival", "artifact", "gap"].includes(x.id))
        : d.some((x) => ["energy", "startup", "controls"].includes(x.id));
    if (!relevant) continue;
    const blockers: string[] = [];
    if (c.ready !== "可用")
      blockers.push(`${c.name}尚未确认可用，不要求用待培养队伍获取材料`);
    if (t.id === "barbara" && c.role !== "治疗")
      blockers.push("本教程仅支持纯治疗职责，请先确认职责");
    if (p.mondstadt !== "已解锁") blockers.push("蒙德解锁情况未满足");
    if (!team.length) blockers.push("没有确认可用的当前队员");
    if (p.minutes === null || p.minutes < 1)
      blockers.push("请先填写至少 1 分钟可用时间");
    const reserved = p.characters.some(
      (y) => y.name === "芭芭拉" && y.role === "治疗" && y.talents[1] === 1,
    )
      ? 1
      : 0;
    const allocation = Math.floor(
      Math.max(0, (p.minutes ?? 0) - reserved) /
        Math.max(
          1,
          tutorials.filter((x) =>
            p.characters.some((y) => y.name === x.character),
          ).length,
        ),
    );
    if (allocation < 1)
      blockers.push("本阶段时间不足以分配给此练习，请增加预算或分次进行");
    if (!p.team.includes(c.id))
      blockers.push("请先手动将目标角色加入当前队伍，保留角色不会被自动替换");
    const execution = [
      c.id,
      ...team.map((x) => x.id).filter((id) => id !== c.id),
    ].slice(0, 4);
    if (p.keep.some((id) => p.team.includes(id) && !execution.includes(id)))
      blockers.push("候选队伍无法保留你的指定角色，请先手动调整");
    out.push({
      id: t.id,
      title: t.name,
      problem: t.why,
      depends: ["baseline"],
      team: execution,
      blocked: blockers,
      steps: t.steps,
      accept: t.accept,
      stop: t.stop,
      budget: `最多 ${Math.min(allocation, 10)} 分钟；0 树脂 / 0 摩拉 / 0 材料。随机刷取预算：0；没刷到不阻塞。`,
      location: t.location,
      alternatives:
        "未解锁：只看装备页和教程。打不过：停止战斗，改在安全地带观察或用已可用队伍。缺材料／没刷到：保留现有散件。操作困难：只做一个战技后观察。",
      source: t.source === "barbara" ? "barbara" : "kaeya",
      growth: t.growth.map((s) =>
        s.startsWith("等级")
          ? `当前等级 ${c.level ?? "未知"} / 突破 ${c.ascension ?? "未知"} → 本阶段保持；${s.split("：")[1]}`
          : s,
      ),
      fingerprint: fp,
    });
  }

  const healer = p.characters.find(
    (c) => c.name === "芭芭拉" && c.role === "治疗",
  );
  if (
    healer &&
    healer.talents[1] === 1 &&
    out.some((t) => t.id === "barbara")
  ) {
    const gaps = {
      摩拉: materialGap(
        p.mora !== null && Number.isInteger(p.mora) && p.mora >= 0
          ? p.mora
          : null,
        upgrade.cost.mora,
      ),
      自由的教导: materialGap(
        p.inventory.freedom !== null &&
          Number.isInteger(p.inventory.freedom) &&
          p.inventory.freedom >= 0
          ? p.inventory.freedom
          : null,
        upgrade.cost.freedom,
      ),
      导能绘卷: materialGap(
        p.inventory.scroll !== null &&
          Number.isInteger(p.inventory.scroll) &&
          p.inventory.scroll >= 0
          ? p.inventory.scroll
          : null,
        upgrade.cost.scroll,
      ),
    };
    const blockers = Object.entries(gaps)
      .filter(([, v]) => v === null || v > 0)
      .map(([k, v]) => k + "缺口：" + (v ?? "未知"));
    if (
      healer.ascension === null ||
      healer.ascension < upgrade.minAscension ||
      healer.level === null ||
      healer.level < upgrade.minLevel
    )
      blockers.push("需要确认等级至少40、突破至少2；不安排突破材料获取");
    if (healer.ready !== "可用") blockers.push("芭芭拉未确认可用");
    if ((p.minutes ?? 0) < 3) blockers.push("至少预留3分钟总预算");
    out.push({
      ...base,
      id: "barbara-talent",
      title: "仍需更多治疗时：战技 1 → 2",
      problem: "操作与现有装备已验证有效，但治疗仍不足时，做一个确定性的小投入",
      depends: ["baseline", "barbara"],
      team: [],
      blocked: blockers,
      steps: [
        "只有你仍觉得治疗不足才执行；已经够用请反馈结束阶段。",
        "打开芭芭拉→天赋→演唱，开始♪。核对当前为1级、目标2级，费用与下方一致；不一致即停止。",
        "仅使用库存中的3本自由的教导、6个导能绘卷和12500摩拉，提升战技一级；不合成、不购买、不花树脂。",
        "游戏内完成后，先提交本任务反馈，再在账号档案手动更新战技等级、摩拉与材料库存；未执行不能标为完成。",
      ],
      accept:
        "游戏内战技显示2级；剩余库存已核对，随后更新档案。治疗是否足够由用户反馈。",
      stop: "只升一级；成本、等级限制或库存与记录不符立即停止。",
      budget:
        "最多1分钟菜单操作；树脂0；确定性消耗：摩拉12500、自由的教导3、导能绘卷6。" +
        Object.entries(gaps)
          .map(([k, v]) => k + "缺口 " + (v ?? "未知"))
          .join("；"),
      location:
        "任何安全地区的角色菜单→芭芭拉→天赋。不前往秘境；库存不足使用零投入过渡。",
      alternatives:
        "缺材料或未突破：保留1级战技及现有散件，不要求先用未培养队伍刷材料。回到恢复窗口与闪避练习。",
      source: "materials",
      growth: [
        "角色 " +
          (healer.level ?? "未知") +
          " / 突破 " +
          (healer.ascension ?? "未知") +
          " → 保持；不跨突破。",
        "普攻、爆发保持当前等级；战技1 → 2。",
        "武器和圣遗物保持当前分配，职责为纯治疗；战技→切回可用主力。",
      ],
    });
  }
  for (const x of d
    .filter(
      (x) =>
        !x.id.startsWith("lunar-") &&
        !x.id.startsWith("showcase-") &&
        !["unknown", "details"].includes(x.id),
    )
    .slice(0, 3)) {
    if (
      (x.id === "energy" && out.some((t) => t.id === "kaeya")) ||
      (x.id === "survival" && out.some((t) => t.id === "barbara"))
    )
      continue;
    out.push({
      ...base,
      id: `check-${x.id}`,
      title: x.action,
      problem: x.cause,
      depends: ["baseline"],
      steps: [
        x.action,
        x.verify,
        "在反馈页记录本次尝试；足够好即可结束本阶段。",
      ],
      accept: "完成核查并记录结果；未改善需要重审原因",
      budget: "仅检查与现有装备调整；0 树脂 / 0 摩拉 / 0 材料",
      source: "method",
    });
  }
  return out.map((t) => {
    const last = history
      .filter((h) => h.taskId === t.id && h.fingerprint === fp)
      .at(-1);
    if (!last) return t;
    const msg = response(last.feedback);
    if (last.feedback === "完成，有改善" || last.feedback === "现在已经够用了")
      return t;
    return {
      ...t,
      title:
        last.feedback === "完成，没有改善" ? `重新核查：${t.title}` : t.title,
      problem: msg,
      steps:
        last.feedback === "没看懂"
          ? [
              "先打开角色菜单，找到本任务的角色。",
              "只看本任务第一步；完成后再看下一步。",
              ...t.steps,
            ]
          : last.feedback === "操作不出来"
            ? [
                "只按一次战技，等效果出现，不做连招。",
                "安全后记录观察；不要求完成完整循环。",
              ]
            : last.feedback === "完成，没有改善"
              ? [
                  "暂停养成投入，原候选原因未得到支持。",
                  "核对同场景、同队伍、同增益；补充能量与技能使用记录。",
                  "修改档案后重新诊断，优先排查其他候选原因。",
                ]
              : [msg, "不消耗新材料；完成过渡检查后再反馈。"],
      location: ["未解锁", "打不过"].includes(last.feedback)
        ? "安全地带／角色菜单，不前往目标战斗"
        : t.location,
    };
  });
}
export function completed(task: Task, history: History[]) {
  const last = history
    .filter((h) => h.taskId === task.id && h.fingerprint === task.fingerprint)
    .at(-1);
  return !!last && ["完成，有改善", "现在已经够用了"].includes(last.feedback);
}
export function blocked(task: Task, tasks: Task[], history: History[]) {
  return [
    ...task.blocked,
    ...task.depends
      .filter((id) => !tasks.some((t) => t.id === id && completed(t, history)))
      .map((id) => "先完成：" + (tasks.find((t) => t.id === id)?.title ?? id)),
  ];
}
export function response(feedback: History["feedback"]) {
  return {
    "完成，有改善": "保留这次有效调整，再看下一项瓶颈。",
    "完成，没有改善":
      "原判断未得到验证：停止追加投入，核查场景、装备与接球记录；补充数据后重新诊断。",
    没看懂:
      "更简单地做：先打开角色页确认装备，再只按一次战技，观察发生了什么。",
    操作不出来:
      "简化手法：取消连招与快速切换，一次只按一个技能，等效果出现再继续。",
    缺材料: "使用现有武器和散件，暂停升级；本阶段任务不要求领取材料。",
    未解锁: "切换过渡方案：只检查角色菜单，不前往未解锁地区。",
    打不过: "停止重复挑战，退回安全场景；只使用已经确认可用的队伍。",
    没刷到: "刷取预算已经停止；用现有可接受散件继续，不以随机掉落为前置。",
    现在已经够用了:
      "本阶段结束。保留记录；目标或关键资料变化后再开始下一阶段。",
  }[feedback];
}
export function compareArtifacts(
  old: Artifact | undefined,
  next: Artifact,
  role: string,
  characterName?: string,
) {
  if (!old) return "没有同部位现有装备，只能检查合法性，无法比较替换价值。";
  if (old.slot !== next.slot) return "只能比较同一部位。";
  if (old.main === null || next.main === null)
    return "主词条仍有未知，先补充后再比较，不把未知当作较差配置。";
  const guide = characterName ? guideFor(characterName) : undefined;
  const options = guide ? lunarMainStats[guide.name]?.[next.slot] : undefined;
  if (options) {
    const candidate = options.includes(next.main),
      current = options.includes(old.main);
    return (
      (candidate && !current
        ? "候选主词条更接近当前月感电职责的常见方向，可先试穿；"
        : "仅凭主词条不能确认哪件更优，先保留当前装备；") +
      (mainStatGuides[guide!.name]?.slots[next.slot]?.conditional?.[
        next.main
      ] ??
        mainStatGuides[guide!.name]?.note ??
        guide!.stats) +
      " 请按体检中的逐部位条件复核。 本次未计强化、套装、武器和副词条，不保证数值提升，随机刷取预算0。"
    );
  }
  if (role !== "治疗")
    return "首版仅对纯治疗生命／治疗主词条做条件比较；此职责不支持数值排名。";
  const helpful = (a: Artifact) =>
    ["生命值%", "治疗加成%"].includes(a.main ?? "");
  if (helpful(next) && !helpful(old))
    return "候选主词条更符合纯治疗方向；先试穿并复测。未计入强化数值、套装与副词条，不保证整体提升。";
  return "仅凭主词条无法确定更优；保留当前装备，比较实际治疗与舒适度。";
}
