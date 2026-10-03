import { describe, it, expect } from "vitest";
import { convertShowcase, mergeShowcase } from "../src/domain/showcase";
import {
  blank,
  newCharacter,
  parseStore,
  initialStore,
  artifactSchema,
} from "../src/domain/model";
import { showcaseFixture } from "./showcase-fixture";
describe("UID mapping and non-destructive merge", () => {
  it("maps actual hash and statValue fields, ratios, 1-based levels and talent extras", () => {
    const s = convertShowcase(showcaseFixture()),
      c = s.characters[0],
      a = s.artifacts[0];
    expect(c.name).toBe("菲谢尔");
    expect(c.panel.cr).toBe(55);
    expect(c.panel.cd).toBe(120);
    expect(c.panel.er).toBe(140);
    expect(c.panel.kind).toBe("展柜快照（增益未知）");
    expect(c.talents).toEqual([1, 11, 6]);
    expect(c.constellation).toBe(0);
    expect(c.weapon.refinement).toBe(5);
    expect(c.ready).toBe("未知");
    expect(a.level).toBe(20);
    expect(a.main).toBe("雷元素伤害%");
    expect(a.mainValue).toBe(46.6);
    expect(a.subs[0].value).toBe(10.5);
    expect(artifactSchema.safeParse(a).success).toBe(true);
  });
  it("does not fabricate private showcase or missing numbers", () => {
    const raw = showcaseFixture();
    raw.avatarInfoList = [];
    expect(convertShowcase(raw).characters).toEqual([]);
    const partial: any = showcaseFixture();
    partial.avatarInfoList[0].skillLevelMap = {};
    partial.avatarInfoList[0].propMap = {};
    partial.avatarInfoList[0].fightPropMap = {};
    partial.avatarInfoList[0].equipList = [];
    const c = convertShowcase(partial).characters[0];
    expect(c.level).toBeNull();
    expect(c.talents).toEqual([null, null, null]);
    expect(c.panel.er).toBeNull();
    expect(c.weapon.refinement).toBeNull();
  });
  it("merges idempotently, retains team and non-displayed characters, snapshots roundtrip", () => {
    const p = blank(),
      f = newCharacter("皇女"),
      k = newCharacter("凯亚");
    f.ready = "可用";
    p.characters = [f, k];
    p.team = [f.id, k.id];
    p.keep = [k.id];
    p.goal = "任务";
    const s = convertShowcase(showcaseFixture());
    const merged = mergeShowcase(p, s, [s.characters[0].id]);
    expect(merged.characters).toHaveLength(2);
    expect(merged.team).toEqual(p.team);
    expect(merged.keep).toEqual(p.keep);
    expect(merged.goal).toBe("任务");
    expect(merged.characters[0].ready).toBe("可用");
    expect(merged.artifacts[0].owner).toBe(f.id);
    const again = mergeShowcase(merged, s, [s.characters[0].id]);
    expect(again.characters).toHaveLength(2);
    expect(again.artifacts).toHaveLength(1);
    expect(p.artifacts).toHaveLength(0);
    const store = {
      ...initialStore(),
      profile: merged,
      imports: [{ at: s.at, uid: s.uid, before: p, after: merged }],
    };
    expect(
      parseStore(JSON.stringify(store)).imports[0].before.characters[0].level,
    ).toBeNull();
  });
  it("retains stable identity when a previously unknown name becomes available", () => {
    const s = convertShowcase(showcaseFixture());
    const first = structuredClone(s);
    first.characters[0].name = "未知角色 #10000031";
    const p = mergeShowcase(blank(), first, [first.characters[0].id]);
    const updated = mergeShowcase(p, s, [s.characters[0].id]);
    expect(updated.characters).toHaveLength(1);
    expect(updated.characters[0].name).toBe("菲谢尔");
    expect(updated.artifacts).toHaveLength(1);
  });
  it("rejects cross-account merging and malformed payloads", () => {
    const p = blank();
    p.showcase = { uid: "987654321", at: "", nickname: "" };
    const s = convertShowcase(showcaseFixture());
    expect(() => mergeShowcase(p, s, [s.characters[0].id])).toThrow("另一 UID");
    expect(() => convertShowcase({})).toThrow();
    expect(() => mergeShowcase(blank(), s, [])).toThrow();
  });
  it("preserves user-corrected names and equipment across repeated unknown imports", () => {
    const raw = showcaseFixture();
    raw.characters = {} as typeof raw.characters;
    const s = convertShowcase(raw);
    const p = mergeShowcase(blank(), s, [s.characters[0].id]);
    p.characters[0].name = "奥黛塔";
    p.characters[0].nameOverride = "奥黛塔";
    p.team = [p.characters[0].id];
    const next = mergeShowcase(p, s, [s.characters[0].id]);
    expect(next.characters).toHaveLength(1);
    expect(next.characters[0].name).toBe("奥黛塔");
    expect(next.characters[0].talents).toEqual([null, null, null]);
    expect(next.characters[0].level).toBe(90);
    expect(next.team).toEqual(p.team);
    expect(next.artifacts[0].owner).toBe(p.characters[0].id);
    const store = { ...initialStore(), profile: next };
    expect(
      parseStore(JSON.stringify(store)).profile.characters[0].nameOverride,
    ).toBe("奥黛塔");
  });
  it("large imported profiles do not break history fingerprint validation", () => {
    const s = convertShowcase(showcaseFixture()),
      p = mergeShowcase(blank(), s, [s.characters[0].id]);
    const state = initialStore();
    state.profile = p;
    state.history = [
      {
        id: "test",
        at: s.at,
        taskId: "baseline",
        title: "test",
        fingerprint: JSON.stringify(p),
        feedback: "完成，有改善",
        before: p,
        after: p,
        baseline: state.baseline,
        result: state.baseline,
      },
    ];
    expect(parseStore(JSON.stringify(state)).history).toHaveLength(1);
  });
});

