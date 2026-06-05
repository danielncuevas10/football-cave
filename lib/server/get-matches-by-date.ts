import { supabase } from "@/lib/supabase"
import type { DbMatch } from "@/types/sports"

interface GetMatchesOptions {
  date: Date
  leagueId?: number   // optional — omit to get all tracked leagues
}

function getDayBounds(date: Date): { start: string; end: string } {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)

  const end = new Date(date)
  end.setHours(23, 59, 59, 999)

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  }
}

export async function getMatchesByDate({
  date,
  leagueId,
}: GetMatchesOptions): Promise<DbMatch[]> {
  const { start, end } = getDayBounds(date)

  let query = supabase
    .from("matches")
    .select("*")
    .gte("fixture_date", start)
    .lte("fixture_date", end)
    .order("fixture_date", { ascending: true })

  // Only filter by league if one was passed
  if (leagueId !== undefined) {
    query = query.eq("league_id", leagueId)
  }

  const { data, error } = await query.returns<DbMatch[]>()

  if (error) {
    console.error("getMatchesByDate failed:", error.message)
    return []
  }

  return data ?? []
}