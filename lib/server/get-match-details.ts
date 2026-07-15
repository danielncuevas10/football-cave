import { supabaseAdmin } from "@/lib/server/supabase-admin";
import { footballApi } from "@/lib/server/football-api";
import type { DbMatchDetails } from "@/types/sports";

const FINISHED_STATUSES = ["FT", "AET", "PEN", "AWD", "WO"];
const CACHE_TTL_MS = 60_000;
// How long to wait before retrying a finished match whose API data is still
// incomplete (API itself missing goals). Prevents burning quota on every ISR cycle.
const STALE_RETRY_MS = 15 * 60 * 1000;

export interface MatchDetailsResult {
  details: DbMatchDetails | null;
  venueName: string | null;
  venueCity: string | null;
  referee: string | null;
}

function countGoals(events: { type: string; detail: string }[] | null | undefined): number {
  return (events ?? []).filter(
    (e) => e.type === "Goal" && e.detail !== "Missed Penalty"
  ).length;
}

function hasShootoutData(events: { type: string; detail?: string; time?: { elapsed: number } }[] | null | undefined): boolean {
  return (events ?? []).some(
    (e) =>
      e.type === "penaltyResult" ||
      (e.type === "Goal" &&
        (e.detail === "Penalty" || e.detail === "Missed Penalty") &&
        (e.time?.elapsed ?? 0) >= 90)
  );
}

