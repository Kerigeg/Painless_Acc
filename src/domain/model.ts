import { normalizeName } from "../data/characters";
import { reportedName } from "../data/character-identities";
import { z } from "zod";
const text = z.string().max(2000);
const num = (max: number, min = 0) =>
  z.number().finite().min(min).max(max).nullable();
const int = (max: number, min = 0) =>
  z.number().int().min(min).max(max).nullable();
export const slots = [
  "生之花",
  "死之羽",
  "时之沙",
  "空之杯",
  "理之冠",
] as const;
export const stats = [
  "生命值",
  "生命值%",
  "攻击力",
  "攻击力%",
  "防御力",
  "防御力%",
  "元素精通",
  "元素充能效率%",
  "暴击率%",
  "暴击伤害%",
  "治疗加成%",
  "冰元素伤害%",
  "水元素伤害%",
  "雷元素伤害%",
  "风元素伤害%",
  "火元素伤害%",
  "草元素伤害%",
  "岩元素伤害%",
  "其他元素伤害%",
  "物理伤害%",
] as const;
export const artifactSchema = z
  .object({
    id: text.min(1),
    owner: text,
    slot: z.enum(slots),
    set: text,
    rarity: z.number().int().min(1).max(5).nullable(),
    level: z.number().int().min(0).max(20).nullable(),
    main: z.enum(stats).nullable(),
    mainValue: num(999999).default(null),
    subs: z
      .array(
        z.object({
          stat: z.enum(stats),
          value: z.number().finite().min(0).nullable(),
        }),
      )
      .max(4),
  })
  .superRefine((a, c) => {
    const bad = (m: string) => c.addIssue({ code: "custom", message: m });
    if (
      a.level !== null &&
      a.rarity !== null &&
      a.level > [0, 4, 4, 12, 16, 20][a.rarity]
    )
      bad("强化等级超过星级上限");
    if (new Set(a.subs.map((s) => s.stat)).size !== a.subs.length)
      bad("副词条重复");
    if (a.subs.some((s) => s.stat === a.main)) bad("副词条不能与主词条重复");
    const allowed =
      a.slot === "生之花"
        ? ["生命值"]
        : a.slot === "死之羽"
          ? ["攻击力"]
          : a.slot === "时之沙"
            ? ["生命值%", "攻击力%", "防御力%", "元素精通", "元素充能效率%"]
            : a.slot === "空之杯"
              ? [
                  "生命值%",
                  "攻击力%",
                  "防御力%",
                  "元素精通",
                  "冰元素伤害%",
                  "水元素伤害%",
                  "雷元素伤害%",
                  "风元素伤害%",
                  "火元素伤害%",
                  "草元素伤害%",
                  "岩元素伤害%",
                  "其他元素伤害%",
                  "物理伤害%",
                ]
              : [
                  "生命值%",
                  "攻击力%",
                  "防御力%",
                  "元素精通",
                  "暴击率%",
                  "暴击伤害%",
                  "治疗加成%",
                ];
    if (a.main && !allowed.includes(a.main)) bad("该部位不支持此主词条");
    if (
      a.subs.some((s) =>
        [
          "治疗加成%",
          "冰元素伤害%",
          "水元素伤害%",
          "雷元素伤害%",
          "风元素伤害%",
          "火元素伤害%",
          "草元素伤害%",
          "岩元素伤害%",
          "其他元素伤害%",
          "物理伤害%",
        ].includes(s.stat),
      )
    )
      bad("非法副词条");
  });
export const characterSchema = z.object({
  id: text.min(1),
  name: text.min(1).transform(normalizeName),
  nameOverride: z.string().trim().min(1).max(100).nullable().default(null),
  role: z.enum(["未知", "站场输出", "后台输出", "治疗", "护盾", "辅助"]),
  ready: z.enum(["未知", "可用", "待培养"]),
  level: int(100, 1),
  ascension: int(6),
  constellation: int(6),
  talents: z.tuple([int(15, 1), int(15, 1), int(15, 1)]),
  weapon: z.object({
    id: text,
    name: text,
    level: int(90, 1),
    ascension: int(6),
    refinement: int(5, 1),
  }),
  panel: z.object({
    kind: z.enum(["未知", "原始面板", "战斗增益后", "展柜快照（增益未知）"]),
    hp: num(200000),
    atk: num(20000),
    def: num(10000),
    em: num(5000),
    er: num(1000),
    cr: num(200),
    cd: num(1000),
  }),
});
export const profileSchema = z
  .object({
    example: z.boolean(),
    lunar: z
      .object({
        cloud: z.enum(["未知", "持续", "中断", "未出现"]),
        hydro: z.enum(["未知", "持续", "中断"]),
        flinsSwap: z.enum(["未知", "是", "否"]),
        flinsBurst: z.enum(["未知", "短爆发", "普通爆发"]),
        safeScene: z.enum(["未知", "已确认", "未确认"]),
        hexerei: z.enum(["未知", "已解锁", "未解锁"]),
      })
      .default({
        cloud: "未知",
        hydro: "未知",
        flinsSwap: "未知",
        flinsBurst: "未知",
        safeScene: "未知",
        hexerei: "未知",
      }),
    focus: z.enum(["通用", "月感电"]).default("通用"),
    showcase: z
      .object({
        uid: z.string().regex(/^[1-9]\d{8,9}$/),
        at: text,
        nickname: text,
      })
      .nullable()
      .default(null),
    goal: z.enum(["大世界", "任务", "首领", "限时挑战"]),
    difficulty: text,
    symptoms: z.array(text).max(20),
    minutes: num(1440),
    resin: num(200),
    mora: num(1e10),
    inventory: z
      .object({ freedom: int(99999), scroll: int(99999) })
      .default({ freedom: null, scroll: null }),
    ar: int(60, 1),
    world: int(9),
    region: text,
    unlocks: text,
    mondstadt: z.enum(["未知", "已解锁", "未解锁"]),
    device: z.enum(["手机", "电脑", "手柄", "未知"]),
    preference: text,
    keep: z.array(text),
    enemy: text,
    rotation: text,
    investing: num(100),
    characters: z.array(characterSchema).max(100),
    team: z.array(text).max(4),
    artifacts: z.array(artifactSchema).max(1000),
  })
  .superRefine((p, c) => {
    const bad = (message: string) => c.addIssue({ code: "custom", message });
    for (const list of [
      p.characters.map((x) => x.id),
      p.characters.map((x) => normalizeName(x.name)),
      p.team,
      p.artifacts.map((x) => x.id),
      p.characters.map((x) => x.weapon.id).filter(Boolean),
    ])
      if (new Set(list).size !== list.length) bad("角色、队伍或装备 ID 重复");
    if (p.team.some((id) => !p.characters.some((c) => c.id === id)))
      bad("队伍包含未录入的角色");
    if (p.keep.some((id) => !p.characters.some((c) => c.id === id)))
      bad("保留角色不存在");
    const equipped = p.artifacts.filter((a) => a.owner);
    if (equipped.some((a) => !p.characters.some((c) => c.id === a.owner)))
      bad("装备归属角色不存在");
    if (new Set(equipped.map((a) => a.owner + a.slot)).size !== equipped.length)
      bad("同一角色同一部位只能装备一件");
  });
