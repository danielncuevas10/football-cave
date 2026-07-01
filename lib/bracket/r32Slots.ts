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
// Pairings follow the official FIFA WC 2026 bracket draw.
// Left half: T4/T6 → R16_1, F1/F2 → R16_2, F5/F6 → R16_3, T3/T5 → R16_4
// Right half: F3/F4 → R16_5, T1/T8 → R16_6, F7/F8 → R16_7, T2/T7 → R16_8
//
// scheduledDate: official FIFA kickoff in UTC ISO format, published before
// teams are known. Overridden automatically once the real API fixture arrives.

const R16_SLOTS: BracketMatchDef[] = [
  { id: "R16_1", round: "R16", label: "W(R32_T4) v W(R32_T6)", scheduledDate: "2026-07-04T17:00:00+00:00", home: { type: "winner", slotId: "R32_T4" }, away: { type: "winner", slotId: "R32_T6" } },
  { id: "R16_2", round: "R16", label: "W(R32_F1) v W(R32_F2)", scheduledDate: "2026-07-04T21:00:00+00:00", home: { type: "winner", slotId: "R32_F1" }, away: { type: "winner", slotId: "R32_F2" } },
  { id: "R16_3", round: "R16", label: "W(R32_F5) v W(R32_F6)", scheduledDate: "2026-07-05T20:00:00+00:00", home: { type: "winner", slotId: "R32_F5" }, away: { type: "winner", slotId: "R32_F6" } },
  { id: "R16_4", round: "R16", label: "W(R32_T3) v W(R32_T5)", scheduledDate: "2026-07-06T00:00:00+00:00", home: { type: "winner", slotId: "R32_T3" }, away: { type: "winner", slotId: "R32_T5" } },
  { id: "R16_5", round: "R16", label: "W(R32_F3) v W(R32_F4)", scheduledDate: "2026-07-06T19:00:00+00:00", home: { type: "winner", slotId: "R32_F3" }, away: { type: "winner", slotId: "R32_F4" } },
  { id: "R16_6", round: "R16", label: "W(R32_T1) v W(R32_T8)", scheduledDate: "2026-07-07T00:00:00+00:00", home: { type: "winner", slotId: "R32_T1" }, away: { type: "winner", slotId: "R32_T8" } },
  { id: "R16_7", round: "R16", label: "W(R32_F7) v W(R32_F8)", scheduledDate: "2026-07-07T16:00:00+00:00", home: { type: "winner", slotId: "R32_F7" }, away: { type: "winner", slotId: "R32_F8" } },
  { id: "R16_8", round: "R16", label: "W(R32_T2) v W(R32_T7)", scheduledDate: "2026-07-07T20:00:00+00:00", home: { type: "winner", slotId: "R32_T2" }, away: { type: "winner", slotId: "R32_T7" } },
];

// ─── Quarter-Finals ───────────────────────────────────────────────────────────
// July 9–11 per official schedule (4 PM ET / 3 PM ET / 5 PM ET / 9 PM ET → UTC)

const QF_SCHEDULED: string[] = [
  "2026-07-09T20:00:00+00:00",
  "2026-07-10T19:00:00+00:00",
  "2026-07-11T21:00:00+00:00",
  "2026-07-12T01:00:00+00:00",
];

const QF_SLOTS: BracketMatchDef[] = Array.from({ length: 4 }, (_, i) => ({
  id: `QF_${i + 1}`,
  round: "QF" as const,
  label: `W(R16_${i * 2 + 1}) v W(R16_${i * 2 + 2})`,
  scheduledDate: QF_SCHEDULED[i],
  home: { type: "winner" as const, slotId: `R16_${i * 2 + 1}` },
  away: { type: "winner" as const, slotId: `R16_${i * 2 + 2}` },
}));

// ─── Semi-Finals ─────────────────────────────────────────────────────────────
// July 14 & 15 at 3 PM ET (19:00 UTC)

const SF_SLOTS: BracketMatchDef[] = [
  {
    id: "SF_1",
    round: "SF",
    label: "W(QF_1) v W(QF_2)",
    scheduledDate: "2026-07-14T19:00:00+00:00",
    home: { type: "winner", slotId: "QF_1" },
    away: { type: "winner", slotId: "QF_2" },
  },
  {
    id: "SF_2",
    round: "SF",
    label: "W(QF_3) v W(QF_4)",
    scheduledDate: "2026-07-15T19:00:00+00:00",
    home: { type: "winner", slotId: "QF_3" },
    away: { type: "winner", slotId: "QF_4" },
  },
];

// ─── Final + 3rd-Place Playoff ────────────────────────────────────────────────
// July 18 5 PM ET (21:00 UTC) and July 19 3 PM ET (19:00 UTC) at MetLife Stadium

const FINAL_SLOTS: BracketMatchDef[] = [
  {
    id: "FINAL",
    round: "FINAL",
    label: "W(SF_1) v W(SF_2)",
    scheduledDate: "2026-07-19T19:00:00+00:00",
    home: { type: "winner", slotId: "SF_1" },
    away: { type: "winner", slotId: "SF_2" },
  },
  {
    id: "THIRD",
    round: "THIRD",
    label: "L(SF_1) v L(SF_2)",
    scheduledDate: "2026-07-18T21:00:00+00:00",
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