export async function getMatchDetails(
  matchId: number,
  knownStatus?: string,
  knownHomeScore?: number | null,
  knownAwayScore?: number | null
): Promise<MatchDetailsResult> {
  const isKnownFinished = !!knownStatus && FINISHED_STATUSES.includes(knownStatus);

  // ── Finished match fast-path ────────────────────────────────────────────────
  // Read cache once. If it has data, validate goal count against the known final
  // score so mid-match snapshots are never served as final data.
  // Three outcomes:
  //   a) cache complete  → return immediately (0 API calls)
  //   b) cache incomplete, recently retried → return stale (avoid quota burn)
  //   c) cache incomplete, not recently retried → call getMatchDetails only (1 API call)
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
      const expectedGoals = (knownHomeScore ?? 0) + (knownAwayScore ?? 0);
      const cachedGoals = countGoals(cached.events);
      const goalsMatch = expectedGoals === 0 || cachedGoals >= expectedGoals;
      // For PEN matches, also require shootout event data before treating cache as complete.
      const shootoutComplete = knownStatus !== "PEN" || hasShootoutData(cached.events);

      if (goalsMatch && shootoutComplete) {
        // (a) Cache is complete — but venue/referee may have been null when
        // the row was first written (API omits them during live play). Fetch
        // them once and persist so the next request is a true zero-API-call hit.
        const missingVenue = !cached.venue_name && !cached.venue_city && !cached.referee;
        if (missingVenue) {
          const basicData = await footballApi.getMatchById(matchId);
          const basicRow = basicData?.response?.[0];
          const freshVenueName = basicRow?.fixture?.venue?.name ?? null;
          const freshVenueCity = basicRow?.fixture?.venue?.city ?? null;
          const freshReferee = basicRow?.fixture?.referee ?? null;
          if (freshVenueName || freshVenueCity || freshReferee) {
            await supabaseAdmin
              .from("match_details")
              .update({ venue_name: freshVenueName, venue_city: freshVenueCity, referee: freshReferee })
              .eq("match_id", matchId);
            return {
              details: { ...cached, venue_name: freshVenueName, venue_city: freshVenueCity, referee: freshReferee },
              venueName: freshVenueName,
              venueCity: freshVenueCity,
              referee: freshReferee,
            };
          }
        }
        return {
          details: cached,
          venueName: cached.venue_name ?? null,
          venueCity: cached.venue_city ?? null,
          referee: cached.referee ?? null,
        };
      }

      // (b/c) Goal count mismatch — cache was snapshotted mid-match.
      const cacheAgeMs = Date.now() - new Date(cached.updated_at).getTime();
      if (cacheAgeMs < STALE_RETRY_MS) {
        // (b) We already refreshed recently; the API itself may lack the goal.
        // Return best available rather than burning quota every ISR cycle.
        return {
          details: cached,
          venueName: cached.venue_name ?? null,
          venueCity: cached.venue_city ?? null,
          referee: cached.referee ?? null,
        };
      }

      // (c) Try a targeted events-only refresh. The API response also carries
      // venue/referee — prefer that over cached nulls so stale rows self-heal.
      const fresh = await footballApi.getMatchDetails(matchId);
      if (fresh) {
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
          venue_name: fresh.fixture.venue?.name ?? cached.venue_name ?? null,
          venue_city: fresh.fixture.venue?.city ?? cached.venue_city ?? null,
          referee: fresh.fixture.referee ?? cached.referee ?? null,
        };
        await supabaseAdmin
          .from("match_details")
          .upsert(newRecord, { onConflict: "match_id" });
        return {
          details: newRecord as DbMatchDetails,
          venueName: newRecord.venue_name ?? null,
          venueCity: newRecord.venue_city ?? null,
          referee: newRecord.referee ?? null,
        };
      }

      // API failed — return stale data as fallback.
      return {
        details: cached,
        venueName: cached.venue_name ?? null,
        venueCity: cached.venue_city ?? null,
        referee: cached.referee ?? null,
      };
    }
    // Row exists but empty (e.g. pre-seeded before the match played).
    // If we attempted recently, don't burn quota retrying on every ISR cycle —
    // the cron will populate it within the next tick; page will catch up then.
    if (cached) {
      const cacheAgeMs = Date.now() - new Date(cached.updated_at).getTime();
      if (cacheAgeMs < STALE_RETRY_MS) {
        return {
          details: cached,
          venueName: cached.venue_name ?? null,
          venueCity: cached.venue_city ?? null,
          referee: cached.referee ?? null,
        };
      }
    }
    // No row, OR row is stale enough to retry — fall through to full flow below.
  }

  // ── Live / upcoming match, OR finished match with no cache ──────────────────
  // Call the lightweight fixture endpoint to sync the current score and get
  // venue/referee metadata.
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

  // Secondary cache check — for live matches the cron may have just written
  // fresh data; return it if it's within the TTL or the match is confirmed finished.
  const { data: cached } = await supabaseAdmin
    .from("match_details")
    .select("*")
    .eq("match_id", matchId)
    .single();

  if (cached) {
    const statusFromApi = basicRow?.fixture?.status?.short ?? knownStatus ?? "";
    const isFinished = FINISHED_STATUSES.includes(statusFromApi);
    const hasData =
      cached.events?.length > 0 ||
      cached.lineups?.length > 0 ||
      cached.statistics?.length > 0;
    const cacheAgeMs = Date.now() - new Date(cached.updated_at).getTime();
    const isFresh = cacheAgeMs < CACHE_TTL_MS;

    // For finished matches, validate cached goal count against the API's final
    // score so mid-match snapshots with missing goals aren't served as final data.
    const apiHomeScore = basicRow?.goals?.home ?? null;
    const apiAwayScore = basicRow?.goals?.away ?? null;
    const expectedGoals = (apiHomeScore ?? 0) + (apiAwayScore ?? 0);
    const cachedGoalCount = countGoals(cached.events);
    const goalsOk = !isFinished || expectedGoals === 0 || cachedGoalCount >= expectedGoals;

    if ((isFinished && hasData && goalsOk) || isFresh) {
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
  if (!fresh) {
    // Touch updated_at so the STALE_RETRY_MS throttle above prevents repeated
    // quota burns on every ISR render for finished matches with missing details.
    if (cached) {
      await supabaseAdmin
        .from("match_details")
        .update({ updated_at: new Date().toISOString() })
        .eq("match_id", matchId);
    }
    return { details: cached ?? null, venueName, venueCity, referee };
  }

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
