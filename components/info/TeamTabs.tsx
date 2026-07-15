"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import Image from "next/image";
import { getWcRoundKey } from "@/lib/wcRoundLabel";
import { getLocalizedTeamName, cleanLeagueName } from "@/lib/teamName";
import Link from "next/link";
import MatchCard from "@/components/MatchCard";
import StandingsTable from "@/components/info/standings/page";
import WorldCupGroups from "@/components/WorldCupGroups";
import { League, LIVE_STATUSES } from "@/types/sports";
import type { DbMatch, DbStanding, FixtureStatus } from "@/types/sports";
import { supabase } from "@/lib/supabase";
import { useLiveMinute, formatMinute } from "@/hooks/useLiveMinute";
import { resolveFlag } from "@/lib/flagUrl";

const FINISHED_STATUSES: FixtureStatus[] = ["FT", "AET", "PEN", "AWD", "WO"];
const NATIONAL_TEAM_LEAGUES = [1, 4, 5, 6, 9, 10, 17, 25, 29, 30, 32, 34];

type TabType = "overview" | "fixtures" | "standings";

type LeagueGroup = {
  leagueId: number;
  leagueName: string | null;
  leagueLogo: string | null;
  matches: DbMatch[];
};

interface TeamTabsProps {
  teamId: number;
  teamName: string;
  teamLogoUrl: string;
  matches: DbMatch[];
  standings: DbStanding[];
  leagueId: number | null;
  managerName?: string | null;
}

function formatMatchDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function getLeagueIcon(
  leagueId: number | undefined
): { src: string; isWc: boolean } | null {
  switch (leagueId) {
    case 1:
      return { src: "/images/WC26Badge.svg", isWc: true };
    case 2:
      return { src: "/images/champions.svg", isWc: true };
    case 39:
      return { src: "/images/flags/gb-eng.svg", isWc: false };
    case 140:
      return { src: "/images/flags/es.svg", isWc: false };
    case 78:
      return { src: "/images/flags/de.svg", isWc: false };
    case 61:
      return { src: "/images/flags/fr.svg", isWc: false };
    case 135:
      return { src: "/images/flags/it.svg", isWc: false };
    case 253:
      return { src: "/images/flags/us.svg", isWc: false };
    case 262:
      return { src: "/images/flags/mx.svg", isWc: false };
    default:
      return null;
  }
}

function getMatchdayLabel(round: string | null | undefined): string | null {
  if (!round) return null;
  const numMatch = round.match(/[-–]\s*(\d+)$/);
  if (numMatch) return `Matchday ${numMatch[1]}`;
  const dashIdx = round.indexOf(" - ");
  if (dashIdx !== -1) return round.slice(dashIdx + 3);
  return round;
}

function isFlag(logo: string | null): boolean {
  return !!logo && logo.includes("/flags/");
}

function TeamLogo({
  logo,
  size = "md",
}: {
  logo: string | null;
  size?: "sm" | "md";
}) {
  if (!logo) return null;
  const cls = size === "md" ? "w-12 h-8" : "w-9 h-6";
  const inner = isFlag(logo) ? (
    <div
      className={`${cls} shrink-0 bg-cover bg-center rounded-tr-lg rounded-bl-lg`}
      style={{ backgroundImage: `url(${resolveFlag(logo)})` }}
    />
  ) : (
    <div
      className={`${cls} overflow-hidden shrink-0 rounded-tr-lg rounded-bl-lg`}
    >
      <Image
        src={logo}
        alt=""
        width={64}
        height={40}
        className="w-full h-full object-cover scale-[1.15]"
      />
    </div>
  );
  return inner;
}

