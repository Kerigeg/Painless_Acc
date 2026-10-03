import { it, expect } from "vitest";
import { blank } from "../src/domain/model";
import { convertShowcase, mergeShowcase } from "../src/domain/showcase";
import { diagnoseShowcase } from "../src/domain/showcase-diagnosis";
import { showcaseFixture } from "./showcase-fixture";
const imported = () => {
  const s = convertShowcase(showcaseFixture());
  return mergeShowcase(blank(), s, [s.characters[0].id]);
};
it("generates immediate observations without inventing a team or symptoms", () => {
  const p = imported();
  const result = diagnoseShowcase(p);
  expect(result).toHaveLength(1);
  expect(result[0].evidence).toContain("雷元素伤害%");
  expect(result[0].teaching).toContain("天赋方向");
  expect(p.team).toEqual([]);
  expect(p.symptoms).toEqual([]);
  expect(diagnoseShowcase(blank())).toEqual([]);
});
it("recalculates investment checks while unknown fields never become zero", () => {
  const p = imported();
  p.characters[0].weapon.level = 20;
  expect(diagnoseShowcase(p)[0].title).toContain("先检查武器等级");
  p.characters[0].weapon.level = null;
  p.characters[0].level = null;
  expect(diagnoseShowcase(p)[0].title).not.toContain("先检查武器等级");
  expect(diagnoseShowcase(p)[0].evidence).toContain("等级 未知");
});
it("unresearched characters get no invented talent or equipment recommendations", () => {
  const p = imported();
  p.characters[0].name = "奥黛塔";
  const d = diagnoseShowcase(p)[0];
  expect(d.action).toContain("尚未支持");
  expect(d.teaching).not.toContain("天赋方向");
});
