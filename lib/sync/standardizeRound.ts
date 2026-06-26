import type { TournamentStage } from "@/types/sports"

export function standardizeRound(round: string | null | undefined): TournamentStage | null {
  if (!round) return null

  const r = round.toLowerCase()

  if (r.includes("group")) return "GROUP"
  if (r.includes("round of 32") || r.includes("1/16-finals") || r.includes("last 32")) return "R32"
  if (r.includes("round of 16") || r.includes("last 16")) return "R16"
  if (r.includes("quarter")) return "QF"
  if (r.includes("semi")) return "SF"
  if (r.includes("final") && !r.includes("semi") && !r.includes("quarter")) return "FINAL"

  // Regular season matches (Premier League, La Liga etc.) don't have tournament stages
  if (r.includes("regular season")) return null

  // Something else — knockout-adjacent but unrecognised
  return "UNKNOWN"
}