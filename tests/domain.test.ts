import { describe, it, expect } from "vitest";
import {
  blank,
  newCharacter,
  initialStore,
  parseStore,
  profileSchema,
  artifactSchema,
  emptyMetrics,
  feedbackOptions,
  type History,
} from "../src/domain/model";
import { diagnose } from "../src/domain/rules";
import { plan, blocked, completed, response } from "../src/domain/planner";
import { crit, resistance, energy, materialGap } from "../src/domain/math";
import { example } from "../src/data/example";
const record = (
  p: ReturnType<typeof blank>,
  id: string,
  feedback: History["feedback"] = "完成，有改善",
): History => ({
  id: "r",
  taskId: id,
  title: "测试",
  at: "2026-09-19",
  fingerprint: JSON.stringify(p),
  feedback,
  before: structuredClone(p),
  after: structuredClone(p),
  baseline: emptyMetrics(),
  result: emptyMetrics(),
});
describe("independently derived mathematical benchmarks", () => {
  it("expected crit: weighted mean and clamp", () => {
    expect(crit(50, 100)).toBe(1.5);
    expect(crit(0, 200)).toBe(1);
    expect(crit(100, 200)).toBe(3);
    expect(crit(140, 200)).toBe(3);
    expect(() => crit(-1, 50)).toThrow();
    expect(() => crit(NaN, 50)).toThrow();
  });
  it("resistance branches and continuity", () => {
    expect(resistance(-20)).toBe(1.1);
    expect(resistance(0)).toBe(1);
    expect(resistance(10)).toBe(0.9);
    expect(resistance(75)).toBe(0.25);
    expect(resistance(100)).toBe(0.2);
    expect(resistance(74.999)).toBeCloseTo(0.25, 4);
    expect(() => resistance(Infinity)).toThrow();
  });
  it("energy separates flat energy", () => {
    expect(energy(30, 150, 0, 60)).toEqual({ total: 45, gap: 15 });
    expect(energy(30, 200, 15, 60)).toEqual({ total: 75, gap: 0 });
    expect(energy(0, 100, 0, 60).gap).toBe(60);
    expect(() => energy(-1, 100, 0, 60)).toThrow();
  });
});
describe("unknown and validation", () => {
  it("unknown never becomes zero or investment claim", () => {
    const p = blank(),
      c = newCharacter("凯亚");
    p.characters = [c];
    p.team = [c.id];
    p.ar = 30;
    expect(diagnose(p).some((d) => d.id.startsWith("investment"))).toBe(false);
    expect(
      parseStore(JSON.stringify({ ...initialStore(), profile: p })).profile
        .characters[0].level,
    ).toBeNull();
  });
  it("reject malformed imports and retain valid roundtrip", () => {
    expect(() => parseStore("{")).toThrow();
    expect(() => parseStore('{"schemaVersion":2}')).toThrow();
    expect(parseStore(JSON.stringify(initialStore()))).toEqual(initialStore());
    const p = blank();
    p.team = ["unowned"];
    expect(profileSchema.safeParse(p).success).toBe(false);
  });
  it("reject illegal and duplicated equipment", () => {
    const a = {
      id: "a",
      owner: "",
      slot: "理之冠",
      set: "",
      rarity: 5,
      level: 20,
      main: "暴击率%",
      subs: [{ stat: "暴击率%", value: 3 }],
    };
    expect(artifactSchema.safeParse(a).success).toBe(false);
    expect(
      artifactSchema.safeParse({ ...a, slot: "生之花", subs: [] }).success,
    ).toBe(false);
    expect(
      artifactSchema.safeParse({ ...a, rarity: 3, subs: [] }).success,
    ).toBe(false);
    const p = example();
    p.characters.forEach((c) => (c.weapon.id = "same"));
    expect(profileSchema.safeParse(p).success).toBe(false);
  });
});
describe("rule and task lifecycle", () => {
  it("energy symptom is only a hypothesis", () => {
    const p = blank();
    p.symptoms = ["第二轮没能量"];
    const d = diagnose(p).find((d) => d.id === "energy")!;
    expect(d.status).toBe("疑似");
    expect(d.action).not.toContain("刷");
  });
  it("two real paths respect ownership, readiness, dependency and zero budgets", () => {
    const p = example();
    let tasks = plan(p);
    for (const id of ["barbara", "kaeya"]) {
      const t = tasks.find((t) => t.id === id)!;
      expect(t.steps.length).toBeGreaterThan(2);
      expect(t.team.every((id) => p.characters.some((c) => c.id === id))).toBe(
        true,
      );
      expect(blocked(t, tasks, []).length).toBeGreaterThan(0);
      expect(blocked(t, tasks, [record(p, "baseline")])).toEqual([]);
      expect(t.budget).toContain("0 树脂");
      expect(t.stop.length).toBeGreaterThan(10);
    }
    p.characters[1].ready = "待培养";
    tasks = plan(p);
    expect(
      tasks.find((t) => t.id === "barbara")?.blocked.length,
    ).toBeGreaterThan(0);
    p.characters = [];
    p.team = [];
    expect(plan(p).some((t) => ["barbara", "kaeya"].includes(t.id))).toBe(
      false,
    );
  });
  it("key changes invalidate completion without deleting old history", () => {
    const p = example(),
      history = [record(p, "baseline")];
    expect(completed(plan(p)[0], history)).toBe(true);
    p.world = 4;
    expect(completed(plan(p)[0], history)).toBe(false);
    expect(history).toHaveLength(1);
    p.symptoms = [];
    expect(plan(p).some((t) => t.id === "kaeya")).toBe(false);
  });
  it("all feedback branches, including no effect, alter plan", () => {
    const p = example();
    for (const f of feedbackOptions)
      expect(response(f).length).toBeGreaterThan(5);
    const revised = plan(p, [record(p, "kaeya", "完成，没有改善")]).find(
      (t) => t.id === "kaeya",
    )!;
    expect(revised.title).toContain("重新核查");
    expect(revised.steps[0]).toContain("暂停");
    const simple = plan(p, [record(p, "kaeya", "操作不出来")]).find(
      (t) => t.id === "kaeya",
    )!;
    expect(simple.steps[0]).toContain("只按一次");
  });
});

