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
import type { DbStanding } from "@/types/sports";
import { isTournamentLeague } from "@/lib/tournament/isTournamentLeague";

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * Returns the correct API-Football season year for a given league.
 * - MLS and Liga MX use calendar-year seasons (2026 = the 2026 season).
 * - European / international leagues start in late summer; before August
 *   the active season belongs to the previous year (e.g. July 2026 → 2025).
 */
function getSeasonForLeague(leagueId: number): number {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0 = Jan … 11 = Dec

  if (leagueId === League.MLS || leagueId === League.LigaMX) {
    return year; // calendar-year format
  }
  // European / international: season starts August, so Jul and earlier → year-1
  return month < 7 ? year - 1 : year;
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
    case League.Bundesliga:
      return {
        name: "Bundesliga",
        logo: "https://media.api-sports.io/football/leagues/78.png",
      };
    case League.Ligue1:
      return {
        name: "Ligue 1",
        logo: "https://media.api-sports.io/football/leagues/61.png",
      };
    case League.MLS:
      return {
        name: "MLS",
        logo: "https://media.api-sports.io/football/leagues/253.png",
      };
    case League.LigaMX:
      return {
        name: "Liga MX",
        logo: "https://media.api-sports.io/football/leagues/262.png",
      };
    default:
      return { name: "League Competition", logo: "" };
  }
}

