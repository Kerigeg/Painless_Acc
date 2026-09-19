import { describe, it, expect } from "vitest";
import {
  blank,
  newCharacter,
  parseStore,
  initialStore,
  type History,
} from "../src/domain/model";
import {
  lunarState,
  lunarDiagnoses,
  templateAvailability,
} from "../src/domain/lunar";
import { plan, blocked } from "../src/domain/planner";
import { diagnose } from "../src/domain/rules";
const account = (names: string[]) => {
  const p = blank();
  p.focus = "月感电";
  p.characters = names.map((name) => ({
    ...newCharacter(name),
    ready: "可用" as const,
  }));
  p.team = p.characters.map((c) => c.id);
  p.minutes = 10;
  p.region = "已解锁的练习区域";
  p.lunar.safeScene = "已确认";
  return p;
};
describe("Lunar-Charged role and executable plan", () => {
  it("Aino raises Moonsign but cannot enable LC", () => {
    const p = account(["爱诺", "砂糖", "皇女"]);
    expect(lunarState(p).moonLevel).toBe(1);
    expect(lunarState(p).enablers).toHaveLength(0);
    expect(
      lunarDiagnoses(p).find((d) => d.id === "lunar-enabler")?.status,
    ).toBe("已确认");
    expect(plan(p).find((t) => t.id === "lunar-cycle")?.blocked).toContain(
      "尚未确认月感电开启者",
    );
  });
  it("recognizes aliases, all three enablers and both Moon ranks", () => {
    for (const name of ["伊涅夫", "哥伦比娅", "菲林斯"]) {
      const p = account([name, "爱诺", "砂糖", "皇女"]);
      expect(lunarState(p).enablers).toHaveLength(1);
      expect(lunarState(p).fullMoon).toBe(true);
    }
    const p = account(["未知新角色", "爱诺", "砂糖", "皇女"]);
    expect(
      lunarDiagnoses(p).find((d) => d.id === "lunar-enabler")?.status,
    ).toBe("待补充");
  });
  it("template uses owned ready units and preserves locked characters", () => {
    const p = account(["菲林斯", "哥伦比娅", "伊涅夫", "砂糖"]);
    expect(templateAvailability(p, "flins-columbina").usable).toBe(true);
    p.characters[0].ready = "未知";
    expect(templateAvailability(p, "flins-columbina").usable).toBe(false);
    p.characters[0].ready = "可用";
    const kept = newCharacter("凯亚");
    p.characters.push(kept);
    p.keep = [kept.id];
    expect(templateAvailability(p, "flins-columbina").usable).toBe(false);
    expect(
      templateAvailability(account(["砂糖"]), "sucrose-driver").missing,
    ).toContain("菲谢尔");
  });
  it("creates sourced current-team tutorial and dependency gate without Mondstadt assumption", () => {
    const p = account(["菲林斯", "哥伦比娅", "伊涅夫", "砂糖"]),
      tasks = plan(p),
      t = tasks.find((t) => t.id === "lunar-cycle")!;
    expect(t.team).toEqual(p.team);
    expect(t.blocked).toEqual([]);
    expect(blocked(t, tasks, [])).toHaveLength(1);
    expect(t.steps.join()).toContain("特殊战技");
    expect(t.budget).toContain("0树脂");
    expect(t.stop).toContain("结束");
    expect(tasks.some((t) => t.id === "kaeya")).toBe(false);
  });
  it("inputs change diagnosis and failure reopens lunar reasoning", () => {
    const p = account(["菲林斯", "哥伦比娅", "伊涅夫", "砂糖"]);
    p.lunar.flinsSwap = "是";
    p.lunar.cloud = "中断";
    expect(diagnose(p).some((d) => d.id === "lunar-flins")).toBe(true);
    expect(diagnose(p).some((d) => d.id === "lunar-coverage")).toBe(true);
    const history: History[] = [
      {
        id: "r",
        at: "",
        taskId: "lunar-cycle",
        title: "月感电",
        fingerprint: JSON.stringify(p),
        feedback: "完成，没有改善",
        before: p,
        after: p,
        baseline: initialStore().baseline,
        result: initialStore().baseline,
      },
    ];
    expect(
      diagnose(p, history).find((d) => d.id === "lunar-flins")?.status,
    ).toBe("待补充");
    expect(
      plan(p, history).find((t) => t.id === "lunar-cycle")?.title,
    ).toContain("重新核查");
  });
  it("old backup migrates conservatively", () => {
    const old: any = initialStore();
    delete old.profile.lunar;
    delete old.profile.focus;
    delete old.profile.showcase;
    delete old.imports;
    const restored = parseStore(JSON.stringify(old));
    expect(restored.profile.focus).toBe("通用");
    expect(restored.profile.lunar.cloud).toBe("未知");
    expect(restored.imports).toEqual([]);
  });
});

it("lunar artifact comparison is role-specific, not a universal elemental goblet ban", async () => {
  const { compareArtifacts } = await import("../src/domain/planner");
  const { artifactSchema } = await import("../src/domain/model");
  const old = artifactSchema.parse({
    id: "a",
    owner: "",
    slot: "空之杯",
    set: "",
    rarity: 5,
    level: 20,
    main: "雷元素伤害%",
    subs: [],
  });
  const next = { ...old, id: "b", main: "攻击力%" as const };
  expect(compareArtifacts(old, next, "站场输出", "菲林斯")).toContain("更接近");
  expect(compareArtifacts(old, next, "后台输出", "菲谢尔")).toContain(
    "不能确认",
  );
  expect(
    compareArtifacts({ ...old, main: null }, next, "站场输出", "菲林斯"),
  ).toContain("未知");
});
