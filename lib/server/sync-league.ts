import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/server/supabase-admin";
import { footballApi } from "@/lib/server/football-api";
import { redis } from "@/lib/ratelimit";
import type { DbStanding, DbTopScorer } from "@/types/sports";

// Prevents duplicate Football API calls when concurrent requests (page renders
// or cron runs) try to sync the same league simultaneously. The lock expires
// automatically after `ttlSeconds` even if the holder crashes mid-flight.
async function withSyncLock<T>(
  key: string,
  ttlSeconds: number,
  fn: () => Promise<T>
): Promise<T | null> {
  const acquired = await redis.set(key, "1", { nx: true, ex: ttlSeconds })
  if (!acquired) {
    console.log(`[sync-lock] skipped ${key} — already in progress`)
    return null
  }
  try {
    return await fn()
  } finally {
    await redis.del(key)
  }
}

/**
 * Recomputes group-stage standings entirely from the `matches` table —
 * no external API call. Called the instant a match finishes so the DB
 * reflects the correct standings before API-Football's own cache clears.
 *
 * Safety: only writes columns it computes (played/won/drawn/lost/GF/GA/
 * points/rank). Preserves team_id, team_logo, group_name from existing
 * rows via upsert. Never deletes rows. The in-memory "reset to 0" is just
 * the accumulator — it never writes a 0 that isn't genuinely correct.
 *
 * Returns true if GROUP matches were found and standings were updated,
 * false if no group-stage matches exist yet (e.g. regular league or
 * tournament hasn't kicked off) — caller uses this to decide whether to
 * fire an API fallback.
 */
export async function recomputeGroupStandings(
  leagueId: number,
  season: number
): Promise<boolean> {
  // 1. All finished group-stage matches (stage = "GROUP" set by standardizeRound)
  const { data: groupMatches } = await supabaseAdmin
    .from("matches")
    .select("home_team, away_team, home_score, away_score")
    .eq("league_id", leagueId)
    .eq("stage", "GROUP")
    .in("status", ["FT", "AET", "PEN"]);

  if (!groupMatches?.length) return false;

  // 2. Existing standings rows — source of truth for team_id / logo / group
  const { data: existing } = await supabaseAdmin
    .from("standings")
    .select("team_id, team_name, team_logo, group_name")
    .eq("league_id", leagueId)
    .eq("season", season);

  if (!existing?.length) return false;

  // 3. Name → metadata map (lower-cased for safe matching)
  type Meta = { team_id: number; team_name: string; team_logo: string; group_name: string | null };
  const byName = new Map<string, Meta>();
  for (const row of existing) {
    byName.set(row.team_name.toLowerCase().trim(), {
      team_id: row.team_id,
      team_name: row.team_name,
      team_logo: row.team_logo,
      group_name: row.group_name ?? null,
    });
  }

  // 4. In-memory accumulators — start every known team at zero
  type Acc = Meta & { played: number; won: number; drawn: number; lost: number; goals_for: number; goals_against: number; points: number };
  const acc = new Map<number, Acc>();
  for (const meta of byName.values()) {
    acc.set(meta.team_id, { ...meta, played: 0, won: 0, drawn: 0, lost: 0, goals_for: 0, goals_against: 0, points: 0 });
  }

  // 5. Accumulate every finished group match
  for (const m of groupMatches) {
    if (m.home_score === null || m.away_score === null) continue;
    const home = byName.get(m.home_team.toLowerCase().trim());
    const away = byName.get(m.away_team.toLowerCase().trim());
    if (!home || !away) continue;

    const h = acc.get(home.team_id)!;
    const a = acc.get(away.team_id)!;

    h.played++; a.played++;
    h.goals_for += m.home_score; h.goals_against += m.away_score;
    a.goals_for += m.away_score; a.goals_against += m.home_score;

    if (m.home_score > m.away_score) {
      h.won++; h.points += 3; a.lost++;
    } else if (m.away_score > m.home_score) {
      a.won++; a.points += 3; h.lost++;
    } else {
      h.drawn++; h.points += 1; a.drawn++; a.points += 1;
    }
  }

  // 6. Sort within each group and assign rank
  //    Order: points → GD → GF → team name (stable for display; API verify corrects exact ties)
  const byGroup = new Map<string, Acc[]>();
  for (const t of acc.values()) {
    const g = t.group_name ?? "__ungrouped__";
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g)!.push(t);
  }

  const now = new Date().toISOString();
  const rows: object[] = [];

  for (const groupTeams of byGroup.values()) {
    groupTeams.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const gdDiff = (b.goals_for - b.goals_against) - (a.goals_for - a.goals_against);
      if (gdDiff !== 0) return gdDiff;
      if (b.goals_for !== a.goals_for) return b.goals_for - a.goals_for;
      return a.team_name.localeCompare(b.team_name);
    });

    groupTeams.forEach((t, i) => {
      rows.push({
        team_id: t.team_id,
        team_name: t.team_name,
        team_logo: t.team_logo,
        league_id: leagueId,
        season,
        rank: i + 1,
        points: t.points,
        played: t.played,
        won: t.won,
        drawn: t.drawn,
        lost: t.lost,
        goals_for: t.goals_for,
        goals_against: t.goals_against,
        group_name: t.group_name,
        updated_at: now,
      });
    });
  }

  await supabaseAdmin
    .from("standings")
    .upsert(rows, { onConflict: "team_id,league_id,season" });

  return true;
}

