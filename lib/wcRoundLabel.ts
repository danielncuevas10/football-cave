// Maps a Football API round string to its matchTabs i18n key.
// Returns null when no matching round is found.
export function getWcRoundKey(round: string | null | undefined): string | null {
  if (!round) return null;
  const r = round.toLowerCase();
  if (r.includes("group")) return "groupStage";
  if (r.includes("32")) return "wcroundOf32";
  if (r.includes("16")) return "wcroundOf16";
  if (r.includes("quarter")) return "wcroundQF";
  if (r.includes("semi")) return "wcroundSF";
  if (r.includes("3rd") || r.includes("third") || r.includes("place")) return "wcroundThird";
  if (r.includes("final")) return "wcroundFinal";
  return null;
}
