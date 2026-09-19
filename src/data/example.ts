import { blank, newCharacter, type Profile } from "../domain/model";
export function example(): Profile {
  const p = blank();
  const b = newCharacter("芭芭拉"),
    k = newCharacter("凯亚");
  Object.assign(b, {
    role: "治疗",
    ready: "可用",
    level: 40,
    ascension: 1,
    talents: [1, 1, 1],
  });
  Object.assign(k, {
    role: "后台输出",
    ready: "可用",
    level: 50,
    ascension: 2,
    talents: [1, 2, 2],
  });
  p.characters = [k, b];
  p.team = [k.id, b.id];
  return {
    ...p,
    example: true,
    ar: 30,
    world: 3,
    minutes: 10,
    resin: 0,
    mondstadt: "已解锁",
    region: "蒙德",
    device: "手机",
    symptoms: ["容易死", "第二轮没能量"],
    difficulty: "探索时经常停下来等技能",
    rotation: "凯亚战技后立刻切人",
  };
}