export default async function LeaguePage({ params }: PageProps) {
  const { id } = await params;
  const leagueId = parseInt(id);

  if (isNaN(leagueId)) notFound();

  const season = getSeasonForLeague(leagueId);
  const isTournament = isTournamentLeague(leagueId);
  const meta = getLeagueMeta(leagueId);

  // World Cup: no season filter — data may be stored under any year.
  // Others: filter by the per-league computed season.
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

  // Resolve the season to use for API syncs.
  // WC: use the season already stored in DB; others: use the computed season.
  let syncSeason =
    leagueId === League.WorldCup
      ? standings[0]?.season ?? new Date().getFullYear()
      : season;

  const STALE_AFTER_MS = 30 * 60 * 1000; // 30 minutes

  if (standings.length === 0) {
    // Try API sync for the computed season
    const synced = await getOrSyncLeagueData(leagueId, syncSeason);
    standings = synced.standings;

    // Fallback: if API also returned nothing (e.g. off-season), show whatever
    // is already stored in the DB for any season (most recent data available).
    // Exclude UCL and LigaMX — they get their own pre-season zeroed table below.
    if (standings.length === 0 && leagueId !== League.WorldCup && leagueId !== League.ChampionsLeague && leagueId !== League.LigaMX) {
      const { data: anyStandings } = await supabase
        .from("standings")
        .select("*")
        .eq("league_id", leagueId)
        .order("rank", { ascending: true });
      if (anyStandings?.length) {
        standings = anyStandings;
        syncSeason = anyStandings[0].season;
      }
    }
  } else {
    const latestUpdate = Math.max(
      ...standings.map((s) => new Date(s.updated_at).getTime())
    );
    if (Date.now() - latestUpdate > STALE_AFTER_MS) {
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
            .eq("season", syncSeason)
            .order("rank", { ascending: true }));
      if (fresh?.length) standings = fresh;
    }
  }

  // Sync scorers when missing or stale (same 30-min threshold as standings)
  let scorers = scorersResult.data ?? [];
  const scorersSyncSeason =
    leagueId === League.WorldCup
      ? scorers[0]?.season ?? standings[0]?.season ?? new Date().getFullYear()
      : syncSeason;

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

  const now = new Date();
  const nowMonth = now.getMonth();
  const nowYear = now.getFullYear();

  // European leagues (UCL, PL, La Liga, Serie A) run Sept–May.
  // June–August is off-season — clear any stale completed-season data.
  const EUROPEAN_LEAGUES = [
    League.ChampionsLeague,
    League.PremierLeague,
    League.LaLiga,
    League.SerieA,
    League.Bundesliga,
    League.Ligue1,
  ];
  const isEuropeanOffSeason = EUROPEAN_LEAGUES.includes(leagueId) && nowMonth >= 5 && nowMonth <= 7;
  if (isEuropeanOffSeason) {
    standings = [];
    scorers = [];
  }

  // Normalize a team name for fuzzy matching: lowercase + strip diacritics.
  // Needed so "Atlético" matches "Atletico", "Alavés" matches "Alaves", etc.
  const norm = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  // ── Premier League 2026/27: use the exact known roster ──────────────────────
  // Generic DB supplement would include relegated teams and miss promoted ones.
  if (leagueId === League.PremierLeague && standings.length === 0) {
    const PL_2026_27 = [
      "Arsenal", "Aston Villa", "Bournemouth", "Brentford", "Brighton",
      "Chelsea", "Coventry City", "Crystal Palace", "Everton", "Fulham",
      "Hull City", "Ipswich Town", "Leeds United", "Liverpool",
      "Manchester City", "Manchester United", "Newcastle United",
      "Nottingham Forest", "Sunderland", "Tottenham Hotspur",
    ];

    // Build name → { team_id, logo } from historical PL standings + matches
    const { data: plHist } = await supabase
      .from("standings")
      .select("team_id, team_name, team_logo")
      .eq("league_id", League.PremierLeague)
      .order("season", { ascending: false });

    const plMap = new Map<string, { team_id: number; logo: string }>();
    for (const t of (plHist ?? [])) {
      plMap.set(norm(t.team_name), { team_id: t.team_id, logo: t.team_logo ?? "" });
    }
    for (const m of (matchesResult.data ?? [])) {
      const hl = norm(m.home_team);
      const al = norm(m.away_team);
      if (!plMap.has(hl)) plMap.set(hl, { team_id: -(plMap.size + 1), logo: m.home_logo ?? "" });
      if (!plMap.has(al)) plMap.set(al, { team_id: -(plMap.size + 1), logo: m.away_logo ?? "" });
    }

    // Partial-match lookup — handles "Brighton" → "Brighton & Hove Albion" etc.
    const findPLTeam = (name: string) => {
      const n = norm(name);
      if (plMap.has(n)) return plMap.get(n)!;
      for (const [key, val] of plMap) {
        if (key.includes(n) || n.includes(key)) return val;
      }
      return null;
    };

    let pseudoId = -1000;
    standings = PL_2026_27.map((name, i) => {
      const found = findPLTeam(name);
      return {
        team_id: found?.team_id ?? pseudoId--,
        team_name: name,
        team_logo: found?.logo ?? "",
        league_id: League.PremierLeague,
        season: nowYear,
        rank: i + 1,
        points: 0, played: 0, won: 0, drawn: 0, lost: 0,
        goals_for: 0, goals_against: 0,
        updated_at: now.toISOString(),
        group_name: null,
      };
    });
  }

  // ── La Liga 2026/27: use the exact known roster ───────────────────────────
  if (leagueId === League.LaLiga && standings.length === 0) {
    const LALIGA_2026_27 = [
      "Alavés", "Athletic Club", "Atlético Madrid", "Barcelona", "Celta Vigo",
      "Deportivo La Coruña", "Elche", "Espanyol", "Getafe", "Levante",
      "Málaga", "Osasuna", "Racing Santander", "Rayo Vallecano", "Real Betis",
      "Real Madrid", "Real Sociedad", "Sevilla", "Valencia", "Villarreal",
    ];

    const { data: laHist } = await supabase
      .from("standings")
      .select("team_id, team_name, team_logo")
      .eq("league_id", League.LaLiga)
      .order("season", { ascending: false });

    const laMap = new Map<string, { team_id: number; logo: string }>();
    for (const t of (laHist ?? [])) {
      laMap.set(norm(t.team_name), { team_id: t.team_id, logo: t.team_logo ?? "" });
    }
    for (const m of (matchesResult.data ?? [])) {
      const hl = norm(m.home_team);
      const al = norm(m.away_team);
      if (!laMap.has(hl)) laMap.set(hl, { team_id: -(laMap.size + 1), logo: m.home_logo ?? "" });
      if (!laMap.has(al)) laMap.set(al, { team_id: -(laMap.size + 1), logo: m.away_logo ?? "" });
    }

    const findLaTeam = (name: string) => {
      const n = norm(name);
      if (laMap.has(n)) return laMap.get(n)!;
      for (const [key, val] of laMap) {
        if (key.includes(n) || n.includes(key)) return val;
      }
      return null;
    };

    let pseudoId = -2000;
    standings = LALIGA_2026_27.map((name, i) => {
      const found = findLaTeam(name);
      return {
        team_id: found?.team_id ?? pseudoId--,
        team_name: name,
        team_logo: found?.logo ?? "",
        league_id: League.LaLiga,
        season: nowYear,
        rank: i + 1,
        points: 0, played: 0, won: 0, drawn: 0, lost: 0,
        goals_for: 0, goals_against: 0,
        updated_at: now.toISOString(),
        group_name: null,
      };
    });
  }

  // ── LigaMX: supplement from historical data + matches ─────────────────────
  if ([League.LigaMX].includes(leagueId)) {
    const existingIds = new Set(standings.map(s => s.team_id));
    const seenNames = new Set(standings.map(s => s.team_name.toLowerCase()));
    const seenIds = new Set<number>(existingIds);

    const { data: historicalTeams } = await supabase
      .from("standings")
      .select("team_id, team_name, team_logo, league_id")
      .eq("league_id", leagueId)
      .order("season", { ascending: false })
      .order("rank", { ascending: true });

    const fromHistory = (historicalTeams as Pick<DbStanding, "team_id" | "team_name" | "team_logo" | "league_id">[] | null ?? [])
      .filter(t => {
        if (seenIds.has(t.team_id) || seenNames.has(t.team_name.toLowerCase())) return false;
        seenIds.add(t.team_id);
        seenNames.add(t.team_name.toLowerCase());
        return true;
      });

    const matchTeamMap = new Map<string, { name: string; logo: string | null }>();
    for (const m of (matchesResult.data ?? [])) {
      const hl = m.home_team.toLowerCase();
      const al = m.away_team.toLowerCase();
      if (!seenNames.has(hl)) { matchTeamMap.set(hl, { name: m.home_team, logo: m.home_logo }); seenNames.add(hl); }
      if (!seenNames.has(al)) { matchTeamMap.set(al, { name: m.away_team, logo: m.away_logo }); seenNames.add(al); }
    }
    const fromMatches = Array.from(matchTeamMap.values());

    const allMissing: { team_id: number; team_name: string; team_logo: string }[] = [
      ...fromHistory.map(t => ({ team_id: t.team_id, team_name: t.team_name, team_logo: t.team_logo ?? "" })),
      ...fromMatches.map((t, i) => ({ team_id: -(i + 1), team_name: t.name, team_logo: t.logo ?? "" })),
    ].sort((a, b) => a.team_name.localeCompare(b.team_name));

    const supplement: DbStanding[] = allMissing.map((t, i) => ({
      team_id: t.team_id,
      team_name: t.team_name,
      team_logo: t.team_logo,
      league_id: leagueId,
      season: nowYear,
      rank: standings.length + i + 1,
      points: 0, played: 0, won: 0, drawn: 0, lost: 0,
      goals_for: 0, goals_against: 0,
      updated_at: now.toISOString(),
      group_name: null,
    }));

    if (standings.length === 0) {
      standings = supplement.map((t, i) => ({ ...t, rank: i + 1 }));
    } else if (supplement.length > 0) {
      standings = [...standings, ...supplement];
    }
  }

  // Season passed to the client so TopScorers doesn't re-hydrate with stale DB data.
  // During European off-season, point at the upcoming season (no data → empty state).
  const displaySeason = isEuropeanOffSeason ? nowYear : syncSeason;

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
        season={displaySeason}
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
