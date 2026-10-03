// Display-name fallback only; no mechanics inferred.
// Name snapshot verified 2026-09-28 against EnkaNetwork/API-docs
// store/gi/avatars.json + store/gi/locs.json (commit ac2c249e).
import { enkaNames } from "./enka-names.ts";
export const reportedIdentities: Record<string, string> = enkaNames;
export const reportedName = (id: string) =>
  reportedIdentities[id.split("-").at(-1)!];
