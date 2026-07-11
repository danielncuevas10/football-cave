import { NextRequest, NextResponse } from "next/server"
import { Receiver } from "@upstash/qstash"
import { supabaseAdmin } from "@/lib/server/supabase-admin"
import { footballApi } from "@/lib/server/football-api"
import { standardizeRound } from "@/lib/sync/standardizeRound"
import { LIVE_STATUSES } from "@/types/sports"
import type { DbMatch } from "@/types/sports"

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
})

const TRACKED_LEAGUES = [2, 39, 140, 78, 61, 135, 36, 10]

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

  // ── Safety net: kill ghost matches older than 4 hours ──────────────────────
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
  await supabaseAdmin
    .from("matches")
    .update({
      is_live: false,
      status: "FT",
      elapsed: null,
      updated_at: new Date().toISOString(),
    })
    .eq("is_live", true)
    .lt("fixture_date", fourHoursAgo)
  // ──────────────────────────────────────────────────────────────────────────

  const fresh = await footballApi.liveMatches()
  const liveMatches = (fresh?.response ?? []).filter(
    m => TRACKED_LEAGUES.includes(m.league.id)
  )

  if (liveMatches.length === 0) {
    await supabaseAdmin
      .from("matches")
      .update({ is_live: false })
      .in("league_id", TRACKED_LEAGUES)

    return NextResponse.json({ updated: 0, skipped: true })
  }

  const liveMatchIds = liveMatches.map(m => m.fixture.id)

  // ── ONE batch query for all existing anchor data ───────────────────────────
  const { data: existingMatches } = await supabaseAdmin
    .from("matches")
    .select("id, status, first_half_started_at, second_half_started_at, ht_started_at")
    .in("id", liveMatchIds)

  const existingMap = new Map(
    (existingMatches ?? []).map(m => [m.id, m])
  )
  // ──────────────────────────────────────────────────────────────────────────

  const serverNow = new Date().toISOString()
  const anchorUpdates: Array<{ id: number } & Record<string, string | number>> = []

  const mainRows: Omit<DbMatch, "updated_at">[] = liveMatches.map(m => {
    const existing = existingMap.get(m.fixture.id)
    const newStatus = m.fixture.status.short
    const anchorChanges: Record<string, string> = {}

    // ── Use API-provided period timestamps (accurate to the second) ──────────
    // API-Football returns Unix seconds — multiply by 1000 for JS Date
    const apiFirstTs = m.fixture.periods?.first
      ? new Date(m.fixture.periods.first * 1000).toISOString()
      : null

    const apiSecondTs = m.fixture.periods?.second
      ? new Date(m.fixture.periods.second * 1000).toISOString()
      : null

    // Write each anchor ONCE — never overwrite it after the first detection
    if (newStatus === "1H" && !existing?.first_half_started_at) {
      anchorChanges.first_half_started_at = apiFirstTs ?? serverNow
    }

    if (newStatus === "HT" && !existing?.ht_started_at) {
      anchorChanges.ht_started_at = serverNow
    }

    if (newStatus === "2H" && !existing?.second_half_started_at) {
      anchorChanges.second_half_started_at = apiSecondTs ?? serverNow
    }
    // ────────────────────────────────────────────────────────────────────────

    if (Object.keys(anchorChanges).length > 0) {
      anchorUpdates.push({ id: m.fixture.id, ...anchorChanges })
    }

    return {
      id: m.fixture.id,
      home_team: m.teams.home.name,
      away_team: m.teams.away.name,
      home_logo: m.teams.home.logo ?? null,
      away_logo: m.teams.away.logo ?? null,
      home_score: m.goals.home,
      away_score: m.goals.away,
      status: newStatus as DbMatch["status"],
      fixture_date: m.fixture.date,
      league_id: m.league.id,
      league_name: m.league.name,
      league_logo: m.league.logo ?? null,
      round: m.league.round ?? null,
      stage: standardizeRound(m.league.round),
      elapsed: m.fixture.status.elapsed,
      is_live: LIVE_STATUSES.includes(newStatus as DbMatch["status"]),
      // Preserve existing anchors — pass them through so upsert doesn't null them
      first_half_started_at:
        anchorChanges.first_half_started_at ??
        existing?.first_half_started_at ??
        null,
      second_half_started_at:
        anchorChanges.second_half_started_at ??
        existing?.second_half_started_at ??
        null,
      ht_started_at:
        anchorChanges.ht_started_at ??
        existing?.ht_started_at ??
        null,
    }
  })

  // ── Exactly 2 upserts total regardless of how many live matches ───────────
  const { error: mainError } = await supabaseAdmin
    .from("matches")
    .upsert(mainRows, { onConflict: "id" })

  if (mainError) {
    console.error("Live upsert failed:", mainError.message)
    return NextResponse.json({ error: mainError.message }, { status: 500 })
  }

  if (anchorUpdates.length > 0) {
    await supabaseAdmin
      .from("matches")
      .upsert(anchorUpdates, { onConflict: "id" })
  }
  // ──────────────────────────────────────────────────────────────────────────

  // Un-mark matches that were live but no longer appear in the live feed
  await supabaseAdmin
    .from("matches")
    .update({ is_live: false })
    .in("league_id", TRACKED_LEAGUES)
    .not("id", "in", `(${liveMatchIds.join(",")})`)
    .eq("is_live", true)

  return NextResponse.json({
    updated: mainRows.length,
    anchors_written: anchorUpdates.length,
    success: true,
  })
}
