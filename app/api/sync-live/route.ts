import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/server/supabase-admin";
import { footballApi } from "@/lib/server/football-api";
import { standardizeRound } from "@/lib/sync/standardizeRound";
import { syncStandingsForLeague } from "@/lib/server/sync-league";
import { LIVE_STATUSES } from "@/types/sports";
import type { DbMatch } from "@/types/sports";
import { verifyCronSecret } from "@/lib/api-guard";

const TRACKED_LEAGUES = (process.env.TRACKED_LEAGUE_IDS ?? "")
  .split(",")
  .map(Number)
  .filter(Boolean);

/**
 * Normalises events and, for PEN matches where the API omits individual kick
 * events, appends a synthetic "penaltyResult" event so the UI can display the
 * shootout score even without per-kick data.
 */
function buildEvents(details: {
  fixture: { status: { short: string } };
  score?: { penalty?: { home: number | null; away: number | null } | null } | null;
  events: { type: string; detail: string; time: { elapsed: number; extra?: number | null }; team: { id: number; name: string; logo: string }; player: { id: number | null; name: string | null }; assist?: { id: number | null; name: string | null } | null }[];
}) {
  const events = details.events.map((ev) => ({
    ...ev,
    player: { ...ev.player, id: ev.player.id ?? 0, name: ev.player.name ?? "" },
  }));

  const isPenMatch = details.fixture.status.short === "PEN";
  const pen = details.score?.penalty;
  if (isPenMatch && pen?.home != null && pen?.away != null) {
    const hasKicks = events.some(
      (ev) =>
        ev.type === "Goal" &&
        (ev.detail === "Penalty" || ev.detail === "Missed Penalty") &&
        ev.time.elapsed >= 120
    );
    if (!hasKicks) {
      events.push({
        type: "penaltyResult",
        detail: `${pen.home}–${pen.away}`,
        time: { elapsed: 121, extra: null },
        team: { id: 0, name: "", logo: "" },
        player: { id: 0, name: "" },
        assist: null,
      });
    }
  }

  return events;
}

