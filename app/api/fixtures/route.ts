import { NextRequest, NextResponse } from "next/server"
import { guardRoute } from "@/lib/api-guard"
import { fixtureQuerySchema } from "@/lib/schemas"
import { supabase } from "@/lib/supabase"
import { supabaseAdmin } from "@/lib/server/supabase-admin"
import { footballApi } from "@/lib/server/football-api"
import { LIVE_STATUSES } from "@/types/sports"
import type { DbMatch } from "@/types/sports"

const CACHE_TTL_MINUTES = 5

export async function GET(req: NextRequest) {
  const blocked = await guardRoute(req)
  if (blocked) return blocked

  const params = Object.fromEntries(new URL(req.url).searchParams)
  const parsed = fixtureQuerySchema.safeParse(params)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid parameters", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { leagueId, season } = parsed.data
  const staleAfter = new Date(Date.now() - CACHE_TTL_MINUTES * 60 * 1000).toISOString()

  // Try Supabase cache first
  const { data: cached } = await supabase
    .from("matches")
    .select("*")
    .eq("league_id", leagueId)
    .gt("updated_at", staleAfter)
    .order("fixture_date", { ascending: true })
    .returns<DbMatch[]>()

  if (cached && cached.length > 0) {
    return NextResponse.json(cached, { headers: { "X-Cache": "HIT" } })
  }

  // Cache miss — call API-Football
  const fresh = await footballApi.fixtures(leagueId, season)
  if (!fresh) {
    // Serve stale data rather than failing completely
    const { data: stale } = await supabase
      .from("matches")
      .select("*")
      .eq("league_id", leagueId)
      .order("fixture_date", { ascending: true })
      .returns<DbMatch[]>()

    if (stale && stale.length > 0) {
      return NextResponse.json(stale, { headers: { "X-Cache": "STALE" } })
    }

    return NextResponse.json({ error: "Data unavailable" }, { status: 503 })
  }

  const rows: Omit<DbMatch, "updated_at">[] = fresh.response.map(m => ({
    id:           m.fixture.id,
    home_team:    m.teams.home.name,
    away_team:    m.teams.away.name,
    home_logo:    m.teams.home.logo,
    away_logo:    m.teams.away.logo,
    home_score:   m.goals.home,
    away_score:   m.goals.away,
    penalty_home: m.score.penalty.home ?? null,
    penalty_away: m.score.penalty.away ?? null,
    status:       m.fixture.status.short as DbMatch["status"],
    fixture_date: m.fixture.date,
    league_id:    m.league.id,
    league_name:  m.league.name,
    league_logo:  m.league.logo ?? null,
    round:        m.league.round,
    elapsed:      m.fixture.status.elapsed,
    is_live:      LIVE_STATUSES.includes(m.fixture.status.short as any),
  }))

  await supabaseAdmin
    .from("matches")
    .upsert(rows, { onConflict: "id" })

    

  return NextResponse.json(rows, { headers: { "X-Cache": "MISS" } })
}