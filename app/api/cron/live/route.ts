// src/app/api/cron/live/route.ts

import { NextRequest, NextResponse } from "next/server"
import { Receiver } from "@upstash/qstash"
import { supabaseAdmin } from "@/lib/server/supabase-admin"
import { footballApi } from "@/lib/server/football-api"
import { standardizeRound } from "@/lib/sync/standardizeRound"
import { syncStandingsForLeague } from "@/lib/server/sync-league"
import { LIVE_STATUSES } from "@/types/sports"
import type { DbMatch } from "@/types/sports"

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
})

const TRACKED_LEAGUES = (process.env.TRACKED_LEAGUE_IDS ?? "")
  .split(",")
  .map(Number)
  .filter(Boolean)


const isYouthTeam = (name: string) =>
  /U\d{2}/.test(name) ||
  name.includes("U21") ||
  name.includes("U19") ||
  name.includes("U20")

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

  // ─── SAFETY NET ────────────────────────────────────────────────────────────
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()

  const { data: ghostMatches } = await supabaseAdmin
    .from("matches")
    .select("id")
    .eq("is_live", true)
    .lt("fixture_date", fourHoursAgo)

  if (ghostMatches && ghostMatches.length > 0) {
    const ghostIds = ghostMatches.map(m => m.id)
    console.warn(`Safety net: force-closing ${ghostIds.length} ghost matches`, ghostIds)

    await supabaseAdmin
      .from("matches")
      .update({
        is_live: false,
        status: "FT",
        elapsed: null,
        updated_at: new Date().toISOString(),
      })
      .in("id", ghostIds)
  }
  // ─── END SAFETY NET ────────────────────────────────────────────────────────

  // 1. Find which matches the DB currently thinks are live
  const { data: activeDbMatches } = await supabaseAdmin
    .from("matches")
    .select("id")
    .or("is_live.eq.true,status.in.(1H,2H,HT,ET,PEN)")
    .in("league_id", TRACKED_LEAGUES)

  const previouslyLiveIds = (activeDbMatches ?? []).map(m => m.id)

  // 2. Fetch live matches from API
  const fresh = await footballApi.liveMatches()

  // ✅ CHANGED: filter youth teams here
  const liveMatches = (fresh?.response ?? []).filter(m => {
    const home = m.teams.home.name
    const away = m.teams.away.name

    const isYouth =
      isYouthTeam(home) ||
      isYouthTeam(away)

    return TRACKED_LEAGUES.includes(m.league.id) && !isYouth
  })

  const currentlyLiveIds = liveMatches.map(m => m.fixture.id)

  // 3. Upsert live matches
  if (liveMatches.length > 0) {
    const rows: Omit<DbMatch, "updated_at">[] = liveMatches.map(m => ({
      id: m.fixture.id,
      home_team: m.teams.home.name,
      away_team: m.teams.away.name,
      home_logo: m.teams.home.logo ?? null,
      away_logo: m.teams.away.logo ?? null,
      home_score: m.goals.home,
      away_score: m.goals.away,
      status: m.fixture.status.short as DbMatch["status"],
      fixture_date: m.fixture.date,
      league_id: m.league.id,
      league_name: m.league.name,
      league_logo: m.league.logo ?? null,
      round: m.league.round ?? null,
      stage: standardizeRound(m.league.round),
      elapsed: m.fixture.status.elapsed,
      is_live: LIVE_STATUSES.includes(m.fixture.status.short as DbMatch["status"]),
    }))

    const { error } = await supabaseAdmin
      .from("matches")
      .upsert(rows, { onConflict: "id" })

    if (error) {
      console.error("Live upsert failed:", error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  // 4. Find matches that were live but are no longer live
  const newlyFinishedIds = previouslyLiveIds.filter(
    id => !currentlyLiveIds.includes(id)
  )

  // 5. Final score updates
  let finishedCount = 0
  const affectedLeagues = new Map<number, number>() // leagueId → season

  for (const matchId of newlyFinishedIds) {
    try {
      const result = await footballApi.getMatchById(matchId)
      const finalData = result?.response?.[0]

      if (finalData) {
        await supabaseAdmin
          .from("matches")
          .update({
            home_score: finalData.goals.home,
            away_score: finalData.goals.away,
            status: finalData.fixture.status.short,
            elapsed: finalData.fixture.status.elapsed,
            is_live: false,
            updated_at: new Date().toISOString(),
          })
          .eq("id", matchId)

        affectedLeagues.set(finalData.league.id, finalData.league.season)
        finishedCount++
      } else {
        await supabaseAdmin
          .from("matches")
          .update({
            is_live: false,
            status: "FT",
            elapsed: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", matchId)
      }
    } catch (e) {
      console.error(`Failed to fetch final data for match ${matchId}:`, e)

      await supabaseAdmin
        .from("matches")
        .update({
          is_live: false,
          status: "FT",
          elapsed: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", matchId)
    }
  }

  // 6. Refresh standings for every league that had a match finish
  for (const [leagueId, season] of affectedLeagues) {
    try {
      await syncStandingsForLeague(leagueId, season)
    } catch (e) {
      console.error(`Failed to sync standings for league ${leagueId}:`, e)
    }
  }

  return NextResponse.json({
    ghost_matches_fixed: ghostMatches?.length ?? 0,
    updated_live: liveMatches.length,
    finished_processed: finishedCount,
    standings_synced: affectedLeagues.size,
    success: true,
  })
}