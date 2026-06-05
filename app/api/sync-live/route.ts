import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/server/supabase-admin";
import { footballApi } from "@/lib/server/football-api";
import { standardizeRound } from "@/lib/sync/standardizeRound";
import { LIVE_STATUSES } from "@/types/sports";
import type { DbMatch } from "@/types/sports";
import { guardRoute } from "@/lib/api-guard";

const TRACKED_LEAGUES = (process.env.TRACKED_LEAGUE_IDS ?? "")
  .split(",")
  .map(Number)
  .filter(Boolean);

export async function GET(req: NextRequest) {
  const blocked = await guardRoute(req);
  if (blocked) return blocked;
  // 1. Fetch all currently live matches from the API in one call
  const fresh = await footballApi.liveMatches();
  const liveFromApi = (fresh?.response ?? []).filter(
    (m) => TRACKED_LEAGUES.length === 0 || TRACKED_LEAGUES.includes(m.league.id)
  );

  if (liveFromApi.length > 0) {
    const rows: Omit<DbMatch, "updated_at">[] = liveFromApi.map((m) => ({
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
    }));

    await supabaseAdmin
      .from("matches")
      .upsert(rows, { onConflict: "id" });
  }

  // 2. Close out matches the DB still thinks are live but the API no longer reports
  const currentlyLiveIds = new Set(liveFromApi.map((m) => m.fixture.id));

  const { data: dbLive } = await supabaseAdmin
    .from("matches")
    .select("id")
    .eq("is_live", true);

  const ghostIds = (dbLive ?? [])
    .map((r) => r.id)
    .filter((id) => !currentlyLiveIds.has(id));

  if (ghostIds.length > 0) {
    await Promise.all(
      ghostIds.map(async (id) => {
        const result = await footballApi.getMatchById(id);
        const row = result?.response?.[0];
        if (row) {
          await supabaseAdmin.from("matches").update({
            home_score: row.goals.home,
            away_score: row.goals.away,
            status: row.fixture.status.short,
            elapsed: row.fixture.status.elapsed,
            is_live: false,
            updated_at: new Date().toISOString(),
          }).eq("id", id);
        } else {
          await supabaseAdmin.from("matches").update({
            is_live: false,
            status: "FT",
            updated_at: new Date().toISOString(),
          }).eq("id", id);
        }
      })
    );
  }

  return NextResponse.json({
    live: liveFromApi.length,
    closed: ghostIds.length,
  });
}
