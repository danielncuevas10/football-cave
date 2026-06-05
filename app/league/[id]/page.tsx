// src/app/league/[id]/page.tsx

import { supabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import LeagueTabs from "@/components/info/LeagueTabs";
import { getOrSyncLeagueData } from "@/lib/server/sync-league";
import { League } from "@/types/sports";
import { isTournamentLeague } from "@/lib/tournament/isTournamentLeague";

interface PageProps {
  params: Promise<{ id: string }>;
}

function getCurrentSeason(): number {
  const now = new Date();
  return now.getMonth() < 6 ? now.getFullYear() - 1 : now.getFullYear();
}

function getLeagueMeta(id: number): { name: string; logo: string } {
  switch (id) {
    case League.PremierLeague:
      return {
        name: "Premier League",
        logo: "https://media.api-sports.io/football/leagues/39.png",
      };
    case League.LaLiga:
      return {
        name: "La Liga",
        logo: "https://media.api-sports.io/football/leagues/140.png",
      };
    case League.SerieA:
      return {
        name: "Serie A",
        logo: "https://media.api-sports.io/football/leagues/135.png",
      };
    case League.ChampionsLeague:
      return {
        name: "Champions League",
        logo: "https://media.api-sports.io/football/leagues/2.png",
      };
    case League.Friendly:
      return {
        name: "International Friendlies",
        logo: "https://media.api-sports.io/football/leagues/10.png",
      };
    case League.WorldCup:
      return {
        name: "FIFA World Cup",
        logo: "https://media.api-sports.io/football/leagues/1.png",
      };
    default:
      return { name: "League Competition", logo: "" };
  }
}

export default async function LeaguePage({ params }: PageProps) {
  const { id } = await params;
  const leagueId = parseInt(id);

  if (isNaN(leagueId)) notFound();

  const season = getCurrentSeason();
  const isTournament = isTournamentLeague(leagueId);
  const meta = getLeagueMeta(leagueId);

  // For the World Cup, skip the season filter — the data may have been stored
  // under any season. For all other leagues, filter by the current season.
  const standingsQuery =
    leagueId === League.WorldCup
      ? supabase
          .from("standings")
          .select("*")
          .eq("league_id", leagueId)
          .order("rank", { ascending: true })
      : supabase
          .from("standings")
          .select("*")
          .eq("league_id", leagueId)
          .eq("season", season)
          .order("rank", { ascending: true });

  const [standingsResult, scorersResult, matchesResult] = await Promise.all([
    standingsQuery,
    supabase
      .from("top_scorers")
      .select("*")
      .eq("league_id", leagueId)
      .eq("season", season)
      .order("goals", { ascending: false })
      .limit(20),
    supabase
      .from("matches")
      .select("*")
      .eq("league_id", leagueId)
      .order("fixture_date", { ascending: true }),
  ]);

  let standings = standingsResult.data ?? [];

  // If standings are missing entirely, trigger a live sync from the API.
  if (standings.length === 0) {
    const synced = await getOrSyncLeagueData(leagueId, season);
    standings = synced.standings;
  }

  if (!standings.length && !matchesResult.data?.length) {
    notFound();
  }

  return (
    <main className="max-w-3xl bg-[#1B1B1B] mx-auto p-6 text-white min-h-screen">
      <LeagueTabs
        standings={standings}
        scorers={scorersResult.data ?? []}
        matches={matchesResult.data ?? []}
        leagueName={meta.name}
        leagueLogo={meta.logo}
        leagueId={leagueId}
        isTournament={isTournament}
      />
    </main>
  );
}
