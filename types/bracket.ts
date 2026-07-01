import type { DbMatch } from "@/types/sports";

export type GroupLetter =
  | "A" | "B" | "C" | "D" | "E" | "F"
  | "G" | "H" | "I" | "J" | "K" | "L";

export type BracketRound = "R32" | "R16" | "QF" | "SF" | "FINAL" | "THIRD";

// Describes who occupies one side of a bracket match
export type SlotRef =
  | { type: "group"; position: 1 | 2; group: GroupLetter }
  | { type: "third"; pool: GroupLetter[] }
  | { type: "winner"; slotId: string }
  | { type: "loser"; slotId: string };

export interface BracketMatchDef {
  id: string;
  round: BracketRound;
  // Human-readable label, e.g. "2A v 2B" or "W(R32_F1) v W(R32_T1)"
  label: string;
  home: SlotRef;
  away: SlotRef;
  // Official FIFA scheduled kickoff (ISO 8601 UTC). Used as a fallback
  // fixtureDate when the real DB fixture does not exist yet. Overridden
  // automatically once the API creates the real fixture.
  scheduledDate?: string;
}

export type ThirdsSlotStatus = "locked" | "projected" | "tbd";

export interface ThirdsSlotResolution {
  slotStatus: ThirdsSlotStatus;
}

export interface ResolvedSlot {
  def: BracketMatchDef;
  match: DbMatch | null;
  // Resolved team names; falls back to slot label (e.g. "1A") then "TBD"
  homeLabel: string;
  awayLabel: string;
  homeLogo: string | null;
  awayLogo: string | null;
  // Best available fixture date — from linked match or partial team-name lookup for R32
  fixtureDate: string | null;
  // Populated only for R32_T* slots
  thirdsResolution?: ThirdsSlotResolution;
}

// One row of the FIFA Annex C lookup table
export interface AnnexCRow {
  // The 8 GroupLetters (sorted A→L) whose 3rd-place teams advanced
  groups: GroupLetter[];
  // Maps each winner-vs-3rd slot ID → the specific 3rd-place group whose team fills it
  assignments: Partial<Record<string, GroupLetter>>;
}