function LiveMatchBanner({ match }: { match: DbMatch }) {
  const locale = useLocale();
  const minute = useLiveMinute(match);
  const showMinute =
    match.status === "1H" || match.status === "2H" || match.status === "ET";

  return (
    <Link
      href={`/match/${match.id}`}
      className="block hover:opacity-90 transition-opacity"
    >
      <div className="relative bg-[#1a1a1a] rounded-xl overflow-hidden">
        <div className="grid grid-cols-3 items-center gap-2 px-4 py-4">
          <div className="flex flex-col items-center gap-2">
            <TeamLogo logo={match.home_logo} />
            <span className="text-xs text-center font-medium leading-tight text-gray-200 line-clamp-2">
              {getLocalizedTeamName(match.home_team, locale)}
            </span>
          </div>
          <div className="flex flex-col items-center justify-center gap-1">
            <div className="flex items-center justify-center gap-1.5">
              <span className="text-xl font-bold font-mono py-2">
                {match.home_score ?? 0}
              </span>
              <span className="text-gray-600 font-bold text-sm">–</span>
              <span className="text-xl font-bold font-mono py-2">
                {match.away_score ?? 0}
              </span>
            </div>
            {(showMinute || match.status === "HT") && (
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full font-extrabold font-mono text-[10px] shrink-0 text-white ${
                  match.status === "HT" ? "bg-gray-600" : "bg-accent"
                }`}
              >
                <span className={match.status !== "HT" ? "animate-pulse" : ""}>
                  {match.status === "HT"
                    ? "HT"
                    : formatMinute(minute, match.status)}
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-col items-center gap-2">
            <TeamLogo logo={match.away_logo} />
            <span className="text-xs text-center font-medium leading-tight text-gray-200 line-clamp-2">
              {getLocalizedTeamName(match.away_team, locale)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function TeamTabs({
  teamId,
  teamName,
  teamLogoUrl,
  matches: initialMatches,
  standings,
  leagueId,
  managerName,
}: TeamTabsProps) {
  const t = useTranslations("teamPage");
  const tTabs = useTranslations("matchTabs");
  const tBadge = useTranslations("liveBadge");
  const locale = useLocale();
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [matches, setMatches] = useState<DbMatch[]>(initialMatches);

  useEffect(() => {
    const matchIds = new Set(initialMatches.map((m) => m.id));
    const channel = supabase
      .channel(`team-matches-${teamId}`)
      .on<DbMatch>(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "matches" },
        (payload) => {
          const updated = payload.new as DbMatch;
          if (!matchIds.has(updated.id)) return;
          setMatches((prev) =>
            prev.map((m) => (m.id === updated.id ? updated : m))
          );
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  const liveMatch =
    matches.find((m) => LIVE_STATUSES.includes(m.status)) ?? null;

  // Form dots — last 5 finished (oldest → newest for left-to-right)
  const last5 = matches
    .filter(
      (m) =>
        FINISHED_STATUSES.includes(m.status) &&
        m.home_score !== null &&
        m.away_score !== null
    )
    .sort(
      (a, b) =>
        new Date(b.fixture_date).getTime() - new Date(a.fixture_date).getTime()
    )
    .slice(0, 5)
    .reverse()
    .map((m) => {
      const isHome = m.home_logo === teamLogoUrl;
      const teamScore = isHome ? m.home_score! : m.away_score!;
      const oppScore = isHome ? m.away_score! : m.home_score!;
      if (teamScore > oppScore) return "W";
      if (teamScore < oppScore) return "L";
      return "D";
    });

  const isWorldCup = leagueId === League.WorldCup;
  const hasStandings = standings.length > 0;

  const teamGroupName = isWorldCup
    ? standings.find((s) => s.team_id === teamId)?.group_name ?? null
    : null;
  const wcGroupStandings = teamGroupName
    ? standings.filter((s) => s.group_name === teamGroupName)
    : standings;

  // ── League groups (shared across Overview + Fixtures panels) ──────────────
  const groupMap = new Map<number, LeagueGroup>();
  for (const m of matches) {
    const existing = groupMap.get(m.league_id);
    if (existing) {
      existing.matches.push(m);
    } else {
      groupMap.set(m.league_id, {
        leagueId: m.league_id,
        leagueName: cleanLeagueName(m.league_name),
        leagueLogo: m.league_logo,
        matches: [m],
      });
    }
  }
  const groups = Array.from(groupMap.values()).sort((a, b) => {
    if (a.leagueId === League.WorldCup) return -1;
    if (b.leagueId === League.WorldCup) return 1;
    if (a.leagueId === League.Friendly) return 1;
    if (b.leagueId === League.Friendly) return -1;
    return 0;
  });

  const wcGroup = groups.find((g) => g.leagueId === League.WorldCup);
  const wcUpcoming = (wcGroup?.matches ?? [])
    .filter(
      (m) =>
        !FINISHED_STATUSES.includes(m.status) &&
        !LIVE_STATUSES.includes(m.status)
    )
    .sort(
      (a, b) =>
        new Date(a.fixture_date).getTime() - new Date(b.fixture_date).getTime()
    );
  const nextWcMatch = wcUpcoming[0] ?? null;

  const nextClubMatch =
    groups
      .filter(
        (g) => g.leagueId !== League.WorldCup && g.leagueId !== League.Friendly
      )
      .flatMap((g) => g.matches)
      .filter(
        (m) =>
          !FINISHED_STATUSES.includes(m.status) &&
          !LIVE_STATUSES.includes(m.status)
      )
      .sort(
        (a, b) =>
          new Date(a.fixture_date).getTime() -
          new Date(b.fixture_date).getTime()
      )[0] ?? null;

  // ── Overview: last ≤5 finished matches grouped by league ─────────────────
  const last5Finished = matches
    .filter((m) => FINISHED_STATUSES.includes(m.status))
    .sort(
      (a, b) =>
        new Date(b.fixture_date).getTime() - new Date(a.fixture_date).getTime()
    )
    .slice(0, 5);
  const overviewGroupMap = new Map<number, LeagueGroup>();
  for (const m of last5Finished) {
    const existing = overviewGroupMap.get(m.league_id);
    if (existing) {
      existing.matches.push(m);
    } else {
      overviewGroupMap.set(m.league_id, {
        leagueId: m.league_id,
        leagueName: cleanLeagueName(m.league_name),
        leagueLogo: m.league_logo,
        matches: [m],
      });
    }
  }
  const overviewGroups = Array.from(overviewGroupMap.values());

  const allUpcoming = groups
    .flatMap((g) => g.matches)
    .filter(
      (m) =>
        !FINISHED_STATUSES.includes(m.status) &&
        !LIVE_STATUSES.includes(m.status)
    )
    .sort(
      (a, b) =>
        new Date(a.fixture_date).getTime() - new Date(b.fixture_date).getTime()
    );

  const tabs: { id: TabType; label: string }[] = [
    { id: "overview", label: tTabs("overview") },
    { id: "fixtures", label: tTabs("fixtures") },
    ...(hasStandings
      ? [
          {
            id: "standings" as TabType,
            label: isWorldCup ? tTabs("groupStage") : tTabs("standings"),
          },
        ]
      : []),
  ];

  const nextMatchCards = (
    <>
      {liveMatch && <LiveMatchBanner match={liveMatch} />}

      {/* WC next match card */}
      {nextWcMatch && !liveMatch && (
        <Link
          href={`/match/${nextWcMatch.id}`}
          className="block hover:opacity-90 transition-opacity"
        >
          <div className="bg-custom-gray rounded-xl overflow-hidden border border-white/8 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <div className="flex items-center px-4 gap-3 py-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <img
                  src="/images/WC26Badge.svg"
                  alt=""
                  className="w-5 h-5 object-contain shrink-0"
                />
                <span className="text-[11px] font-medium text-white tracking-wider truncate">
                  {tBadge("worldCup")}
                </span>
              </div>
              <div className="flex flex-col items-end gap-0.5 shrink-0">
                {(() => {
                  const key = getWcRoundKey(nextWcMatch.round);
                  return key ? (
                    <span className="text-[11px] text-gray-200 font-bold tracking-wide">
                      {tTabs(key)}
                    </span>
                  ) : null;
                })()}
                <span className="text-[10px] text-gray-400 tracking-wide">
                  {formatMatchDate(nextWcMatch.fixture_date)}
                </span>
              </div>
            </div>
            <div className="px-4 py-2">
              <p className="text-[10px] text-gray-200 tracking-widest">
                {t("nextMatch")}
              </p>
            </div>
            <div className="grid grid-cols-3 items-center gap-2 px-4 py-4">
              <div className="flex flex-col items-center gap-2">
                {nextWcMatch.home_logo && (
                  <div className="w-12 h-8 overflow-hidden shrink-0 block relative border border-gray-300 rounded-tr-lg rounded-bl-lg">
                    <Image
                      src={nextWcMatch.home_logo}
                      alt=""
                      width={64}
                      height={40}
                      className="w-full h-full object-cover will-change-transform scale-[1.15]"
                    />
                  </div>
                )}
                <span className="text-xs text-center font-medium leading-tight text-gray-200 line-clamp-2">
                  {getLocalizedTeamName(nextWcMatch.home_team, locale)}
                </span>
              </div>
              <div className="flex flex-col items-center gap-1 text-center">
                <span className="text-white text-base font-bold font-mono">
                  {new Date(nextWcMatch.fixture_date).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="flex flex-col items-center gap-2">
                {nextWcMatch.away_logo && (
                  <div className="w-12 h-8 overflow-hidden shrink-0 block relative border border-gray-300 rounded-tr-lg rounded-bl-lg">
                    <Image
                      src={nextWcMatch.away_logo}
                      alt=""
                      width={64}
                      height={40}
                      className="w-full h-full object-cover will-change-transform scale-[1.15]"
                    />
                  </div>
                )}
                <span className="text-xs text-center font-medium leading-tight text-gray-200 line-clamp-2">
                  {getLocalizedTeamName(nextWcMatch.away_team, locale)}
                </span>
              </div>
            </div>
          </div>
        </Link>
      )}

      {/* Club next match card */}
      {nextClubMatch && !liveMatch && !nextWcMatch && (
        <Link
          href={`/match/${nextClubMatch.id}`}
          className="block hover:opacity-90 transition-opacity"
        >
          <div className="bg-custom-gray rounded-xl overflow-hidden border border-white/8 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <div className="flex items-center px-4 gap-3 py-2 border-b border-[#38383A]">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {(() => {
                  const icon = getLeagueIcon(nextClubMatch.league_id);
                  if (!icon) return null;
                  return icon.isWc ? (
                    <img
                      src={icon.src}
                      alt=""
                      className="w-5 h-5 object-contain shrink-0"
                    />
                  ) : (
                    <img
                      src={icon.src}
                      alt=""
                      className="w-5 h-3.5 rounded-sm object-cover shrink-0"
                    />
                  );
                })()}
                <span className="text-[11px] font-medium text-white tracking-wider truncate">
                  {cleanLeagueName(nextClubMatch.league_name)}
                </span>
              </div>
              <div className="flex flex-col items-end gap-0.5 shrink-0">
                {getMatchdayLabel(nextClubMatch.round) && (
                  <span className="text-[11px] text-gray-200 font-medium tracking-wide">
                    {getMatchdayLabel(nextClubMatch.round)}
                  </span>
                )}
                <span className="text-[10px] text-gray-400 tracking-wide">
                  {formatMatchDate(nextClubMatch.fixture_date)}
                </span>
              </div>
            </div>
            <div className="px-4 py-2">
              <p className="text-[10px] text-gray-200 tracking-widest">
                {t("nextMatch")}
              </p>
            </div>
            <div className="grid grid-cols-3 items-center gap-2 px-4 py-4">
              <div className="flex flex-col items-center gap-2">
                {nextClubMatch.home_logo && (
                  <Image
                    src={nextClubMatch.home_logo}
                    alt=""
                    width={48}
                    height={48}
                    className="w-10 h-10 object-contain"
                  />
                )}
                <span className="text-xs text-center font-medium leading-tight text-gray-200 line-clamp-2">
                  {getLocalizedTeamName(nextClubMatch.home_team, locale)}
                </span>
              </div>
              <div className="flex flex-col items-center gap-1 text-center">
                <span className="text-white text-base font-medium text-[14px]">
                  {new Date(nextClubMatch.fixture_date).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="flex flex-col items-center gap-2">
                {nextClubMatch.away_logo && (
                  <Image
                    src={nextClubMatch.away_logo}
                    alt=""
                    width={48}
                    height={48}
                    className="w-10 h-10 object-contain"
                  />
                )}
                <span className="text-xs text-center font-medium leading-tight text-gray-200 line-clamp-2">
                  {getLocalizedTeamName(nextClubMatch.away_team, locale)}
                </span>
              </div>
            </div>
          </div>
        </Link>
      )}
    </>
  );

  return (
    <div className="w-full text-white">
      {/* Banner */}
      <div className="flex items-center gap-4 px-5 py-5 bg-custom-gray rounded-xl mx-4 lg:mx-6 lg:mt-6">
        {(() => {
          const isNational =
            leagueId !== null && NATIONAL_TEAM_LEAGUES.includes(leagueId);
          return (
            <div
              className={`w-20 h-12 overflow-hidden shrink-0 block relative${
                isNational
                  ? " border border-gray-300 rounded-tr-lg rounded-bl-lg"
                  : ""
              }`}
            >
              <Image
                src={teamLogoUrl}
                alt=""
                width={96}
                height={48}
                className={`w-full h-full ${
                  isNational
                    ? "object-cover will-change-transform scale-[1.15]"
                    : "object-contain"
                }`}
              />
            </div>
          );
        })()}
        <div className="flex flex-col gap-1.5 min-w-0">
          <h1 className="text-xl font-extrabold tracking-tight truncate">
            {getLocalizedTeamName(teamName, locale)}
          </h1>
          {last5.length > 0 && (
            <p className="text-[10px] text-gray-200 font-light tracking-widest">
              {t("lastMatches")}:
            </p>
          )}
          {last5.length > 0 && (
            <div className="flex gap-2">
              {last5.map((result, i) => (
                <div
                  key={i}
                  className={`w-5 h-5 rounded-full flex items-center justify-center ${
                    result === "W"
                      ? "bg-accent"
                      : result === "L"
                      ? "bg-[#ef4444]"
                      : "bg-[#6b7280]"
                  }`}
                >
                  <img
                    src={
                      result === "W"
                        ? "/images/specs/yes.svg"
                        : result === "L"
                        ? "/images/specs/x.svg"
                        : "/images/specs/draw.svg"
                    }
                    alt={result}
                    className="w-3 h-3 object-contain"
                  />
                </div>
              ))}
            </div>
          )}
          {managerName && (
            <p className="text-[12px] text-gray-200 font-light tracking-wide truncate">
              <span className="text-gray-200">{t("manager")}: </span>
              {managerName}
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 lg:grid lg:grid-cols-[7fr_3fr] lg:gap-6 lg:px-6 lg:items-start">
        <div className="min-w-0 space-y-6 px-4 lg:px-0">
          {/* Tab navigation */}
          {tabs.length > 1 && (
            <div className="flex overflow-hidden">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 text-center py-4 text-xs font-light tracking-wider border-b transition-all duration-200 ${
                      isActive
                        ? "text-white"
                        : "border-transparent text-gray-200 hover:text-white hover:bg-custom-gray/50"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Panels */}
          <div className="grid w-full">
            {/* ── OVERVIEW: last ≤5 finished matches ── */}
            <div
              className={`col-start-1 row-start-1 w-full ${
                activeTab === "overview" ? "" : "h-0 overflow-hidden"
              }`}
            >
              <div className="space-y-6">
                <div className="lg:hidden space-y-6">
                  {liveMatch && <LiveMatchBanner match={liveMatch} />}

                  {/* WC next match card */}
                  {nextWcMatch && !liveMatch && (
                    <Link
                      href={`/match/${nextWcMatch.id}`}
                      className="block hover:opacity-90 transition-opacity"
                    >
                      <div className="bg-custom-gray rounded-xl overflow-hidden border border-white/8 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                        <div className="flex items-center px-4 gap-3 py-4">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <img
                              src="/images/WC26Badge.svg"
                              alt=""
                              className="w-5 h-5 object-contain shrink-0"
                            />
                            <span className="text-[11px] font-medium text-white tracking-wider truncate">
                              {tBadge("worldCup")}
                            </span>
                          </div>
                          <div className="flex flex-col items-end gap-0.5 shrink-0">
                            {(() => {
                              const key = getWcRoundKey(nextWcMatch.round);
                              return key ? (
                                <span className="text-[11px] text-gray-200 font-bold tracking-wide">
                                  {tTabs(key)}
                                </span>
                              ) : null;
                            })()}
                            <span className="text-[10px] text-gray-400 tracking-wide">
                              {formatMatchDate(nextWcMatch.fixture_date)}
                            </span>
                          </div>
                        </div>
                        <div className="px-4 py-2">
                          <p className="text-[10px] text-gray-200 tracking-widest">
                            {t("nextMatch")}
                          </p>
                        </div>
                        <div className="grid grid-cols-3 items-center gap-2 px-4 py-4">
                          <div className="flex flex-col items-center gap-2">
                            {nextWcMatch.home_logo && (
                              <div className="w-12 h-8 overflow-hidden shrink-0 block relative border border-gray-300 rounded-tr-lg rounded-bl-lg">
                                <Image
                                  src={nextWcMatch.home_logo}
                                  alt=""
                                  width={64}
                                  height={40}
                                  className="w-full h-full object-cover will-change-transform scale-[1.15]"
                                />
                              </div>
                            )}
                            <span className="text-xs text-center font-medium leading-tight text-gray-200 line-clamp-2">
                              {getLocalizedTeamName(
                                nextWcMatch.home_team,
                                locale
                              )}
                            </span>
                          </div>
                          <div className="flex flex-col items-center gap-1 text-center">
                            <span className="text-white text-base font-bold font-mono">
                              {new Date(
                                nextWcMatch.fixture_date
                              ).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <div className="flex flex-col items-center gap-2">
                            {nextWcMatch.away_logo && (
                              <div className="w-12 h-8 overflow-hidden shrink-0 block relative border border-gray-300 rounded-tr-lg rounded-bl-lg">
                                <Image
                                  src={nextWcMatch.away_logo}
                                  alt=""
                                  width={64}
                                  height={40}
                                  className="w-full h-full object-cover will-change-transform scale-[1.15]"
                                />
                              </div>
                            )}
                            <span className="text-xs text-center font-medium leading-tight text-gray-200 line-clamp-2">
                              {getLocalizedTeamName(
                                nextWcMatch.away_team,
                                locale
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  )}

                  {/* Club next match card */}
                  {nextClubMatch && !liveMatch && !nextWcMatch && (
                    <Link
                      href={`/match/${nextClubMatch.id}`}
                      className="block hover:opacity-90 transition-opacity"
                    >
                      <div className="bg-custom-gray rounded-xl overflow-hidden border border-white/8 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                        <div className="flex items-center px-4 gap-3 py-2 border-b border-[#38383A]">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            {(() => {
                              const icon = getLeagueIcon(
                                nextClubMatch.league_id
                              );
                              if (!icon) return null;
                              return icon.isWc ? (
                                <img
                                  src={icon.src}
                                  alt=""
                                  className="w-5 h-5 object-contain shrink-0"
                                />
                              ) : (
                                <img
                                  src={icon.src}
                                  alt=""
                                  className="w-5 h-3.5 rounded-sm object-cover shrink-0"
                                />
                              );
                            })()}
                            <span className="text-[11px] font-medium text-white tracking-wider truncate">
                              {cleanLeagueName(nextClubMatch.league_name)}
                            </span>
                          </div>
                          <div className="flex flex-col items-end gap-0.5 shrink-0">
                            {getMatchdayLabel(nextClubMatch.round) && (
                              <span className="text-[11px] text-gray-200 font-medium tracking-wide">
                                {getMatchdayLabel(nextClubMatch.round)}
                              </span>
                            )}
                            <span className="text-[10px] text-gray-400 tracking-wide">
                              {formatMatchDate(nextClubMatch.fixture_date)}
                            </span>
                          </div>
                        </div>
                        <div className="px-4 py-2">
                          <p className="text-[10px] text-gray-200 tracking-widest">
                            {t("nextMatch")}
                          </p>
                        </div>
                        <div className="grid grid-cols-3 items-center gap-2 px-4 py-4">
                          <div className="flex flex-col items-center gap-2">
                            {nextClubMatch.home_logo && (
                              <Image
                                src={nextClubMatch.home_logo}
                                alt=""
                                width={48}
                                height={48}
                                className="w-10 h-10 object-contain"
                              />
                            )}
                            <span className="text-xs text-center font-medium leading-tight text-gray-200 line-clamp-2">
                              {getLocalizedTeamName(
                                nextClubMatch.home_team,
                                locale
                              )}
                            </span>
                          </div>
                          <div className="flex flex-col items-center gap-1 text-center">
                            <span className="text-white text-base font-medium text-[14px]">
                              {new Date(
                                nextClubMatch.fixture_date
                              ).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <div className="flex flex-col items-center gap-2">
                            {nextClubMatch.away_logo && (
                              <Image
                                src={nextClubMatch.away_logo}
                                alt=""
                                width={48}
                                height={48}
                                className="w-10 h-10 object-contain"
                              />
                            )}
                            <span className="text-xs text-center font-medium leading-tight text-gray-200 line-clamp-2">
                              {getLocalizedTeamName(
                                nextClubMatch.away_team,
                                locale
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  )}
                </div>

                {overviewGroups.length === 0 &&
                !nextWcMatch &&
                !nextClubMatch ? (
                  <div className="p-8 text-center text-gray-300 text-sm border border-custom-gray rounded-xl">
                    {tTabs("noMatches")}
                  </div>
                ) : (
                  overviewGroups.map((group) => (
                    <div
                      key={group.leagueId}
                      className="bg-custom-gray rounded-xl overflow-hidden"
                    >
                      <div className="flex items-center gap-3 px-4 py-3 border-b border-custom-gray-2/40">
                        {(() => {
                          const icon = getLeagueIcon(group.leagueId);
                          if (!icon) return null;
                          return icon.isWc ? (
                            <img
                              src={icon.src}
                              alt=""
                              className="w-5 h-5 object-contain shrink-0"
                            />
                          ) : (
                            <img
                              src={icon.src}
                              alt=""
                              className="w-5 h-3.5 rounded-sm object-cover shrink-0"
                            />
                          );
                        })()}
                        <span className="text-xs font-medium text-gray-300 tracking-wide">
                          {group.leagueName ?? "Competition"}
                        </span>
                      </div>
                      {group.matches.map((m) => (
                        <div
                          key={m.id}
                          className="border-t border-custom-gray/40 first:border-0"
                        >
                          <div className="px-4 py-1 bg-custom-gray">
                            <span className="text-[10px] text-gray-300 tracking-widest">
                              {formatMatchDate(m.fixture_date)}
                            </span>
                          </div>
                          <MatchCard match={m} viewingTeamLogo={teamLogoUrl} />
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* ── FIXTURES: next match card + all upcoming ── */}
            <div
              className={`col-start-1 row-start-1 w-full ${
                activeTab === "fixtures" ? "" : "h-0 overflow-hidden"
              }`}
            >
              <div className="space-y-6">
                <div className="lg:hidden">
                  {liveMatch && <LiveMatchBanner match={liveMatch} />}
                </div>

                {allUpcoming.length === 0 && !liveMatch ? (
                  <div className="p-8 text-center text-gray-300 text-sm border border-custom-gray rounded-xl">
                    {tTabs("noMatches")}
                  </div>
                ) : (
                  <div className="bg-custom-gray-2 rounded-xl overflow-hidden">
                    {allUpcoming.map((m, i) => (
                      <div
                        key={m.id}
                        className={i > 0 ? "border-t border-[#38383A]" : ""}
                      >
                        <div className="px-3 pt-1">
                          <span className="text-[10px] text-gray-400 tracking-widest">
                            {formatMatchDate(m.fixture_date)}
                          </span>
                        </div>
                        <MatchCard match={m} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── STANDINGS ── */}
            {hasStandings && (
              <div
                className={`col-start-1 row-start-1 w-full ${
                  activeTab === "standings" ? "" : "h-0 overflow-hidden"
                }`}
              >
                {isWorldCup ? (
                  <WorldCupGroups standings={wcGroupStandings} />
                ) : (
                  <StandingsTable standings={standings} />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Next match – desktop sidebar */}
        <div className="hidden lg:flex lg:flex-col lg:gap-6">
          {nextMatchCards}
        </div>
      </div>
    </div>
  );
}
