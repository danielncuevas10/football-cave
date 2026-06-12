// src/app/league/[id]/page.tsx

export const revalidate = 300; // re-render with fresh standings every 5 minutes

import { supabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import LeagueTabs from "@/components/info/LeagueTabs";
import { getOrSyncLeagueData, syncStandingsForLeague } from "@/lib/server/sync-league";
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

  // For World Cup, season 2026 is stored in the API under the current calendar year,
  // but getCurrentSeason() returns year-1 in June (month < 6). Use the season from
  // the existing DB rows (already correct), or fall back to the current year.
  const syncSeason =
    leagueId === League.WorldCup
      ? (standings[0]?.season ?? new Date().getFullYear())
      : season;

  const STALE_AFTER_MS = 2 * 60 * 60 * 1000; // 2 hours

  if (standings.length === 0) {
    // Initial load — fetch everything from the API and seed the DB
    const synced = await getOrSyncLeagueData(leagueId, syncSeason);
    standings = synced.standings;
  } else {
    const latestUpdate = Math.max(
      ...standings.map((s) => new Date(s.updated_at).getTime())
    );
    if (Date.now() - latestUpdate > STALE_AFTER_MS) {
      // Data is older than 2 hours — re-sync from the API then re-fetch from DB
      await syncStandingsForLeague(leagueId, syncSeason);
      const { data: fresh } = await (leagueId === League.WorldCup
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
            .order("rank", { ascending: true }));
      if (fresh?.length) standings = fresh;
    }
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