it("repairs reported 7.0 IDs without guessing talents or rewriting history", () => {
  for (const [id, name] of [
    [10000150, "奥黛塔"],
    [10000148, "阿罗夏"],
  ] as const) {
    const raw = showcaseFixture();
    raw.avatarInfoList[0].avatarId = id;
    raw.characters = {} as typeof raw.characters;
    const s = convertShowcase(raw);
    expect(s.characters[0].name).toBe(name);
    expect(s.characters[0].talents).toEqual([null, null, null]);
    expect(s.characters[0].role).toBe("未知");
    expect(s.warnings.join(" ")).toContain("已核实的本地名称");
    const state = initialStore();
    state.profile = mergeShowcase(blank(), s, [s.characters[0].id]);
    state.profile.characters[0].name = `未知角色 #${id}`;
    state.imports = [
      {
        at: s.at,
        uid: s.uid,
        before: blank(),
        after: structuredClone(state.profile),
      },
    ];
    const restored = parseStore(JSON.stringify(state));
    expect(restored.profile.characters[0].name).toBe(name);
    expect(restored.imports[0].after.characters[0].name).toBe(
      `未知角色 #${id}`,
    );
    expect(restored.profile.artifacts).toEqual(state.profile.artifacts);
  }
});

it("repairs saved Columbina without changing builds, unknown IDs or explicit names", () => {
  const state = initialStore();
  const c = newCharacter("未知角色 #10000125");
  c.id = "enka-123456789-10000125";
  c.level = 90;
  c.talents = [null, 8, 8];
  state.profile.characters = [c];
  state.profile.team = [c.id];
  const repaired = parseStore(JSON.stringify(state));
  expect(repaired.profile.characters[0]).toEqual({ ...c, name: "哥伦比娅" });
  expect(repaired.profile.team).toEqual([c.id]);
  c.nameOverride = "我的角色";
  expect(parseStore(JSON.stringify(state)).profile.characters[0].name).toBe(
    c.name,
  );
  c.nameOverride = null;
  c.id = "enka-123456789-99999999";
  state.profile.team = [c.id];
  expect(parseStore(JSON.stringify(state)).profile.characters[0].name).toBe(
    c.name,
  );
});