export async function syncStandingsForLeague(leagueId: number, season: number): Promise<void> {
  await withSyncLock(`sync:standings:${leagueId}:${season}`, 120, async () => {
    const freshStandings = await footballApi.standings(leagueId, season);
    if (!freshStandings?.response?.[0]?.league?.standings) return;

    const allGroups = freshStandings.response[0].league.standings;
    const rawRows = allGroups.flat();

    const seenTeamIds = new Set<number>();
    const dbRows = rawRows
      .filter((row: any) => {
        // Skip only the flat "Group Stage" aggregate row — regular leagues have no
        // group field at all (or a descriptive name) and must NOT be filtered out.
        if (row.group === "Group Stage") return false;
        if (seenTeamIds.has(row.team.id)) return false;
        seenTeamIds.add(row.team.id);
        return true;
      })
      .map((row: any) => ({
        team_id: row.team.id,
        team_name: row.team.name,
        team_logo: row.team.logo,
        league_id: leagueId,
        season,
        rank: row.rank,
        points: row.points,
        played: row.all.played,
        won: row.all.win,
        drawn: row.all.draw,
        lost: row.all.lose,
        goals_for: row.all.goals.for,
        goals_against: row.all.goals.against,
        group_name: row.group || null,
        updated_at: new Date().toISOString(),
      }));

    await supabaseAdmin
      .from("standings")
      .upsert(dbRows, { onConflict: "team_id,league_id,season" });
  });
}

// Build top scorers from events+lineups already stored in match_details.
// Always up-to-date — doesn't depend on the slow /players/topscorers API endpoint.
export async function syncScorersFromEvents(leagueId: number, season: number): Promise<void> {
  const { data: matches } = await supabaseAdmin
    .from("matches")
    .select("id")
    .eq("league_id", leagueId)
    .or("status.in.(FT,AET,PEN),is_live.eq.true");

  if (!matches?.length) return;

  const { data: detailRows } = await supabaseAdmin
    .from("match_details")
    .select("events, lineups")
    .in("match_id", matches.map((m) => m.id));

  if (!detailRows?.length) return;

  type PlayerEntry = { name: string; teamName: string; goals: number; assists: number; appearances: number };
  const playerMap = new Map<number, PlayerEntry>();

  for (const detail of detailRows) {
    // Count appearances: players who started (startXI) get +1
    for (const lineup of (detail.lineups ?? [])) {
      for (const slot of (lineup.startXI ?? [])) {
        const pid = slot.player?.id;
        if (!pid || pid <= 0) continue;
        const e = playerMap.get(pid) ?? { name: slot.player.name, teamName: lineup.team.name, goals: 0, assists: 0, appearances: 0 };
        e.appearances++;
        playerMap.set(pid, e);
      }
    }

    for (const ev of (detail.events ?? [])) {
      // Substitutes who came on also get an appearance
      if (ev.type === "subst") {
        const pid = ev.assist?.id; // assist = incoming player
        if (pid && pid > 0) {
          const e = playerMap.get(pid) ?? { name: ev.assist?.name ?? "", teamName: ev.team.name, goals: 0, assists: 0, appearances: 0 };
          e.appearances++;
          playerMap.set(pid, e);
        }
        continue;
      }

      if (ev.type !== "Goal") continue;
      if (ev.detail === "Missed Penalty" || ev.detail === "Own Goal") continue;

      const pid = ev.player?.id;
      if (!pid || pid <= 0) continue;
      const e = playerMap.get(pid) ?? { name: ev.player.name, teamName: ev.team.name, goals: 0, assists: 0, appearances: 0 };
      e.goals++;
      playerMap.set(pid, e);

      const aid = ev.assist?.id;
      if (aid && aid > 0) {
        const a = playerMap.get(aid) ?? { name: ev.assist?.name ?? "", teamName: ev.team.name, goals: 0, assists: 0, appearances: 0 };
        a.assists++;
        playerMap.set(aid, a);
      }
    }
  }

  // Only persist players who scored at least one goal
  const scorers = Array.from(playerMap.entries()).filter(([, d]) => d.goals > 0);
  if (!scorers.length) return;

  // Preserve existing player_photo values
  const { data: existing } = await supabaseAdmin
    .from("top_scorers")
    .select("player_id, player_photo")
    .eq("league_id", leagueId)
    .eq("season", season);

  const photoMap = new Map((existing ?? []).map((r) => [r.player_id, r.player_photo]));
  const now = new Date().toISOString();

  const rows = scorers.map(([playerId, data]) => ({
    player_id: playerId,
    player_name: data.name,
    player_photo: photoMap.get(playerId) ?? null,
    team_name: data.teamName,
    goals: data.goals,
    assists: data.assists,
    appearances: data.appearances,
    league_id: leagueId,
    season,
    updated_at: now,
  }));

  await supabaseAdmin
    .from("top_scorers")
    .upsert(rows, { onConflict: "player_id,league_id,season" });
}

