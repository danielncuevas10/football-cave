// src/app/api/seed/route.ts

import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/server/supabase-admin"
import { footballApi } from "@/lib/server/football-api"
import { standardizeRound } from "@/lib/sync/standardizeRound"
import { LIVE_STATUSES } from "@/types/sports"
import type { DbMatch } from "@/types/sports"
import { z } from "zod"

// Protect this route — only you should be able to call it
const seedSchema = z.object({
  leagueId: z.coerce.number().int().positive(),
  season: z.coerce.number().int().min(2020).max(2030),
})

function isYouthTeam(name: string) {
  return /\bU\d{2}\b/i.test(name) || name.includes("U21") || name.includes("U19") || name.includes("U20") || name.includes("U23")
}

export async function GET(req: NextRequest) {
  const params = Object.fromEntries(new URL(req.url).searchParams)
  const parsed = seedSchema.safeParse(params)

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid params" }, { status: 400 })
  }

  const authHeader = req.headers.get("authorization") ?? ""
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : ""
  if (!token || token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { leagueId, season } = parsed.data

  const result = await footballApi.allFixturesForSeason(leagueId, season)

  if (!result?.response?.length) {
    return NextResponse.json({
      saved: 0,
      message: "No fixtures returned from API — check leagueId and season",
    })
  }

  const filteredFixtures = result.response.filter((m) => {
    const home = m.teams.home.name ?? ""
    const away = m.teams.away.name ?? ""

    return !isYouthTeam(home) && !isYouthTeam(away)
  })

  const rows: Omit<DbMatch, "updated_at">[] = filteredFixtures.map((m) => ({
    id:           m.fixture.id,
    home_team:    m.teams.home.name,
    away_team:    m.teams.away.name,
    home_logo:    m.teams.home.logo ?? null,
    away_logo:    m.teams.away.logo ?? null,
    home_score:   m.goals.home,
    away_score:   m.goals.away,
    penalty_home: m.score.penalty.home ?? null,
    penalty_away: m.score.penalty.away ?? null,
    status:       m.fixture.status.short as DbMatch["status"],
    fixture_date: m.fixture.date,
    league_id:    m.league.id,
    league_name:  m.league.name,
    league_logo:  m.league.logo ?? null,
    round:        m.league.round ?? null,
    stage:        standardizeRound(m.league.round),
    elapsed:      m.fixture.status.elapsed,
    is_live:      LIVE_STATUSES.includes(m.fixture.status.short as DbMatch["status"]),
  }))

  const { error } = await supabaseAdmin
    .from("matches")
    .upsert(rows, { onConflict: "id" })

  if (error) {
    console.error("seed upsert error:", error.message)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }

  return NextResponse.json({
    saved: rows.length,
    league: result.response[0]?.league.name,
    season,
    message: `Seeded ${rows.length} fixtures successfully`,
  })
}