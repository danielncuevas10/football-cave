import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/server/supabase-admin";
import { footballApi } from "@/lib/server/football-api";
import type { DbStanding, DbTopScorer } from "@/types/sports";

export async function syncStandingsForLeague(leagueId: number, season: number): Promise<void> {
  const freshStandings = await footballApi.standings(leagueId, season);
  if (!freshStandings?.response?.[0]?.league?.standings) return;

  const allGroups = freshStandings.response[0].league.standings;
  const rawRows = allGroups.flat();

  const seenTeamIds = new Set<number>();
  const dbRows = rawRows
    .filter((row: any) => {
      // Skip the flat "Group Stage" aggregate — teams appear in their real group first
      if (!row.group || row.group === "Group Stage") return false;
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
}

// Build top scorers from events+lineups already stored in match_details.
// Always up-to-date — doesn't depend on the slow /players/topscorers API endpoint.
export async function syncScorersFromEvents(leagueId: number, season: number): Promise<void> {
  const { data: matches } = await supabaseAdmin
    .from("matches")
    .select("id")
    .eq("league_id", leagueId)
    .in("status", ["FT", "AET", "PEN"]);

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