export async function syncScorersForLeague(leagueId: number, season: number): Promise<void> {
  await withSyncLock(`sync:scorers:${leagueId}:${season}`, 120, async () => {
    const freshScorers = await footballApi.topScorers(leagueId, season);
    if (!freshScorers?.response?.length) return;

    const dbRows: Omit<DbTopScorer, "updated_at">[] = freshScorers.response.map((row: any) => ({
      player_id: row.player.id,
      player_name: row.player.name,
      player_photo: row.player.photo || null,
      team_name: row.statistics[0]?.team.name || "Unknown",
      goals: row.statistics[0]?.goals.total ?? 0,
      assists: row.statistics[0]?.goals.assists ?? 0,
      appearances: row.statistics[0]?.games.appearences ?? 0,
      league_id: leagueId,
      season,
    }));

    await supabaseAdmin
      .from("top_scorers")
      .upsert(
        dbRows.map((r) => ({ ...r, updated_at: new Date().toISOString() })),
        { onConflict: "player_id,league_id,season" }
      );
  });
}

export async function getOrSyncLeagueData(leagueId: number, season: number) {
  // 1. Check if standings already exist in the database
  const { data: cachedStandings } = await supabase
    .from("standings")
    .select("*")
    .eq("league_id", leagueId)
    .eq("season", season);

  // 2. Check if top scorers already exist in the database
  const { data: cachedScorers } = await supabase
    .from("top_scorers")
    .select("*")
    .eq("league_id", leagueId)
    .eq("season", season);

  let finalStandings = cachedStandings || [];
  let finalScorers = cachedScorers || [];

  // 3. Automation Trigger: Fetch and unpack nested groups
  if (finalStandings.length === 0) {
    const freshStandings = await footballApi.standings(leagueId, season);
    
    if (freshStandings?.response?.[0]?.league?.standings) {
      // The API returns an array of arrays for the World Cup [[Group A], [Group B]...]
      // .flat() collapses them into a single list of 48 teams
      const allGroups = freshStandings.response[0].league.standings;
      const rawRows = allGroups.flat();
      
      const dbRows: Omit<DbStanding, "updated_at">[] = rawRows.map((row: any) => ({
        team_id: row.team.id,
        team_name: row.team.name,
        team_logo: row.team.logo,
        league_id: leagueId,
        season: season,
        rank: row.rank,
        points: row.points,
        played: row.all.played,
        won: row.all.win,
        drawn: row.all.draw,
        lost: row.all.lose,
        goals_for: row.all.goals.for,
        goals_against: row.all.goals.against,
        group_name: row.group || null, // ← Saves "Group A", "Group B", etc.
      }));

      // Upsert rows to prevent row stacking duplicates
      await supabaseAdmin
        .from("standings")
        .upsert(dbRows, { onConflict: "team_id,league_id,season" });
      
      // Pull clean, sorted fresh rows
      const { data: updated } = await supabase
        .from("standings")
        .select("*")
        .eq("league_id", leagueId)
        .eq("season", season)
        .order("rank", { ascending: true });
        
      if (updated) finalStandings = updated;
    }
  }

  // 4. Automation Trigger: Top Scorers
  if (finalScorers.length === 0) {
    const freshScorers = await footballApi.topScorers(leagueId, season);
    if (freshScorers?.response) {
      const dbScorers: Omit<DbTopScorer, "updated_at">[] = freshScorers.response.map((row: any) => ({
        player_id: row.player.id,
        player_name: row.player.name,
        player_photo: row.player.photo,
        team_name: row.statistics[0]?.team.name || "Unknown",
        goals: row.statistics[0]?.goals.total || 0,
        assists: row.statistics[0]?.goals.assists || 0,
        appearances: row.statistics[0]?.games.appearences || 0,
        league_id: leagueId,
        season: season,
      }));

      await supabaseAdmin
        .from("top_scorers")
        .upsert(dbScorers, { onConflict: "player_id,league_id,season" });
      
      const { data: updated } = await supabase
        .from("top_scorers")
        .select("*")
        .eq("league_id", leagueId)
        .eq("season", season)
        .order("goals", { ascending: false });
        
      if (updated) finalScorers = updated;
    }
  }

  return { standings: finalStandings, scorers: finalScorers };
}