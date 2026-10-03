import { it, expect } from "vitest";
import { blank, newCharacter, artifactSchema } from "../src/domain/model";
import { checkup } from "../src/domain/checkup";
it("identifies five basic dimensions and recalculates known weapon levels", () => {
  const p = blank(),
    c = newCharacter("菲林斯");
  p.ar = 50;
  c.level = 90;
  c.weapon.level = 20;
  const rows = checkup(p, c);
  expect(rows).toHaveLength(5);
  expect(rows[1].priority).toBe(2);
  c.weapon.level = 90;
  expect(checkup(p, c)[1].priority).toBe(0);
  c.weapon.level = null;
  expect(checkup(p, c)[1].priority).toBe(0);
  expect(checkup(p, c)[4].priority).toBe(0);
});
it("prioritizes wrong main stat before investment and never judges unknown gear as absent", () => {
  const p = blank(),
    c = newCharacter("菲林斯");
  p.focus = "月感电";
  p.artifacts = [
    artifactSchema.parse({
      id: "cup",
      owner: c.id,
      slot: "空之杯",
      set: "",
      rarity: 5,
      level: 0,
      main: "防御力%",
      subs: [],
    }),
  ];
  const rows = checkup(p, c);
  expect(rows[3].priority).toBe(3);
  expect(rows[2].priority).toBe(2);
  p.focus = "通用";
  expect(checkup(p, c)[3].priority).toBe(0);
  p.artifacts = [];
  expect(checkup(p, c)[2].priority).toBe(0);
});
it("does not infer a team from ownership or demand constellations", () => {
  const p = blank(),
    c = newCharacter("菲林斯");
  p.characters = [c];
  p.focus = "月感电";
  c.constellation = 0;
  expect(checkup(p, c)[4].priority).toBe(0);
  expect(checkup(p, c)[4].priority).toBe(0);
  p.team = [c.id];
  expect(checkup(p, c)[4].priority).toBe(3);
  const unknown = newCharacter("奥黛塔");
  p.characters.push(unknown);
  p.team.push(unknown.id);
  expect(checkup(p, c)[4].priority).toBe(0);
});
