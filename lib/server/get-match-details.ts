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

export async function getMatchDetails(
  matchId: number,
  knownStatus?: string
): Promise<MatchDetailsResult> {
  const isKnownFinished = !!knownStatus && FINISHED_STATUSES.includes(knownStatus);

  // For finished matches, check Supabase cache BEFORE hitting the API.
  // The score, status, and event data never change after full-time, so if
  // we already have lineup/stats data cached we can skip the API call entirely.
  if (isKnownFinished) {
    const { data: cached } = await supabaseAdmin
      .from("match_details")
      .select("*")
      .eq("match_id", matchId)
      .single();

    const hasData =
      cached &&
      (cached.events?.length > 0 || cached.lineups?.length > 0 || cached.statistics?.length > 0);

    if (hasData) {
      // Finished + full data in cache — zero API calls needed.
      return {
        details: cached,
        venueName: cached.venue_name ?? null,
        venueCity: cached.venue_city ?? null,
        referee: cached.referee ?? null,
      };
    }
  }

  // Live / upcoming match, OR finished match with no cached detail yet:
  // call the lightweight endpoint to sync the current score and get venue/referee.
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

  // Check full-details cache (events / lineups / statistics).
  const { data: cached } = await supabaseAdmin
    .from("match_details")
    .select("*")
    .eq("match_id", matchId)
    .single();

  if (cached) {
    const statusFromApi = basicRow?.fixture?.status?.short ?? knownStatus ?? "";
    const isFinished = FINISHED_STATUSES.includes(statusFromApi);
    const hasData = cached.events?.length > 0 || cached.lineups?.length > 0 || cached.statistics?.length > 0;
    const cacheAgeMs = Date.now() - new Date(cached.updated_at).getTime();
    const isFresh = cacheAgeMs < CACHE_TTL_MS;

    if ((isFinished && hasData) || isFresh) {
      return {
        details: cached,
        venueName: venueName ?? cached.venue_name ?? null,
        venueCity: venueCity ?? cached.venue_city ?? null,
        referee: referee ?? cached.referee ?? null,
      };
    }
  }

  // Cache miss or stale — fetch full details from the API.
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
    venue_name: venueName,
    venue_city: venueCity,
    referee,
  };

  const { error: detailsError } = await supabaseAdmin
    .from("match_details")
    .upsert(newRecord, { onConflict: "match_id" });

  if (detailsError) {
    console.error("❌ match_details upsert error:", detailsError.message);
  }

  return { details: newRecord as DbMatchDetails, venueName, venueCity, referee };
}