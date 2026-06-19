import type { BracketMatchDef } from "@/types/bracket";

// ─── Round of 32 ─────────────────────────────────────────────────────────────

// 8 fixed slots: 2nd-place vs 2nd-place, no 3rd-place involvement
const R32_FIXED: BracketMatchDef[] = [
  {
    id: "R32_F1",
    round: "R32",
    label: "2A v 2B",
    home: { type: "group", position: 2, group: "A" },
    away: { type: "group", position: 2, group: "B" },
  },
  {
    id: "R32_F2",
    round: "R32",
    label: "1F v 2C",
    home: { type: "group", position: 1, group: "F" },
    away: { type: "group", position: 2, group: "C" },
  },
  {
    id: "R32_F3",
    round: "R32",
    label: "1C v 2F",
    home: { type: "group", position: 1, group: "C" },
    away: { type: "group", position: 2, group: "F" },
  },
  {
    id: "R32_F4",
    round: "R32",
    label: "2E v 2I",
    home: { type: "group", position: 2, group: "E" },
    away: { type: "group", position: 2, group: "I" },
  },
  {
    id: "R32_F5",
    round: "R32",
    label: "2K v 2L",
    home: { type: "group", position: 2, group: "K" },
    away: { type: "group", position: 2, group: "L" },
  },
  {
    id: "R32_F6",
    round: "R32",
    label: "1H v 2J",
    home: { type: "group", position: 1, group: "H" },
    away: { type: "group", position: 2, group: "J" },
  },
  {
    id: "R32_F7",
    round: "R32",
    label: "1J v 2H",
    home: { type: "group", position: 1, group: "J" },
    away: { type: "group", position: 2, group: "H" },
  },
  {
    id: "R32_F8",
    round: "R32",
    label: "2D v 2G",
    home: { type: "group", position: 2, group: "D" },
    away: { type: "group", position: 2, group: "G" },
  },
];

// 8 winner-vs-3rd slots — the specific 3rd-place team is resolved via Annex C lookup
const R32_THIRDS: BracketMatchDef[] = [
  {
    id: "R32_T1",
    round: "R32",
    label: "1A v 3rd[C/E/F/H/I]",
    home: { type: "group", position: 1, group: "A" },
    away: { type: "third", pool: ["C", "E", "F", "H", "I"] },
  },
  {
    id: "R32_T2",
    round: "R32",
    label: "1B v 3rd[E/F/G/I/J]",
    home: { type: "group", position: 1, group: "B" },
    away: { type: "third", pool: ["E", "F", "G", "I", "J"] },
  },
  {
    id: "R32_T3",
    round: "R32",
    label: "1D v 3rd[B/E/F/I/J]",
    home: { type: "group", position: 1, group: "D" },
    away: { type: "third", pool: ["B", "E", "F", "I", "J"] },
  },
  {
    id: "R32_T4",
    round: "R32",
    label: "1E v 3rd[A/B/C/D/F]",
    home: { type: "group", position: 1, group: "E" },
    away: { type: "third", pool: ["A", "B", "C", "D", "F"] },
  },
  {
    id: "R32_T5",
    round: "R32",
    label: "1G v 3rd[A/E/H/I/J]",
    home: { type: "group", position: 1, group: "G" },
    away: { type: "third", pool: ["A", "E", "H", "I", "J"] },
  },
  {
    id: "R32_T6",
    round: "R32",
    label: "1I v 3rd[C/D/F/G/H]",
    home: { type: "group", position: 1, group: "I" },
    away: { type: "third", pool: ["C", "D", "F", "G", "H"] },
  },
  {
    id: "R32_T7",
    round: "R32",
    label: "1K v 3rd[D/E/I/J/L]",
    home: { type: "group", position: 1, group: "K" },
    away: { type: "third", pool: ["D", "E", "I", "J", "L"] },
  },
  {
    id: "R32_T8",
    round: "R32",
    label: "1L v 3rd[E/H/I/J/K]",
    home: { type: "group", position: 1, group: "L" },
    away: { type: "third", pool: ["E", "H", "I", "J", "K"] },
  },
];

// ─── Round of 16 ─────────────────────────────────────────────────────────────
// Each R16 match pairs the winner of a fixed R32 slot vs the winner of its
// corresponding thirds R32 slot (same index).

const R16_SLOTS: BracketMatchDef[] = Array.from({ length: 8 }, (_, i) => ({
  id: `R16_${i + 1}`,
  round: "R16" as const,
  label: `W(R32_F${i + 1}) v W(R32_T${i + 1})`,
  home: { type: "winner" as const, slotId: `R32_F${i + 1}` },
  away: { type: "winner" as const, slotId: `R32_T${i + 1}` },
}));

// ─── Quarter-Finals ───────────────────────────────────────────────────────────

const QF_SLOTS: BracketMatchDef[] = Array.from({ length: 4 }, (_, i) => ({
  id: `QF_${i + 1}`,
  round: "QF" as const,
  label: `W(R16_${i * 2 + 1}) v W(R16_${i * 2 + 2})`,
  home: { type: "winner" as const, slotId: `R16_${i * 2 + 1}` },
  away: { type: "winner" as const, slotId: `R16_${i * 2 + 2}` },
}));

// ─── Semi-Finals ─────────────────────────────────────────────────────────────

const SF_SLOTS: BracketMatchDef[] = [
  {
    id: "SF_1",
    round: "SF",
    label: "W(QF_1) v W(QF_2)",
    home: { type: "winner", slotId: "QF_1" },
    away: { type: "winner", slotId: "QF_2" },
  },
  {
    id: "SF_2",
    round: "SF",
    label: "W(QF_3) v W(QF_4)",
    home: { type: "winner", slotId: "QF_3" },
    away: { type: "winner", slotId: "QF_4" },
  },
];

// ─── Final + 3rd-Place Playoff ────────────────────────────────────────────────

const FINAL_SLOTS: BracketMatchDef[] = [
  {
    id: "FINAL",
    round: "FINAL",
    label: "W(SF_1) v W(SF_2)",
    home: { type: "winner", slotId: "SF_1" },
    away: { type: "winner", slotId: "SF_2" },
  },
  {
    id: "THIRD",
    round: "THIRD",
    label: "L(SF_1) v L(SF_2)",
    home: { type: "loser", slotId: "SF_1" },
    away: { type: "loser", slotId: "SF_2" },
  },
];

// ─── Exports ─────────────────────────────────────────────────────────────────

export const R32_FIXED_SLOTS = R32_FIXED;
export const R32_THIRD_SLOTS = R32_THIRDS;

// Ordered list of all bracket match definitions from R32 through Final
export const ALL_BRACKET_DEFS: BracketMatchDef[] = [
  ...R32_FIXED,
  ...R32_THIRDS,
  ...R16_SLOTS,
  ...QF_SLOTS,
  ...SF_SLOTS,
  ...FINAL_SLOTS,
];
