// src/app/api/cron/live/route.ts

import { NextRequest, NextResponse } from "next/server"
import { Receiver } from "@upstash/qstash"
import { supabaseAdmin } from "@/lib/server/supabase-admin"
import { footballApi } from "@/lib/server/football-api"
import { standardizeRound } from "@/lib/sync/standardizeRound"
import { revalidatePath } from "next/cache"
import { syncStandingsForLeague, syncScorersForLeague, syncScorersFromEvents, recomputeGroupStandings } from "@/lib/server/sync-league"
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

  // 3b. Refresh match_details for live matches and sync scorer counts mid-game
  if (liveMatches.length > 0) {
    const liveLeagues = new Map<number, number>() // leagueId → season
    await Promise.allSettled(
      liveMatches.map(async (m) => {
        try {
          const details = await footballApi.getMatchDetails(m.fixture.id)
          if (!details) return
          await supabaseAdmin.from("match_details").upsert(
            {
              match_id: m.fixture.id,
              events: details.events.map((ev) => ({
                ...ev,
                player: { ...ev.player, id: ev.player.id ?? 0, name: ev.player.name ?? "" },
              })),
              lineups: details.lineups,
              statistics: details.statistics,
              venue_name: null,
              venue_city: null,
              referee: null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "match_id" }
          )
          liveLeagues.set(m.league.id, m.league.season)
        } catch (e) {
          console.error(`Failed to fetch live details for match ${m.fixture.id}:`, e)
        }
      })
    )
    for (const [leagueId, season] of liveLeagues) {
      await syncScorersFromEvents(leagueId, season).catch((e) =>
        console.error(`Live scorer sync failed for league ${leagueId}:`, e)
      )
    }
  }

  // 4. Find matches that were live but are no longer live
  const newlyFinishedIds = previouslyLiveIds.filter(
    id => !currentlyLiveIds.includes(id)
  )

  // 5. Final score updates
  let finishedCount = 0
  const affectedLeagues = new Map<number, number>() // leagueId → season
  // Collect detail-write promises so scorer sync always reads fresh match_details.
  const detailPromises: Promise<void>[] = []

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

        // Always fetch and write final match_details when a match just finishes.
        // Mid-match cron snapshots are partial — skipping this caused late events
        // (substitutions, cards, goals scored near FT) to be permanently missing.
        const detailPromise = (async () => {
          const details = await footballApi.getMatchDetails(matchId)
          if (!details) return

          await supabaseAdmin.from("match_details").upsert(
            {
              match_id: matchId,
              events: details.events.map((ev) => ({
                ...ev,
                player: { ...ev.player, id: ev.player.id ?? 0, name: ev.player.name ?? "" },
              })),
              lineups: details.lineups,
              statistics: details.statistics,
              venue_name: finalData.fixture?.venue?.name ?? null,
              venue_city: finalData.fixture?.venue?.city ?? null,
              referee: finalData.fixture?.referee ?? null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "match_id" }
          )
        })().catch((e) => console.error(`Failed to populate details for match ${matchId}:`, e))
        detailPromises.push(detailPromise)
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

  // Wait for all match_details writes to complete before syncing scorers.
  // syncScorersFromEvents reads from match_details — without this, it would
  // process stale event data and miss goals scored in the just-finished matches.
  await Promise.allSettled(detailPromises)

  // 6. Refresh standings + scorers for every league that had a match finish this run
  for (const [leagueId, season] of affectedLeagues) {
    try {
      // Layer 1: instant local recompute from our own matches table (no API call).
      // Returns true for tournament leagues with group stages, false for regular leagues.
      const recomputed = await recomputeGroupStandings(leagueId, season)

      // Scorers from events are always instant and accurate
      await syncScorersFromEvents(leagueId, season)

      if (recomputed) {
        // Tournament league: standings are already correct in DB.
        // Bust ISR cache immediately so the next page request sees fresh data.
        revalidatePath("/", "layout")
        revalidatePath("/bracket")
        revalidatePath(`/league/${leagueId}`)

        // Background verify: once API-Football's own cache clears (~30-60 min)
        // this self-corrects any edge cases (e.g. tiebreaker ordering).
        void syncStandingsForLeague(leagueId, season)
          .then(() => revalidatePath(`/league/${leagueId}`))
          .catch((e) =>
            console.error(`Standings API verify failed for league ${leagueId}:`, e)
          )
        void syncScorersForLeague(leagueId, season).catch((e) =>
          console.error(`Scorers API verify failed for league ${leagueId}:`, e)
        )
      } else {
        // Regular league: fire API sync in background so cron returns immediately.
        // revalidatePath runs once the API data lands in Supabase.
        void syncStandingsForLeague(leagueId, season)
          .then(() => {
            revalidatePath("/", "layout")
            revalidatePath(`/league/${leagueId}`)
          })
          .catch((e) =>
            console.error(`Standings sync failed for league ${leagueId}:`, e)
          )
        void syncScorersForLeague(leagueId, season).catch((e) =>
          console.error(`Scorers sync failed for league ${leagueId}:`, e)
        )
      }
    } catch (e) {
      console.error(`Failed to sync league ${leagueId}:`, e)
    }
  }

  // 7. Catch-all: sync standings + scorers for any league whose data is older than
  //    its most recently finished match (handles missed live→finished transitions).
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data: recentFt } = await supabaseAdmin
    .from("matches")
    .select("league_id, updated_at")
    .in("status", ["FT", "AET", "PEN"])
    .in("league_id", TRACKED_LEAGUES)
    .gte("updated_at", oneDayAgo)

  const leagueLatestMatch = new Map<number, number>()
  for (const m of recentFt ?? []) {
    const t = new Date(m.updated_at).getTime()
    if (!leagueLatestMatch.has(m.league_id) || t > leagueLatestMatch.get(m.league_id)!) {
      leagueLatestMatch.set(m.league_id, t)
    }
  }

  let catchAllSynced = 0
  for (const [leagueId, matchTs] of leagueLatestMatch) {
    if (affectedLeagues.has(leagueId)) continue // already synced this run

    const { data: st } = await supabaseAdmin
      .from("standings")
      .select("updated_at, season")
      .eq("league_id", leagueId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .single()

    const standingsTs = st ? new Date(st.updated_at).getTime() : 0
    if (standingsTs >= matchTs) continue // already up-to-date

    const season = st?.season ?? new Date().getFullYear()
    try {
      const recomputed = await recomputeGroupStandings(leagueId, season)
      await syncScorersFromEvents(leagueId, season)

      if (recomputed) {
        revalidatePath("/", "layout")
        revalidatePath("/bracket")
        revalidatePath(`/league/${leagueId}`)
        void syncStandingsForLeague(leagueId, season)
          .then(() => revalidatePath(`/league/${leagueId}`))
          .catch((e) =>
            console.error(`Catch-all standings API verify failed for league ${leagueId}:`, e)
          )
        void syncScorersForLeague(leagueId, season).catch((e) =>
          console.error(`Catch-all scorers API verify failed for league ${leagueId}:`, e)
        )
      } else {
        void syncStandingsForLeague(leagueId, season)
          .then(() => {
            revalidatePath("/", "layout")
            revalidatePath(`/league/${leagueId}`)
          })
          .catch((e) =>
            console.error(`Catch-all standings sync failed for league ${leagueId}:`, e)
          )
        void syncScorersForLeague(leagueId, season).catch((e) =>
          console.error(`Catch-all scorers sync failed for league ${leagueId}:`, e)
        )
      }
      catchAllSynced++
    } catch (e) {
      console.error(`Catch-all sync failed for league ${leagueId}:`, e)
    }
  }

  return NextResponse.json({
    ghost_matches_fixed: ghostMatches?.length ?? 0,
    updated_live: liveMatches.length,
    finished_processed: finishedCount,
    standings_scorers_synced: affectedLeagues.size + catchAllSynced,
    success: true,
  })
}