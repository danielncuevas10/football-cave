"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { getWcRoundKey } from "@/lib/wcRoundLabel";
import { getLocalizedTeamName } from "@/lib/teamName";
import Link from "next/link";
import MatchCard from "@/components/MatchCard";
import StandingsTable from "@/components/info/standings/page";
import WorldCupGroups from "@/components/WorldCupGroups";
import { League, LIVE_STATUSES } from "@/types/sports";
import type { DbMatch, DbStanding, FixtureStatus } from "@/types/sports";
import { supabase } from "@/lib/supabase";
import { useLiveMinute } from "@/hooks/useLiveMinute";
import { resolveFlag } from "@/lib/flagUrl";

const FINISHED_STATUSES: FixtureStatus[] = ["FT", "AET", "PEN", "AWD", "WO"];

type TabType = "matches" | "standings";

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
      className={`${cls} shrink-0 bg-cover bg-center border border-gray-300 rounded-tr-md rounded-bl-md`}
      style={{ backgroundImage: `url(${resolveFlag(logo)})` }}
    />
  ) : (
    <div
      className={`${cls} overflow-hidden shrink-0 border border-gray-300 rounded-tr-md rounded-bl-md`}
    >
      <img
        src={logo}
        alt=""
        className="w-full h-full object-cover scale-[1.15]"
      />
    </div>
  );
  return inner;
}

