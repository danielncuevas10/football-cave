"use server";

import { supabaseAdmin } from "@/lib/server/supabase-admin";
import type { FixtureStatus, TeamStatistics } from "@/types/sports";

const FINISHED: FixtureStatus[] = ["FT", "AET", "PEN", "AWD", "WO"];

export interface TeamFormStats {
  goalsScored: number;
  goalsConceded: number;
  cleanSheets: number;
  games: number;
  possession: number | null;
  passAccuracy: number | null;
}

type StatPair = { home: number | null; away: number | null };

interface DbMatchRow {
  id: number;
  home_logo: string | null;
  away_logo: string | null;
  home_score: number | null;
  away_score: number | null;
  fixture_date: string;
}

async function fetchTeamForm(logoUrl: string, excludeLogo: string): Promise<DbMatchRow[]> {
  const [home, away] = await Promise.all([
    supabaseAdmin
      .from("matches")
      .select("id, home_logo, away_logo, home_score, away_score, fixture_date")
      .eq("home_logo", logoUrl)
      .neq("away_logo", excludeLogo)
      .in("status", FINISHED)
      .order("fixture_date", { ascending: false })
      .limit(5),
    supabaseAdmin
      .from("matches")
      .select("id, home_logo, away_logo, home_score, away_score, fixture_date")
      .eq("away_logo", logoUrl)
      .neq("home_logo", excludeLogo)
      .in("status", FINISHED)
      .order("fixture_date", { ascending: false })
      .limit(5),
  ]);

  const all = [...(home.data ?? []), ...(away.data ?? [])] as DbMatchRow[];
  const seen = new Set<number>();
  return all
    .filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    })
    .sort(
      (a, b) =>
        new Date(b.fixture_date).getTime() - new Date(a.fixture_date).getTime()
    )
    .slice(0, 5);
}

function extractStat(statistics: TeamStatistics[], type: string): StatPair {
  const get = (idx: number): number | null => {
    const stat = statistics[idx]?.statistics?.find((s) => s.type === type);
    if (!stat?.value) return null;
    const v = parseFloat(String(stat.value));
    return isNaN(v) ? null : v;
  };
  return { home: get(0), away: get(1) };
}

function computeStats(
  matches: DbMatchRow[],
  logoUrl: string,
  possStats: Map<number, StatPair>,
  passStats: Map<number, StatPair>
): TeamFormStats {
  let scored = 0, conceded = 0, cleanSheets = 0;
  let totalPoss = 0, possCount = 0, totalPass = 0, passCount = 0;

  for (const m of matches) {
    const isHome = m.home_logo === logoUrl;
    const gs = isHome ? m.home_score ?? 0 : m.away_score ?? 0;
    const gc = isHome ? m.away_score ?? 0 : m.home_score ?? 0;
    scored += gs;
    conceded += gc;
    if (gc === 0) cleanSheets++;

    const poss = possStats.get(m.id);
    const p = poss ? (isHome ? poss.home : poss.away) : null;
    if (p != null) { totalPoss += p; possCount++; }

    const pass = passStats.get(m.id);
    const pa = pass ? (isHome ? pass.home : pass.away) : null;
    if (pa != null) { totalPass += pa; passCount++; }
  }

  const n = matches.length || 1;
  return {
    goalsScored: scored / n,
    goalsConceded: conceded / n,
    cleanSheets,
    games: matches.length,
    possession: possCount > 0 ? Math.round(totalPoss / possCount) : null,
    passAccuracy: passCount > 0 ? Math.round(totalPass / passCount) : null,
  };
}

export async function getFormStats(
  homeLogoUrl: string,
  awayLogoUrl: string
): Promise<{ home: TeamFormStats; away: TeamFormStats }> {
  const [homeForm, awayForm] = await Promise.all([
    fetchTeamForm(homeLogoUrl, awayLogoUrl),
    fetchTeamForm(awayLogoUrl, homeLogoUrl),
  ]);

  const allMatchIds = [...homeForm, ...awayForm].map((m) => m.id);
  const possStats = new Map<number, StatPair>();
  const passStats = new Map<number, StatPair>();

  if (allMatchIds.length > 0) {
    const { data: detailsRows } = await supabaseAdmin
      .from("match_details")
      .select("match_id, statistics")
      .in("match_id", allMatchIds);

    for (const row of detailsRows ?? []) {
      const stats = row.statistics as TeamStatistics[];
      possStats.set(row.match_id, extractStat(stats, "Ball Possession"));
      passStats.set(row.match_id, extractStat(stats, "Passes %"));
    }
  }

  return {
    home: computeStats(homeForm, homeLogoUrl, possStats, passStats),
    away: computeStats(awayForm, awayLogoUrl, possStats, passStats),
  };
}
