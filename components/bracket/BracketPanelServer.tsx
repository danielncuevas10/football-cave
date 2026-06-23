import { supabaseAdmin } from "@/lib/server/supabase-admin";
import type { DbMatch, DbStanding, MatchEvent, TeamLineup, TeamStatistics } from "@/types/sports";
import BracketPanel from "./BracketPanel";

const FINISHED_STATUSES = ["FT", "AET", "PEN", "AWD", "WO"];

export type GoalEntry = { name: string; minute: number; isOwnGoal: boolean };
export type GoalsMap = Record<number, { home: GoalEntry[]; away: GoalEntry[] }>;

export default async function BracketPanelServer({
  wcMatches,
}: {
  wcMatches: DbMatch[];
}) {
  const finishedIds = wcMatches
    .filter((m) => FINISHED_STATUSES.includes(m.status))
    .map((m) => m.id);

  const [standingsResult, venuesResult, goalsResult] = await Promise.all([
    supabaseAdmin
      .from("standings")
      .select("*")
      .eq("league_id", 1)
      .order("rank", { ascending: true }),
    supabaseAdmin
      .from("match_details")
      .select("match_id, venue_name, venue_city")
      .in("match_id", wcMatches.map((m) => m.id)),
    finishedIds.length > 0
      ? supabaseAdmin
          .from("match_details")
          .select("match_id, events, lineups, statistics")
          .in("match_id", finishedIds)
      : Promise.resolve({ data: [] as { match_id: number; events: unknown; lineups: unknown; statistics: unknown }[] }),
  ]);

  const wcStandings = (standingsResult.data ?? []) as DbStanding[];

  const venues: Record<number, { name: string | null; city: string | null }> = {};
  for (const d of venuesResult.data ?? []) {
    venues[d.match_id] = { name: d.venue_name ?? null, city: d.venue_city ?? null };
  }

  const goals: GoalsMap = {};
  for (const row of goalsResult.data ?? []) {
    const homeTeamId =
      (row.lineups as TeamLineup[])?.[0]?.team?.id ??
      (row.statistics as TeamStatistics[])?.[0]?.team?.id;

    const matchGoals: GoalsMap[number] = { home: [], away: [] };
    for (const ev of (row.events as MatchEvent[]) ?? []) {
      if (ev.type !== "Goal" || ev.detail === "Missed Penalty") continue;
      const isOwnGoal = ev.detail === "Own Goal";
      const eventFromHome = homeTeamId ? ev.team.id === homeTeamId : false;
      const benefitsHome = isOwnGoal ? !eventFromHome : eventFromHome;
      matchGoals[benefitsHome ? "home" : "away"].push({
        name: ev.player.name,
        minute: ev.time.elapsed,
        isOwnGoal,
      });
    }
    goals[row.match_id] = matchGoals;
  }

  return (
    <BracketPanel
      wcMatches={wcMatches}
      wcStandings={wcStandings}
      venues={venues}
      goals={goals}
    />
  );
}