export async function GET(req: NextRequest) {
  const blocked = verifyCronSecret(req);
  if (blocked) return blocked;

  // Guard: skip the API call entirely when there is nothing to watch.
  // Two cheap Supabase count queries run in parallel:
  //   a) any match the DB currently considers live
  //   b) any NS/TBD match whose kickoff falls in [-3h, +15min] —
  //      catches matches that just started (cron may have missed the flip)
  //      and matches about to kick off.
  const windowStart = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
  const windowEnd   = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const [{ count: liveCount }, { count: imminentCount }] = await Promise.all([
    supabaseAdmin
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("is_live", true),
    supabaseAdmin
      .from("matches")
      .select("id", { count: "exact", head: true })
      .in("status", ["NS", "TBD"])
      .gte("fixture_date", windowStart)
      .lte("fixture_date", windowEnd),
  ]);

  if (liveCount === 0 && imminentCount === 0) {
    console.log("[sync-live] skipped — nothing to watch");
    return NextResponse.json({ live: 0, closed: 0, standings_synced: 0, skipped: true });
  }

  console.log(`[sync-live] proceeding — liveCount=${liveCount} imminentCount=${imminentCount}`);

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

    // Fetch and cache events/lineups/stats for each live match so the client
    // can poll match_details without burning any extra API quota.
    // One call per live match per cron run — the cron is the sole API caller.
    await Promise.all(
      liveFromApi.map(async (m) => {
        try {
          const fresh = await footballApi.getMatchDetails(m.fixture.id);
          if (!fresh) return;
          await supabaseAdmin.from("match_details").upsert(
            {
              match_id: m.fixture.id,
              events: fresh.events.map((ev) => ({
                ...ev,
                player: {
                  ...ev.player,
                  id: ev.player.id ?? 0,
                  name: ev.player.name ?? "",
                },
              })),
              lineups: fresh.lineups,
              statistics: fresh.statistics,
            },
            { onConflict: "match_id" }
          );
        } catch (e) {
          console.error(`[sync-live] event cache failed for ${m.fixture.id}:`, e);
        }
      })
    );
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

  const affectedLeagues = new Map<number, number>(); // leagueId → season

  if (ghostIds.length > 0) {
    // Fetch all ghost statuses from the API in parallel (same as before)
    const ghostResults = await Promise.all(
      ghostIds.map(async (id) => {
        const result = await footballApi.getMatchById(id);
        return { id, apiRow: result?.response?.[0] ?? null };
      })
    );

    const resolved  = ghostResults.filter(r => r.apiRow !== null);
    const vanishedIds = ghostResults.filter(r => r.apiRow === null).map(r => r.id);

    // One upsert for matches where the API returned real final data
    if (resolved.length > 0) {
      await supabaseAdmin.from("matches").upsert(
        resolved.map(r => {
          const row = r.apiRow!;
          return {
            id:         row.fixture.id,
            home_team:  row.teams.home.name,
            away_team:  row.teams.away.name,
            home_logo:  row.teams.home.logo ?? null,
            away_logo:  row.teams.away.logo ?? null,
            home_score: row.goals.home,
            away_score: row.goals.away,
            status:     row.fixture.status.short,
            fixture_date: row.fixture.date,
            league_id:  row.league.id,
            league_name: row.league.name,
            league_logo: row.league.logo ?? null,
            round:      row.league.round ?? null,
            stage:      standardizeRound(row.league.round),
            elapsed:    row.fixture.status.elapsed,
            is_live:    false,
            updated_at: new Date().toISOString(),
          };
        }),
        { onConflict: "id" }
      );
      resolved.forEach(r => affectedLeagues.set(r.apiRow!.league.id, r.apiRow!.league.season));

      // Final event sync for matches that just finished — captures stoppage-time
      // goals/cards that arrived after the last live-sync run.
      await Promise.all(
        resolved.map(async ({ id }) => {
          try {
            const details = await footballApi.getMatchDetails(id);
            if (!details) return;
            await supabaseAdmin.from("match_details").upsert(
              {
                match_id: id,
                events: buildEvents(details),
                lineups: details.lineups,
                statistics: details.statistics,
              },
              { onConflict: "match_id" }
            );
          } catch (e) {
            console.error(`[sync-live] final event sync failed for ${id}:`, e);
          }
        })
      );
    }

    // One bulk update for matches the API no longer knows about
    if (vanishedIds.length > 0) {
      await supabaseAdmin.from("matches")
        .update({ is_live: false, status: "FT", updated_at: new Date().toISOString() })
        .in("id", vanishedIds);
    }
  }

  // 3. Clean up stale NS/TBD matches that should have finished but were never
  //    updated (happens when the cron was timing out and missing match endings).
  //    Only runs when the API reports no live matches right now, so we know
  //    any NS/TBD match 2.5h+ past kickoff is definitely done.
  if (liveFromApi.length === 0) {
    const staleCutoff = new Date(Date.now() - 2.5 * 60 * 60 * 1000).toISOString();
    let staleQuery = supabaseAdmin
      .from("matches")
      .select("id")
      .in("status", ["NS", "TBD"])
      .lt("fixture_date", staleCutoff)
      .limit(10); // cap to avoid excessive API calls in one run

    if (TRACKED_LEAGUES.length > 0) {
      staleQuery = staleQuery.in("league_id", TRACKED_LEAGUES);
    }

    const { data: staleRows } = await staleQuery;

    if (staleRows && staleRows.length > 0) {
      console.log(`[sync-live] cleaning up ${staleRows.length} stale NS/TBD matches`);

      // Fetch all stale statuses in parallel
      const staleResults = await Promise.all(
        staleRows.map(async ({ id }) => {
          const result = await footballApi.getMatchById(id);
          return { id, apiRow: result?.response?.[0] ?? null };
        })
      );

      const staleResolved  = staleResults.filter(r => r.apiRow !== null);
      const staleVanishedIds = staleResults.filter(r => r.apiRow === null).map(r => r.id);

      if (staleResolved.length > 0) {
        await supabaseAdmin.from("matches").upsert(
          staleResolved.map(r => {
            const row = r.apiRow!;
            return {
              id:         row.fixture.id,
              home_team:  row.teams.home.name,
              away_team:  row.teams.away.name,
              home_logo:  row.teams.home.logo ?? null,
              away_logo:  row.teams.away.logo ?? null,
              home_score: row.goals.home,
              away_score: row.goals.away,
              status:     row.fixture.status.short,
              fixture_date: row.fixture.date,
              league_id:  row.league.id,
              league_name: row.league.name,
              league_logo: row.league.logo ?? null,
              round:      row.league.round ?? null,
              stage:      standardizeRound(row.league.round),
              elapsed:    row.fixture.status.elapsed,
              is_live:    false,
              updated_at: new Date().toISOString(),
            };
          }),
          { onConflict: "id" }
        );
        staleResolved.forEach(r => affectedLeagues.set(r.apiRow!.league.id, r.apiRow!.league.season));

        // Final event sync for stale matches being closed out.
        await Promise.all(
          staleResolved.map(async ({ id }) => {
            try {
              const details = await footballApi.getMatchDetails(id);
              if (!details) return;
              await supabaseAdmin.from("match_details").upsert(
                {
                  match_id: id,
                  events: buildEvents(details),
                  lineups: details.lineups,
                  statistics: details.statistics,
                },
                { onConflict: "match_id" }
              );
            } catch (e) {
              console.error(`[sync-live] final event sync failed for stale ${id}:`, e);
            }
          })
        );
      }

      if (staleVanishedIds.length > 0) {
        await supabaseAdmin.from("matches")
          .update({ is_live: false, status: "FT", updated_at: new Date().toISOString() })
          .in("id", staleVanishedIds);
      }
    }
  }

  // 4. Refresh standings for every league that had a match finish
  for (const [leagueId, season] of affectedLeagues) {
    try {
      await syncStandingsForLeague(leagueId, season);
    } catch (e) {
      console.error(`Failed to sync standings for league ${leagueId}:`, e);
    }
  }

  return NextResponse.json({
    live: liveFromApi.length,
    closed: ghostIds.length,
    standings_synced: affectedLeagues.size,
  });
}
