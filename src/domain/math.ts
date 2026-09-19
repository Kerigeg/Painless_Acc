function valid(...v: number[]) {
  if (v.some((x) => !Number.isFinite(x))) throw Error("输入必须是有限数值");
}
export function crit(rate: number, damage: number) {
  valid(rate, damage);
  if (rate < 0 || damage < 0) throw Error("暴击输入不能为负");
  return 1 + ((Math.min(rate, 100) / 100) * damage) / 100;
}
export function resistance(percent: number) {
  valid(percent);
  const r = percent / 100;
  return r < 0 ? 1 - r / 2 : r < 0.75 ? 1 - r : 1 / (4 * r + 1);
}
export function energy(base: number, er: number, flat: number, cost: number) {
  valid(base, er, flat, cost);
  if (Math.min(base, er, flat, cost) < 0) throw Error("能量输入不能为负");
  const total = (base * er) / 100 + flat;
  return { total, gap: Math.max(0, cost - total) };
}

export function materialGap(owned: number | null, required: number) {
  if (owned === null) return null;
  valid(owned, required);
  if (
    owned < 0 ||
    required < 0 ||
    !Number.isInteger(owned) ||
    !Number.isInteger(required)
  )
    throw Error("材料数量必须是非负整数");
  return Math.max(0, required - owned);
}
