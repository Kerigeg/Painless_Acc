import type { Profile } from "./model";
// Future integration contracts. Public UID showcase import is implemented in
// showcase.ts and server/enka.mjs; no simulator or automatic updater is connected.
export interface AccountImporter {
  importPublicData(input: unknown): Promise<Partial<Profile>>;
}
export interface Simulator {
  supportedMechanisms: string[];
  simulate(
    profile: Profile,
  ): Promise<{ assumptions: string[]; result: unknown }>;
}
export interface StrategyProvider {
  version: string;
  verifiedAt: string;
  sourceURLs: string[];
}
export interface VersionCandidate {
  version: string;
  kind: "numbers" | "mechanism";
  status: "unverified" | "tested";
  rollbackTo: string;
}
