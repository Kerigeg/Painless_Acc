import { mainStatGuides } from "./main-stat-guides";
// Coarse candidate filter only. Conditions are evaluated by domain/main-stats.ts.
export const lunarMainStats: Record<
  string,
  Record<string, string[]>
> = Object.fromEntries(
  Object.entries(mainStatGuides).map(([name, g]) => [
    name,
    Object.fromEntries(
      Object.entries(g.slots).map(([slot, r]) => [
        slot,
        [...r.preferred, ...Object.keys(r.conditional ?? {})],
      ]),
    ),
  ]),
);
