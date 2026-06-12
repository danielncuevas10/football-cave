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