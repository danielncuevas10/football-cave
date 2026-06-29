// src/app/league/[id]/page.tsx

export const revalidate = 300; // re-render with fresh standings every 5 minutes

import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { supabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import LeagueTabs from "@/components/info/LeagueTabs";
import MatchCarouselServer from "@/components/bracket/MatchCarouselServer";
import TopScorers from "@/components/info/scorer/page";
import BackButton from "@/components/ui/BackButton";
import {
  getOrSyncLeagueData,
  syncStandingsForLeague,
  syncScorersForLeague,
  syncScorersFromEvents,
} from "@/lib/server/sync-league";
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

  // World Cup scorers are stored under the current calendar year (2026),
  // not the cross-year season returned by getCurrentSeason() (2025 in June).
  const scorersQuery =
    leagueId === League.WorldCup
      ? supabase
          .from("top_scorers")
          .select("*")
          .eq("league_id", leagueId)
          .gt("goals", 0)
          .order("goals", { ascending: false })
          .limit(20)
      : supabase
          .from("top_scorers")
          .select("*")
          .eq("league_id", leagueId)
          .eq("season", season)
          .gt("goals", 0)
          .order("goals", { ascending: false })
          .limit(20);

  const [standingsResult, scorersResult, matchesResult] = await Promise.all([
    standingsQuery,
    scorersQuery,
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
      ? standings[0]?.season ?? new Date().getFullYear()
      : season;

  const STALE_AFTER_MS = 30 * 60 * 1000; // 30 minutes

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

  // Sync scorers when missing or stale (same 30-min threshold as standings)
  let scorers = scorersResult.data ?? [];
  const scorersSyncSeason =
    leagueId === League.WorldCup
      ? scorers[0]?.season ?? standings[0]?.season ?? new Date().getFullYear()
      : season;

  if (scorers.length === 0) {
    await syncScorersFromEvents(leagueId, scorersSyncSeason);
    await syncScorersForLeague(leagueId, scorersSyncSeason);
    const { data: fresh } = await scorersQuery;
    if (fresh?.length) scorers = fresh;
  } else {
    const latestScorersUpdate = Math.max(
      ...scorers.map((s) => new Date(s.updated_at).getTime())
    );
    if (Date.now() - latestScorersUpdate > STALE_AFTER_MS) {
      await syncScorersFromEvents(leagueId, scorersSyncSeason);
      await syncScorersForLeague(leagueId, scorersSyncSeason);
      const { data: fresh } = await scorersQuery;
      if (fresh?.length) scorers = fresh;
    }
  }

  if (!standings.length && !matchesResult.data?.length) {
    notFound();
  }

  const wcMatches = matchesResult.data ?? [];
  const isWorldCup = leagueId === League.WorldCup;

  if (isWorldCup) {
    const tBadge = await getTranslations("liveBadge");

    return (
      <div className="bg-background text-white px-6 min-h-screen">
        {/* ── Mobile layout ── */}
        <main className="lg:hidden pt-6 pb-6">
          <LeagueTabs
            standings={standings}
            scorers={scorers}
            matches={wcMatches}
            leagueName={meta.name}
            leagueLogo={meta.logo}
            leagueId={leagueId}
            isTournament={isTournament}
          />
        </main>

        {/* ── Desktop layout ── */}
        <div className="hidden lg:flex flex-col max-w-7xl lg:max-w-360 mx-auto">
          {/* Back button */}
          <div className="pt-6 pb-3">
            <BackButton />
          </div>

          {/* Header row: SVG (left) and carousel (right) share the same CSS grid row
              so they automatically have the same height at every viewport width. */}
          <div className="grid grid-cols-[1fr_42%]">
            <div className="overflow-hidden rounded-xl relative lg:h-full">
              <img
                src="/images/WC26.svg"
                alt="FIFA World Cup 2026"
                className="w-full h-auto object-cover lg:hidden"
              />
              <img
                src="/images/WC262.svg"
                alt="FIFA World Cup 2026 Large"
                className="hidden lg:block w-full h-full object-cover"
              />
              <span className="absolute inset-0 flex items-center justify-center text-black text-[18px] font-sans font-medium tracking-[0.5em] uppercase pointer-events-none">
                {tBadge("worldCup")}
              </span>
            </div>
            <div className="pl-6 flex flex-col h-full">
              <Suspense fallback={<CarouselSkeleton />}>
                <MatchCarouselServer wcMatches={wcMatches} />
              </Suspense>
            </div>
          </div>

          {/* Content row: tabs + group stage (left) | scorers (right).
              pt-6 on main + tab bar (~40px) + space-y-6 gap (24px) = 88px before
              the group stage starts. pt-22 (88px) on the right aligns scorers. */}
          <div className="flex">
            <main className="flex-1 min-w-0 pt-6 pb-6">
              <LeagueTabs
                standings={standings}
                scorers={scorers}
                matches={wcMatches}
                leagueName={meta.name}
                leagueLogo={meta.logo}
                leagueId={leagueId}
                isTournament={isTournament}
                renderHeader={null}
              />
            </main>
            <div className="w-[42%] shrink-0 pl-6 pb-6 pt-22">
              <TopScorers
                scorers={scorers}
                isWorldCup={false}
                defaultView="allTime"
                channelId="top-scorers-sidebar"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="max-w-3xl bg-background mx-auto p-6 text-white min-h-screen">
      <LeagueTabs
        standings={standings}
        scorers={scorers}
        matches={wcMatches}
        leagueName={meta.name}
        leagueLogo={meta.logo}
        leagueId={leagueId}
        isTournament={isTournament}
      />
    </main>
  );
}

function CarouselSkeleton() {
  return (
    <div className="flex flex-col gap-3 animate-pulse flex-1">
      <div className="flex-1 rounded-xl bg-custom-gray" />
    </div>
  );
}
