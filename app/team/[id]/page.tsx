export const revalidate = 300;

import { supabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import BackButton from "@/components/ui/BackButton";
import TeamTabs from "@/components/info/TeamTabs";
import { getMatchDetails } from "@/lib/server/get-match-details";
import type { DbMatch } from "@/types/sports";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TeamPage({ params }: PageProps) {
  const { id } = await params;
  const teamId = parseInt(id);
  if (isNaN(teamId)) notFound();

  const teamLogoUrl = `https://media.api-sports.io/football/teams/${teamId}.png`;

  const [homeResult, awayResult, standingResult] = await Promise.all([
    supabase
      .from("matches")
      .select("*")
      .eq("home_logo", teamLogoUrl)
      .order("fixture_date", { ascending: true }),
    supabase
      .from("matches")
      .select("*")
      .eq("away_logo", teamLogoUrl)
      .order("fixture_date", { ascending: true }),
    supabase
      .from("standings")
      .select("*")
      .eq("team_id", teamId)
      .limit(1)
      .maybeSingle(),
  ]);

  // Merge and deduplicate by match id
  const seen = new Set<number>();
  const matches: DbMatch[] = [
    ...(homeResult.data ?? []),
    ...(awayResult.data ?? []),
  ]
    .sort(
      (a, b) =>
        new Date(a.fixture_date).getTime() - new Date(b.fixture_date).getTime()
    )
    .filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });

  const teamStanding = standingResult.data ?? null;

  const teamName = (() => {
    const first = matches[0];
    if (!first) return teamStanding?.team_name ?? "Team";
    return first.home_logo === teamLogoUrl ? first.home_team : first.away_team;
  })();

  // Full league standings so the table shows all teams in context
  let standings = [];
  if (teamStanding) {
    const { data } = await supabase
      .from("standings")
      .select("*")
      .eq("league_id", teamStanding.league_id)
      .eq("season", teamStanding.season)
      .order("rank", { ascending: true });
    standings = data ?? [];
  }

  if (!matches.length && !standings.length) notFound();

  // Get manager name from the most recent finished match's lineup.
  // getMatchDetails handles the DB cache and falls back to the API automatically.
  let managerName: string | null = null;
  const FINISHED = ["FT", "AET", "PEN", "AWD", "WO"];
  const recentFinished = matches
    .filter((m) => FINISHED.includes(m.status))
    .sort(
      (a, b) =>
        new Date(b.fixture_date).getTime() - new Date(a.fixture_date).getTime()
    )[0];

  if (recentFinished) {
    const { details } = await getMatchDetails(
      recentFinished.id,
      recentFinished.status
    );
    if (details?.lineups) {
      const lineup = details.lineups.find((l) => l.team.id === teamId);
      managerName = lineup?.coach?.name ?? null;
    }
  }

  return (
    <main className="w-full bg-[#101010] py-4 text-white space-y-6">
      <div className="flex justify-start px-4">
        <BackButton />
      </div>
      <TeamTabs
        teamId={teamId}
        teamName={teamName}
        teamLogoUrl={teamLogoUrl}
        matches={matches}
        standings={standings}
        leagueId={teamStanding?.league_id ?? null}
        managerName={managerName}
      />
    </main>
  );
}
