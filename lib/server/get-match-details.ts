import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/server/supabase-admin";
import { footballApi } from "@/lib/server/football-api";
import type { DbMatchDetails } from "@/types/sports";

const FINISHED_STATUSES = ["FT", "AET", "PEN", "AWD", "WO"];
const CACHE_TTL_MS = 60_000;

export async function getMatchDetails(matchId: number): Promise<DbMatchDetails | null> {
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
    // A record written before kickoff (when the API returns empty arrays) must be refreshed.
    if ((isFinished && hasData) || isFresh) {
      return cached;
    }
  }

  // Step 1: sync the score using the lightweight getMatchById (simple schema,
  // much less likely to fail Zod). This runs regardless of whether the full
  // details fetch below succeeds.
  const basicData = await footballApi.getMatchById(matchId);
  const basicRow = basicData?.response?.[0];
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

  // Step 2: try to get full details (events / lineups / statistics).
  // If this fails the score is already synced above, so we just return cached.
  const fresh = await footballApi.getMatchDetails(matchId);
  if (!fresh) return cached ?? null;

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

  return newRecord as DbMatchDetails;
}
