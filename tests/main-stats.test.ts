import { it, expect } from "vitest";
import { blank, newCharacter, artifactSchema } from "../src/domain/model";
import { assessMainStats } from "../src/domain/main-stats";
import { checkup } from "../src/domain/checkup";
const setup = (name: string, mains: string[]) => {
  const p = blank(),
    c = newCharacter(name);
  p.focus = "月感电";
  p.artifacts = ["时之沙", "空之杯", "理之冠"].map((slot, i) =>
    artifactSchema.parse({
      id: slot,
      owner: c.id,
      slot,
      set: "",
      rarity: 5,
      level: 20,
      main: mains[i] ?? null,
      subs: [],
    }),
  );
  return { p, c };
};
it("Columbina triple HP is checked as a combination, not three independent passes", () => {
  const { p, c } = setup("哥伦比娅", ["生命值%", "生命值%", "生命值%"]);
  expect(assessMainStats(p, c).rows[2].status).toBe("建议调整");
  p.artifacts[0].main = "元素充能效率%";
  expect(assessMainStats(p, c).rows[2].status).toBe("需核实条件");
});
it("Sucrose prefers EM even with Favonius, while Aino prioritizes energy conditions", () => {
  const { p, c } = setup("砂糖", ["元素精通", "元素精通", "暴击率%"]);
  c.weapon.name = "西风秘典";
  expect(assessMainStats(p, c).rows[2].status).toBe("建议调整");
  c.name = "爱诺";
  expect(assessMainStats(p, c).rows[0].status).toBe("需核实条件");
});
it("conditional EM and hydro goblets are not automatically rejected", () => {
  const { p, c } = setup("哥伦比娅", ["元素精通", "水元素伤害%", "暴击伤害%"]);
  expect(assessMainStats(p, c).rows[1].status).toBe("需核实条件");
  c.name = "菲林斯";
  expect(assessMainStats(p, c).rows[1].status).toBe("建议调整");
});
it("general healer and off-field cryo are supported; unknown mechanics remain unknown", () => {
  const { p, c } = setup("芭芭拉", ["生命值%", "生命值%", "治疗加成%"]);
  p.focus = "通用";
  c.role = "治疗";
  expect(assessMainStats(p, c).rows.every((r) => r.status === "符合方向")).toBe(
    true,
  );
  c.role = "站场输出";
  expect(assessMainStats(p, c).applicable).toBe(false);
  c.name = "奥黛塔";
  expect(assessMainStats(p, c).guide).toBeUndefined();
  expect(checkup(p, c).some((r) => r.label === "命座")).toBe(false);
});
