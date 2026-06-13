import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/server/supabase-admin";
import { footballApi } from "@/lib/server/football-api";
import type { DbMatchDetails } from "@/types/sports";

const FINISHED_STATUSES = ["FT", "AET", "PEN", "AWD", "WO"];
const CACHE_TTL_MS = 60_000;

export interface MatchDetailsResult {
  details: DbMatchDetails | null;
  venueName: string | null;
  venueCity: string | null;
  referee: string | null;
}

export async function getMatchDetails(matchId: number): Promise<MatchDetailsResult> {
  // Always call the lightweight endpoint first — it's the only source of venue + referee.
  // Also syncs the current score so any display lag is resolved on first render.
  const basicData = await footballApi.getMatchById(matchId);
  const basicRow = basicData?.response?.[0];

  const venue = basicRow?.fixture?.venue ?? null;
  const venueName = venue?.name ?? null;
  const venueCity = venue?.city ?? null;
  const referee = basicRow?.fixture?.referee ?? null;

  if (basicRow) {
    const isNowFinished = FINISHED_STATUSES.includes(basicRow.fixture.status.short);
    await supabaseAdmin
      .from("matches")
      .update({
        home_score: basicRow.goals.home,
        away_score: basicRow.goals.away,
        status: basicRow.fixture.status.short,
        elapsed: basicRow.fixture.status.elapsed,
        ...(isNowFinished ? { is_live: false } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", matchId);
  }

  // Check the cache for full details (events / lineups / statistics).
  const { data: cached } = await supabase
    .from("match_details")
    .select("*")
    .eq("match_id", matchId)
    .single();

  if (cached) {
    const { data: mainMatch } = await supabase
      .from("matches")
      .select("status")
      .eq("id", matchId)
      .single();

    const isFinished = FINISHED_STATUSES.includes(mainMatch?.status ?? "");
    const hasData = cached.lineups?.length > 0 || cached.statistics?.length > 0;
    const cacheAgeMs = Date.now() - new Date(cached.updated_at).getTime();
    const isFresh = cacheAgeMs < CACHE_TTL_MS;

    // Only trust the cache for finished matches if it actually has lineup/stats data.
    if ((isFinished && hasData) || isFresh) {
      return { details: cached, venueName, venueCity, referee };
    }
  }

  // Fetch full details (events / lineups / statistics).
  const fresh = await footballApi.getMatchDetails(matchId);
  if (!fresh) return { details: cached ?? null, venueName, venueCity, referee };

  const newRecord: Omit<DbMatchDetails, "updated_at"> = {
    match_id: matchId,
    events: fresh.events.map((event) => ({
      ...event,
      player: {
        ...event.player,
        id: event.player.id ?? 0,
        name: event.player.name ?? "",
      },
    })),
    lineups: fresh.lineups,
    statistics: fresh.statistics,
  };

  const { error: detailsError } = await supabaseAdmin
    .from("match_details")
    .upsert(newRecord, { onConflict: "match_id" });

  if (detailsError) {
    console.error("❌ match_details upsert error:", detailsError.message);
  }

  return { details: newRecord as DbMatchDetails, venueName, venueCity, referee };
}
