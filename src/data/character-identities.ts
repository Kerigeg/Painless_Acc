// Display names only. User confirmed these UID-import IDs on 2026-09-19.
// Not independently verified against upstream game data; no mechanics inferred.
export const reportedIdentities: Record<string, string> = {
  "10000150": "奥黛塔",
  "10000148": "阿罗夏",
};
export const reportedName = (id: string) =>
  reportedIdentities[id.split("-").at(-1)!];
