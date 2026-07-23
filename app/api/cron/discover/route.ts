// src/app/api/cron/discover/route.ts

import { NextRequest, NextResponse } from "next/server"
import { Receiver } from "@upstash/qstash"
import { supabaseAdmin } from "@/lib/server/supabase-admin"
import { footballApi } from "@/lib/server/football-api"
import { standardizeRound } from "@/lib/sync/standardizeRound"
import { TRACKED_LEAGUE_IDS } from "@/lib/server/tracked-leagues"
import { LIVE_STATUSES } from "@/types/sports"
import type { DbMatch } from "@/types/sports"
import { preserveDeadStatuses } from "@/lib/server/preserve-dead-status"

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
})

function getCurrentSeason(): number {
  const now = new Date()
  return now.getMonth() < 6 ? now.getFullYear() - 1 : now.getFullYear()
}

export async function POST(req: NextRequest) {
  const body = await req.text()

  const isValid = await receiver
    .verify({
      signature: req.headers.get("upstash-signature") ?? "",
      body,
    })
    .catch(() => false)

  if (!isValid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const season = getCurrentSeason()
  let saved = 0
  const errors: string[] = []

  // Fetch all currently live matches once across all leagues. The API-Football
  // `last` parameter only returns *finished* matches, so live-to-finished
  // transitions fall through the cracks without this call. Fetching once here
  // and filtering per league below avoids N extra API calls inside the loop.
  const liveAll = await footballApi.liveMatches()

  for (const leagueId of TRACKED_LEAGUE_IDS) {
    // Liga MX needs more history: 9 matches/matchday × 2 matchdays = 18, plus
    // the full Liguilla (~20 matches). 40 covers both without over-fetching.
    const lastCount = leagueId === 262 ? 40 : 5;

    const [upcoming, recent, tbd] = await Promise.all([
      footballApi.fixturesByLeague({ league: leagueId, season, next: 20 }),
      footballApi.fixturesByLeague({ league: leagueId, season, last: lastCount }),
      // Fetch all TBD fixtures so the DB reflects confirmed times as soon as
      // API-Football announces them — not just the nearest 20 upcoming matches.
      footballApi.fixturesByLeague({ league: leagueId, season, status: "TBD" }),
    ])

    const liveForLeague = (liveAll?.response ?? []).filter(
      (m) => m.league.id === leagueId
    )

    const combined = [
      ...(upcoming?.response ?? []),
      ...(recent?.response ?? []),
      ...(tbd?.response ?? []),
      ...liveForLeague,
    ]

    if (!combined.length) continue

    // Deduplicate by fixture id in case a match appears in both lists
    const seen = new Set<number>()
    const unique = combined.filter(m => {
      if (seen.has(m.fixture.id)) return false
      seen.add(m.fixture.id)
      return true
    })

    const rows: Omit<DbMatch, "updated_at">[] = unique.map(m => ({
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

    const safeRows = await preserveDeadStatuses(rows)

    const { error } = await supabaseAdmin
      .from("matches")
      .upsert(safeRows, { onConflict: "id" })

    if (error) {
      console.error(`Discovery upsert failed for league ${leagueId}:`, error.message)
      errors.push(`league ${leagueId}: ${error.message}`)
    } else {
      saved += rows.length
    }
  }

  return NextResponse.json({
    saved,
    success: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  })
}