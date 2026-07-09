if (typeof window !== "undefined") {
    throw new Error("tracked-leagues.ts must only run on the server")
  }
  
  export const TRACKED_LEAGUE_IDS: number[] = (
    process.env.TRACKED_LEAGUE_IDS ?? "1,2,39,140,253,262"
  )
    .split(",")
    .map(id => Number(id.trim()))
    .filter(id => Number.isFinite(id) && id > 0)
  
  export function isTrackedLeague(leagueId: number): boolean {
    return TRACKED_LEAGUE_IDS.includes(leagueId)
  }