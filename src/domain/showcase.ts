import { z } from "zod";
import {
  artifactSchema,
  characterSchema,
  newCharacter,
  profileSchema,
  type Artifact,
  type Character,
  type Profile,
} from "./model";
import { guideFor, normalizeName } from "../data/characters";
import { reportedName } from "../data/character-identities";
const record = z.record(z.string(), z.unknown());
const payloadSchema = z.object({
  uid: z.string().regex(/^[1-9]\d{8,9}$/),
  fetchedAt: z.string().datetime(),
  ttl: z.number().finite().min(0),
  cached: z.boolean(),
  warning: z.string().optional(),
  playerInfo: record,
  avatarInfoList: z.array(record).max(30),
  characters: z.record(z.string(), record),
  names: z.record(z.string(), z.string()),
});
type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {};
const value = (v: unknown, max: number, min = 0) => {
  if (v === undefined || v === null || v === "") return null;
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};
const integer = (v: unknown, max: number, min = 0) => {
  const n = value(v, max, min);
  return n !== null && Number.isInteger(n) ? n : null;
};
const propNames: Record<string, Artifact["main"]> = {
  FIGHT_PROP_HP: "生命值",
  FIGHT_PROP_HP_PERCENT: "生命值%",
  FIGHT_PROP_ATTACK: "攻击力",
  FIGHT_PROP_ATTACK_PERCENT: "攻击力%",
  FIGHT_PROP_DEFENSE: "防御力",
  FIGHT_PROP_DEFENSE_PERCENT: "防御力%",
  FIGHT_PROP_ELEMENT_MASTERY: "元素精通",
  FIGHT_PROP_CHARGE_EFFICIENCY: "元素充能效率%",
  FIGHT_PROP_CRITICAL: "暴击率%",
  FIGHT_PROP_CRITICAL_HURT: "暴击伤害%",
  FIGHT_PROP_HEAL_ADD: "治疗加成%",
  FIGHT_PROP_ICE_ADD_HURT: "冰元素伤害%",
  FIGHT_PROP_WATER_ADD_HURT: "水元素伤害%",
  FIGHT_PROP_ELEC_ADD_HURT: "雷元素伤害%",
  FIGHT_PROP_WIND_ADD_HURT: "风元素伤害%",
  FIGHT_PROP_FIRE_ADD_HURT: "火元素伤害%",
  FIGHT_PROP_GRASS_ADD_HURT: "草元素伤害%",
  FIGHT_PROP_ROCK_ADD_HURT: "岩元素伤害%",
  FIGHT_PROP_PHYSICAL_ADD_HURT: "物理伤害%",
};
const slotNames: Record<string, Artifact["slot"]> = {
  EQUIP_BRACER: "生之花",
  EQUIP_NECKLACE: "死之羽",
  EQUIP_SHOES: "时之沙",
  EQUIP_RING: "空之杯",
  EQUIP_DRESS: "理之冠",
};
export type Showcase = {
  uid: string;
  at: string;
  nickname: string;
  ar: number | null;
  world: number | null;
  ttl: number;
  cached: boolean;
  characters: Character[];
  artifacts: Artifact[];
  warnings: string[];
};
export function convertShowcase(raw: unknown): Showcase {
  const data = payloadSchema.parse(raw);
  const warnings: string[] = data.warning ? [data.warning] : [];
  const characters: Character[] = [],
    artifacts: Artifact[] = [];
  for (const avatar of data.avatarInfoList) {
    const avatarId = integer(avatar.avatarId, 999999999, 1);
    if (avatarId === null) {
      warnings.push("已跳过无法识别的角色ID");
      continue;
    }
    const meta =
      data.characters[`${avatarId}-${avatar.skillDepotId}`] ??
      data.characters[String(avatarId)] ??
      {};
    const name = normalizeName(
      data.names[String(meta.NameTextMapHash)] ??
        reportedName(String(avatarId)) ??
        `未知角色 #${avatarId}`,
    );
    if (
      !data.names[String(meta.NameTextMapHash)] &&
      reportedName(String(avatarId))
    )
      warnings.push(
        `${name}：在线名称映射缺失，使用已核实的本地名称；专属机制不由名称推断，天赋仅按实际返回的映射读取`,
      );
    if (name.startsWith("未知角色 #"))
      warnings.push(
        `${name}：上游名称映射缺失；数值仍保留，名称等待资料更新，专属机制暂不支持`,
      );
    const c = newCharacter(name);
    c.id = `enka-${data.uid}-${avatarId}`;
    c.role = guideFor(name)?.role ?? "未知";
    const props = obj(avatar.propMap),
      fight = obj(avatar.fightPropMap);
    c.level = integer(obj(props["4001"]).val, 100, 1);
    c.ascension = integer(obj(props["1002"]).val, 6);
    c.constellation = Array.isArray(avatar.talentIdList)
      ? avatar.talentIdList.length <= 6
        ? avatar.talentIdList.length
        : null
      : avatar.talentIdList === undefined
        ? 0
        : null;
    const order = Array.isArray(meta.SkillOrder) ? meta.SkillOrder : [];
    const levels = obj(avatar.skillLevelMap),
      proud = obj(meta.ProudMap),
      extra = obj(avatar.proudSkillExtraLevelMap);
    c.talents = [0, 1, 2].map((i) => {
      const id = String(order[i]);
      const base = integer(levels[id], 15, 1);
      if (base === null) return null;
      const bonus = integer(extra[String(proud[id])], 14) ?? 0;
      return base + bonus <= 15 ? base + bonus : null;
    }) as Character["talents"];
    c.panel = {
      kind: "展柜快照（增益未知）",
      hp: value(fight["2000"], 200000),
      atk: value(fight["2001"], 20000),
      def: value(fight["2002"], 10000),
      em: value(fight["28"], 5000),
      er: fraction(fight["23"], 1000),
      cr: fraction(fight["20"], 200),
      cd: fraction(fight["22"], 1000),
    };
    const equipment = Array.isArray(avatar.equipList) ? avatar.equipList : [];
    for (const rawItem of equipment) {
      const item = obj(rawItem),
        flat = obj(item.flat),
        weapon = obj(item.weapon),
        relic = obj(item.reliquary);
      const translated =
        data.names[String(flat.nameTextMapHash ?? flat.nameTextHashMap)] ?? "";
      if (item.weapon) {
        if (!translated)
          warnings.push(`${name}：武器名称映射缺失，保留物品ID并等待补充`);
        const affix = obj(weapon.affixMap);
        const values = Object.values(affix);
        const refinement = values.length === 1 ? integer(values[0], 4) : null;
        c.weapon = {
          id: `${c.id}-weapon`,
          name: translated || `未知武器 #${item.itemId ?? "?"}`,
          level: integer(weapon.level, 90, 1),
          ascension: integer(weapon.promoteLevel, 6),
          refinement: refinement === null ? null : refinement + 1,
        };
      }
      if (item.reliquary) {
        const slot = slotNames[String(flat.equipType)];
        if (!slot) {
          warnings.push(`${name}：未知圣遗物部位，已跳过`);
          continue;
        }
        const main = obj(flat.reliquaryMainstat);
        const mainStat = propNames[String(main.mainPropId)] ?? null;
        if (!mainStat)
          warnings.push(`${name} ${slot}：主词条无法识别，保留未知`);
        const subs = Array.isArray(flat.reliquarySubstats)
          ? flat.reliquarySubstats
          : [];
        const parsedSubs: Artifact["subs"] = [];
        for (const v of subs) {
          const sub = obj(v);
          const stat = propNames[String(sub.appendPropId ?? sub.appendPropID)];
          if (!stat) {
            warnings.push(`${name} ${slot}：已跳过未知副词条`);
            continue;
          }
          parsedSubs.push({
            stat,
            value: value(sub.statValue ?? sub.propValue, 999999),
          });
        }
        const level = integer(relic.level, 21, 1);
        const candidate = artifactSchema.safeParse({
          id: `${c.id}-${slot}`,
          owner: c.id,
          slot,
          set:
            data.names[
              String(flat.setNameTextMapHash ?? flat.setNameTextHashMap)
            ] ?? "",
          rarity: integer(flat.rankLevel, 5, 1),
          level: level === null ? null : level - 1,
          main: mainStat,
          mainValue: value(main.statValue ?? main.propValue, 999999),
          subs: parsedSubs,
        });
        if (candidate.success) artifacts.push(candidate.data);
        else warnings.push(`${name} ${slot}：数据未通过合法性检查，未导入`);
      }
    }
    const parsed = characterSchema.safeParse(c);
    if (
      parsed.success &&
      !characters.some((x) => x.id === c.id || x.name === c.name)
    )
      characters.push(parsed.data);
    else warnings.push(`${name}：角色重复或数据无效，已跳过`);
  }
  return {
    uid: data.uid,
    at: data.fetchedAt,
    nickname:
      typeof data.playerInfo.nickname === "string"
        ? data.playerInfo.nickname.slice(0, 100)
        : "旅行者",
    ar: integer(data.playerInfo.level, 60, 1),
    world: integer(data.playerInfo.worldLevel, 9),
    ttl: data.ttl,
    cached: data.cached,
    characters,
    artifacts: artifacts.filter((a) =>
      characters.some((c) => c.id === a.owner),
    ),
    warnings,
  };
}
function fraction(v: unknown, max: number) {
  const n = value(v, max / 100);
  return n === null ? null : Math.round(n * 10000) / 100;
}
export function mergeShowcase(
  current: Profile,
  showcase: Showcase,
  selected: string[],
): Profile {
  if (current.showcase && current.showcase.uid !== showcase.uid)
    throw Error(
      "当前档案已绑定另一 UID，请先导出备份并使用独立档案；不能混合两个账号。",
    );
  const ids = new Set(selected);
  const chosen = showcase.characters.filter((c) => ids.has(c.id));
  if (!chosen.length) throw Error("请至少选择一个角色");
  const p = structuredClone(current),
    mapping = new Map<string, string>();
  for (const fresh of chosen) {
    const old = p.characters.find(
      (c) => c.id === fresh.id || normalizeName(c.name) === fresh.name,
    );
    mapping.set(fresh.id, old?.id ?? fresh.id);
    if (!old) {
      p.characters.push(fresh);
      continue;
    }
    const next = {
      ...fresh,
      id: old.id,
      nameOverride: old.nameOverride,
      name:
        old.nameOverride ??
        (fresh.name.startsWith("未知角色 #") ? old.name : fresh.name),
      role: old.role === "未知" ? fresh.role : old.role,
      ready: old.ready,
      level: fresh.level ?? old.level,
      ascension: fresh.ascension ?? old.ascension,
      constellation: fresh.constellation ?? old.constellation,
      talents: fresh.talents.map(
        (v, i) => v ?? old.talents[i],
      ) as Character["talents"],
      weapon: fresh.weapon.id ? fresh.weapon : old.weapon,
    };
    p.characters = p.characters.map((c) => (c.id === old.id ? next : c));
  }
  for (const item of showcase.artifacts.filter((a) => ids.has(a.owner))) {
    const owner = mapping.get(item.owner)!;
    p.artifacts = p.artifacts.filter(
      (a) => !(a.owner === owner && a.slot === item.slot) && a.id !== item.id,
    );
    p.artifacts.push({ ...item, owner });
  }
  p.ar = showcase.ar ?? p.ar;
  p.world = showcase.world ?? p.world;
  p.example = false;
  p.showcase = {
    uid: showcase.uid,
    at: showcase.at,
    nickname: showcase.nickname,
  };
  return profileSchema.parse(p);
}
