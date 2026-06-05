import { League } from "@/types/sports"

// Tournaments have groups/knockout stages instead of a single table
// This controls whether WorldCupGroups renders instead of StandingsTable
const TOURNAMENT_LEAGUE_IDS: number[] = [
  League.WorldCup,
  League.ChampionsLeague,
  League.Friendly,
]

export function isTournamentLeague(leagueId: number): boolean {
  return TOURNAMENT_LEAGUE_IDS.includes(leagueId)
}