function LiveMatchBanner({ match }: { match: DbMatch }) {
  const locale = useLocale();
  const minute = useLiveMinute(match.status, match.elapsed, match.fixture_date);
  const showMinute =
    match.status === "1H" || match.status === "2H" || match.status === "ET";

  return (
    <Link
      href={`/match/${match.id}`}
      className="block hover:opacity-90 transition-opacity"
    >
      <div className="relative bg-[#1a1a1a] border rounded-xl overflow-hidden">
        {/* Teams + score */}
        <div className="grid grid-cols-3 items-center gap-2 px-4 pb-4">
          <div className="flex flex-col items-center gap-2">
            <TeamLogo logo={match.home_logo} />
            <span className="text-xs text-center font-medium leading-tight text-gray-200 line-clamp-2">
              {getLocalizedTeamName(match.home_team, locale)}
            </span>
          </div>
          <div className="flex flex-col items-center justify-center gap-1">
            <div className="flex items-center justify-center gap-1.5">
              <span className="text-2xl font-extrabold tabular-nums">
                {match.home_score ?? 0}
              </span>
              <span className="text-gray-600 font-bold text-sm">–</span>
              <span className="text-2xl font-extrabold tabular-nums">
                {match.away_score ?? 0}
              </span>
            </div>
            {showMinute && (
              <span className="text-[#00A800] text-xs font-mono tabular-nums">
                {minute}′
              </span>
            )}
            {match.status === "HT" && (
              <span className="text-gray-400 text-xs font-mono">HT</span>
            )}
          </div>
          <div className="flex flex-col items-center gap-2">
            <TeamLogo logo={match.away_logo} />
            <span className="text-xs text-center font-medium leading-tight text-gray-200 line-clamp-2">
              {getLocalizedTeamName(match.away_team, locale)}
            </span>
          </div>
        </div>

        {/* Sweeping green live line */}
        <div className="h-0.5 w-full bg-gray-800 relative overflow-hidden">
          <div
            className="h-full w-1/2 bg-[#00A800] absolute"
            style={{ animation: "live-scan 6s ease-in-out infinite" }}
          />
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
  const [activeTab, setActiveTab] = useState<TabType>("matches");
  const [matches, setMatches] = useState<DbMatch[]>(initialMatches);

  // Subscribe to live updates for this team's matches from Supabase
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

  // Last 5 finished matches, oldest → newest for left-to-right display
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

  // For World Cup: only show the team's own group in the standings tab
  const teamGroupName = isWorldCup
    ? standings.find((s) => s.team_id === teamId)?.group_name ?? null
    : null;
  const wcGroupStandings = teamGroupName
    ? standings.filter((s) => s.group_name === teamGroupName)
    : standings;

  const tabs: { id: TabType; label: string }[] = [
    { id: "matches", label: tTabs("matches") },
    ...(hasStandings
      ? [
          {
            id: "standings" as TabType,
            label: isWorldCup ? tTabs("groupStage") : tTabs("standings"),
          },
        ]
      : []),
  ];

  return (
    <div className="w-full text-white">
      {/* Banner — full width, no rounding, no side margins */}
      <div className="flex items-center gap-4 px-6 py-15 bg-custom-gray-2 w-full">
        <div className="w-20 h-12 overflow-hidden shrink-0 block relative border border-gray-300 rounded-tr-md rounded-bl-md">
          <img
            src={teamLogoUrl}
            alt=""
            className="w-full h-full object-cover  will-change-transform scale-[1.15]"
          />
        </div>
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
                      ? "bg-[#00A800]"
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

      <div className="space-y-6 px-4 mt-6">
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

        {/* Panels — same grid-overlap trick to avoid layout shift */}
        <div className="grid w-full">
          <div
            className={`col-start-1 row-start-1 w-full ${
              activeTab === "matches" ? "" : "h-0 overflow-hidden"
            }`}
          >
            {(() => {
              // Group by league_id
              type LeagueGroup = {
                leagueId: number;
                leagueName: string | null;
                leagueLogo: string | null;
                matches: DbMatch[];
              };
              const groupMap = new Map<number, LeagueGroup>();
              for (const m of matches) {
                const existing = groupMap.get(m.league_id);
                if (existing) {
                  existing.matches.push(m);
                } else {
                  groupMap.set(m.league_id, {
                    leagueId: m.league_id,
                    leagueName: m.league_name,
                    leagueLogo: m.league_logo,
                    matches: [m],
                  });
                }
              }

              // World Cup first, Friendlies last, others in between
              const groups = Array.from(groupMap.values()).sort((a, b) => {
                if (a.leagueId === League.WorldCup) return -1;
                if (b.leagueId === League.WorldCup) return 1;
                if (a.leagueId === League.Friendly) return 1;
                if (b.leagueId === League.Friendly) return -1;
                return 0;
              });

              if (groups.length === 0) {
                return (
                  <div className="p-8 text-center text-gray-300 text-sm border border-custom-gray rounded-xl">
                    {tTabs("noMatches")}
                  </div>
                );
              }

              // WC-specific data — extracted so we can render the badge section
              // and the "Next Match" card separately from the rest of the groups.
              const wcGroup = groups.find(
                (g) => g.leagueId === League.WorldCup
              );
              const wcUpcoming = (wcGroup?.matches ?? [])
                .filter(
                  (m) =>
                    !FINISHED_STATUSES.includes(m.status) &&
                    !LIVE_STATUSES.includes(m.status)
                )
                .sort(
                  (a, b) =>
                    new Date(a.fixture_date).getTime() -
                    new Date(b.fixture_date).getTime()
                );
              const wcFinished = (wcGroup?.matches ?? [])
                .filter((m) => FINISHED_STATUSES.includes(m.status))
                .sort(
                  (a, b) =>
                    new Date(a.fixture_date).getTime() -
                    new Date(b.fixture_date).getTime()
                );
              const nextWcMatch = wcUpcoming[0] ?? null;

              return (
                <div className="space-y-6">
                  {/* ── Live match banner — shown when team is currently playing ── */}
                  {liveMatch && <LiveMatchBanner match={liveMatch} />}

                  {/* ── Prominent Next Match card (WC teams only, not shown when live) ── */}
                  {nextWcMatch && !liveMatch && (
                    <Link
                      href={`/match/${nextWcMatch.id}`}
                      className="block hover:opacity-90 transition-opacity"
                    >
                      <div className="bg-[#303030] rounded-xl overflow-hidden px-6 py-6">
                        <div className="flex flex-col items-center gap-1 mb-4">
                          <p className="text-[10px] text-gray-200 tracking-widest text-center">
                            {t("nextMatch")}
                          </p>
                          {(() => {
                            const key = getWcRoundKey(nextWcMatch.round);
                            return key ? (
                              <span className="text-[10px] text-gray-400 font-light tracking-wide">
                                {tTabs(key)}
                              </span>
                            ) : null;
                          })()}
                        </div>
                        <div className="grid grid-cols-3 items-center gap-2">
                          <div className="flex flex-col items-center gap-2">
                            {nextWcMatch.home_logo && (
                              <div className="w-12 h-8 overflow-hidden shrink-0 block relative border border-gray-300 rounded-tr-md rounded-bl-md">
                                <img
                                  src={nextWcMatch.home_logo}
                                  alt=""
                                  className="w-full h-full object-cover  will-change-transform scale-[1.15]"
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
                            <span className="text-gray-200 text-[10px] tracking-wide">
                              {formatMatchDate(nextWcMatch.fixture_date)}
                            </span>
                            <span className="text-white text-base font-bold">
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
                              <div className="w-12 h-8 overflow-hidden shrink-0 block relative border border-gray-300 rounded-tr-md rounded-bl-md">
                                <img
                                  src={nextWcMatch.away_logo}
                                  alt=""
                                  className="w-full h-full object-cover  will-change-transform scale-[1.15]"
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

                  {/* ── WC badge + all WC matches (upcoming then played) ── */}
                  {wcGroup && (
                    <div className="bg-custom-gray rounded-xl overflow-hidden">
                      <div className="relative">
                        <img
                          src="/images/WC26200nd.svg"
                          alt="FIFA World Cup 2026"
                          className="w-full h-auto object-cover"
                        />
                        <span className="absolute inset-0 flex items-center justify-center text-black text-[11px] lg:text-[18px] font-sans font-medium tracking-[0.5em] uppercase tracking-wide pointer-events-none">
                          {tBadge("worldCup")}
                        </span>
                      </div>
                      {[...wcUpcoming.slice(1), ...wcFinished].map((m) => (
                        <div
                          key={m.id}
                          className="border-t border-custom-gray/40 first:border-0"
                        >
                          <div className="px-4 py-1 bg-custom-gray">
                            <span className="text-[10px] text-gray-300 tracking-widest">
                              {formatMatchDate(m.fixture_date)}
                            </span>
                          </div>
                          <MatchCard match={m} />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── Other leagues (not WC, not Friendly) — unchanged logic ── */}
                  {groups
                    .filter(
                      (g) =>
                        g.leagueId !== League.WorldCup &&
                        g.leagueId !== League.Friendly
                    )
                    .map((group) => {
                      const upcoming = group.matches
                        .filter((m) => !FINISHED_STATUSES.includes(m.status))
                        .sort(
                          (a, b) =>
                            new Date(a.fixture_date).getTime() -
                            new Date(b.fixture_date).getTime()
                        );
                      const finished = group.matches
                        .filter((m) => FINISHED_STATUSES.includes(m.status))
                        .sort(
                          (a, b) =>
                            new Date(a.fixture_date).getTime() -
                            new Date(b.fixture_date).getTime()
                        );

                      return (
                        <div key={group.leagueId} className="space-y-4">
                          {(upcoming.length > 0 || finished.length === 0) && (
                            <div className="bg-custom-gray rounded-xl overflow-hidden">
                              <div className="flex items-center gap-3 px-4 py-3 border-b border-custom-gray-2/40">
                                {group.leagueLogo && (
                                  <img
                                    src={group.leagueLogo}
                                    alt=""
                                    className="w-5 h-5 object-contain shrink-0"
                                  />
                                )}
                                <span className="text-xs font-medium text-gray-300 tracking-wide">
                                  {group.leagueName ?? "Competition"}
                                </span>
                              </div>
                              {upcoming.map((m) => (
                                <div
                                  key={m.id}
                                  className="border-t border-custom-gray/40 first:border-0"
                                >
                                  <div className="px-4 py-1 bg-custom-gray">
                                    <span className="text-[10px] text-gray-300 tracking-widest">
                                      {formatMatchDate(m.fixture_date)}
                                    </span>
                                  </div>
                                  <MatchCard match={m} />
                                </div>
                              ))}
                            </div>
                          )}
                          {finished.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-[11px] font-light tracking-widest text-gray-300 uppercase px-1">
                                {t("pastMatches")}
                              </p>
                              <div className="bg-custom-gray rounded-xl overflow-hidden">
                                <div className="flex items-center gap-3 px-4 py-3 border-b border-custom-gray-2/40">
                                  {group.leagueLogo && (
                                    <img
                                      src={group.leagueLogo}
                                      alt=""
                                      className="w-5 h-5 object-contain shrink-0"
                                    />
                                  )}
                                  <span className="text-xs font-medium text-gray-300 tracking-wide">
                                    {group.leagueName ?? "Competition"}
                                  </span>
                                </div>
                                {finished.map((m) => (
                                  <div
                                    key={m.id}
                                    className="border-t border-custom-gray/40 first:border-0"
                                  >
                                    <div className="px-4 py-1 bg-custom-gray">
                                      <span className="text-[10px] text-gray-300 tracking-widest">
                                        {formatMatchDate(m.fixture_date)}
                                      </span>
                                    </div>
                                    <MatchCard match={m} />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                  {/* ── Friendlies — unchanged ── */}
                  {groups
                    .filter((g) => g.leagueId === League.Friendly)
                    .map((group) => {
                      const upcoming = group.matches
                        .filter((m) => !FINISHED_STATUSES.includes(m.status))
                        .sort(
                          (a, b) =>
                            new Date(a.fixture_date).getTime() -
                            new Date(b.fixture_date).getTime()
                        );
                      const finished = group.matches
                        .filter((m) => FINISHED_STATUSES.includes(m.status))
                        .sort(
                          (a, b) =>
                            new Date(a.fixture_date).getTime() -
                            new Date(b.fixture_date).getTime()
                        );
                      const friendlyMatches = [
                        ...finished.slice(-3),
                        ...upcoming,
                      ];
                      return (
                        <div
                          key={group.leagueId}
                          className="bg-custom-gray rounded-xl overflow-hidden"
                        >
                          <div className="flex items-center gap-3 px-4 py-3 border-b border-custom-gray-2/40">
                            {group.leagueLogo && (
                              <img
                                src={group.leagueLogo}
                                alt=""
                                className="w-5 h-5 object-contain shrink-0"
                              />
                            )}
                            <span className="text-xs font-medium text-gray-300 tracking-wide">
                              {group.leagueName ?? "Friendlies"}
                            </span>
                          </div>
                          {friendlyMatches.map((m) => (
                            <div
                              key={m.id}
                              className="border-t border-custom-gray/40 first:border-0"
                            >
                              <div className="px-4 py-1 bg-custom-gray">
                                <span className="text-[10px] text-gray-300 tracking-widest">
                                  {formatMatchDate(m.fixture_date)}
                                </span>
                              </div>
                              <MatchCard match={m} />
                            </div>
                          ))}
                        </div>
                      );
                    })}
                </div>
              );
            })()}
          </div>

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
    </div>
  );
}