it("verified talent materials: deficit, unknown and resource gate", () => {
  expect(materialGap(1, 3)).toBe(2);
  expect(materialGap(9, 3)).toBe(0);
  expect(materialGap(null, 3)).toBeNull();
  expect(() => materialGap(1.5, 3)).toThrow();
  const p = example();
  p.characters[1].ascension = 2;
  p.mora = 12499;
  p.inventory = { freedom: 3, scroll: 6 };
  let t = plan(p).find((t) => t.id === "barbara-talent")!;
  expect(t.blocked).toContain("摩拉缺口：1");
  p.mora = 12500;
  const tasks = plan(p);
  t = tasks.find((t) => t.id === "barbara-talent")!;
  expect(
    blocked(t, tasks, [record(p, "baseline"), record(p, "barbara")]),
  ).toEqual([]);
  p.characters[1].talents[1] = 2;
  expect(plan(p).some((t) => t.id === "barbara-talent")).toBe(false);
});
it("failed trial reopens diagnosis and most recent feedback wins", () => {
  const p = example();
  const history = [record(p, "kaeya"), record(p, "kaeya", "完成，没有改善")];
  expect(diagnose(p, history).find((d) => d.id === "energy")?.status).toBe(
    "待补充",
  );
  expect(
    completed(
      plan(p).find((t) => t.id === "kaeya")!,
      history,
    ),
  ).toBe(false);
});

it("unknown artifact fields remain unknown", () => {
  const result = artifactSchema.parse({
    id: "unknown",
    owner: "",
    slot: "理之冠",
    set: "",
    rarity: null,
    level: null,
    main: null,
    subs: [{ stat: "生命值", value: null }],
  });
  expect(result.level).toBeNull();
  expect(result.rarity).toBeNull();
  expect(result.subs[0].value).toBeNull();
});