export type Profile = z.infer<typeof profileSchema>;
export type Character = z.infer<typeof characterSchema>;
export type Artifact = z.infer<typeof artifactSchema>;
export const blank = (): Profile => ({
  example: false,
  lunar: {
    cloud: "未知",
    hydro: "未知",
    flinsSwap: "未知",
    flinsBurst: "未知",
    safeScene: "未知",
    hexerei: "未知",
  },
  focus: "通用",
  showcase: null,
  goal: "大世界",
  difficulty: "",
  symptoms: [],
  minutes: null,
  resin: null,
  mora: null,
  inventory: { freedom: null, scroll: null },
  ar: null,
  world: null,
  region: "",
  unlocks: "",
  mondstadt: "未知",
  device: "未知",
  preference: "",
  keep: [],
  enemy: "",
  rotation: "",
  investing: null,
  characters: [],
  team: [],
  artifacts: [],
});
export const newCharacter = (name = ""): Character => ({
  nameOverride: null,
  id: crypto.randomUUID(),
  name: normalizeName(name),
  role: "未知",
  ready: "未知",
  level: null,
  ascension: null,
  constellation: null,
  talents: [null, null, null],
  weapon: { id: "", name: "", level: null, ascension: null, refinement: null },
  panel: {
    kind: "未知",
    hp: null,
    atk: null,
    def: null,
    em: null,
    er: null,
    cr: null,
    cd: null,
  },
});
export const feedbackOptions = [
  "完成，有改善",
  "完成，没有改善",
  "没看懂",
  "操作不出来",
  "缺材料",
  "未解锁",
  "打不过",
  "没刷到",
  "现在已经够用了",
] as const;
export const metricsSchema = z.object({
  scene: text,
  seconds: num(86400),
  wait: num(86400),
  deaths: num(999),
  interruptions: num(999),
  comfort: num(5, 1),
});
export type Metrics = z.infer<typeof metricsSchema>;
export const recordSchema = z.object({
  id: text,
  at: text,
  taskId: text,
  title: text,
  fingerprint: z.string().max(2_000_000),
  feedback: z.enum(feedbackOptions),
  before: profileSchema,
  after: profileSchema,
  baseline: metricsSchema,
  result: metricsSchema,
});
export type History = z.infer<typeof recordSchema>;
export const storeSchema = z.object({
  schemaVersion: z.literal(1),
  profile: profileSchema,
  history: z.array(recordSchema).max(2000),
  baseline: metricsSchema,
  imports: z
    .array(
      z.object({
        at: text,
        uid: text,
        before: profileSchema,
        after: profileSchema,
      }),
    )
    .max(100)
    .default([]),
});
export type Store = z.infer<typeof storeSchema>;
export const emptyMetrics = (): Metrics => ({
  scene: "",
  seconds: null,
  wait: null,
  deaths: null,
  interruptions: null,
  comfort: null,
});
export const initialStore = (): Store => ({
  schemaVersion: 1,
  profile: blank(),
  history: [],
  imports: [],
  baseline: emptyMetrics(),
});
export function parseStore(raw: string): Store {
  if (raw.length > 5_000_000) throw Error("文件过大，请控制在 5 MB 内");
  const r = storeSchema.safeParse(JSON.parse(raw));
  if (!r.success)
    throw Error(
      r.error.issues
        .map((i) => `${i.path.join(".")}：${i.message}`)
        .slice(0, 6)
        .join("；"),
    );
  // Repair current display names only; historical snapshots remain immutable.
  for (const c of r.data.profile.characters) {
    const name = c.id.startsWith("enka-") ? reportedName(c.id) : undefined;
    if (
      name &&
      !c.nameOverride &&
      c.name.startsWith("未知角色 #") &&
      !r.data.profile.characters.some(
        (other) => other.id !== c.id && other.name === name,
      )
    )
      c.name = name;
  }
  return r.data;
}
