"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { getLocalizedTeamName } from "@/lib/teamName";
import Image from "next/image";
import Link from "next/link";
import MatchCard from "@/components/MatchCard";
import StandingsTable from "@/components/info/standings/page";
import WorldCupGroups from "@/components/WorldCupGroups";
import { League } from "@/types/sports";
import type { DbMatch, DbStanding, FixtureStatus } from "@/types/sports";

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

export default function TeamTabs({
  teamId,
  teamName,
  teamLogoUrl,
  matches,
  standings,
  leagueId,
  managerName,
}: TeamTabsProps) {
  const t = useTranslations("teamPage");
  const tTabs = useTranslations("matchTabs");
  const locale = useLocale();
  const [activeTab, setActiveTab] = useState<TabType>("matches");

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
      <div className="flex items-center gap-4 px-6 py-15 bg-custom-gray w-full">
        <Image
          src={teamLogoUrl}
          alt={teamName}
          width={56}
          height={56}
          className="object-contain w-20 h-20 shrink-0"
        />
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
                  className={`flex-1 text-center py-3 text-xs font-light tracking-wider border-b transition-all duration-200 ${
                    isActive
                      ? "border-white text-white"
                      : "border-transparent text-gray-200 hover:text-white hover:bg-gray-900/30"
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
                  <div className="p-8 text-center text-gray-300 text-sm border border-custom-gray rrounded-md">
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
                .filter((m) => !FINISHED_STATUSES.includes(m.status))
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
                  {/* ── Prominent Next Match card (WC teams only) ── */}
                  {nextWcMatch && (
                    <Link
                      href={`/match/${nextWcMatch.id}`}
                      className="block hover:opacity-90 transition-opacity"
                    >
                      <div className="bg-[#303030] rrounded-md overflow-hidden px-6 py-6">
                        <p className="text-[10px] text-gray-200 tracking-widest text-center mb-4">
                          {t("nextMatch")}
                        </p>
                        <div className="grid grid-cols-3 items-center gap-2">
                          <div className="flex flex-col items-center gap-2">
                            {nextWcMatch.home_logo && (
                              <img
                                src={nextWcMatch.home_logo}
                                alt=""
                                className="w-12 h-12 object-contain"
                              />
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
                              <img
                                src={nextWcMatch.away_logo}
                                alt=""
                                className="w-12 h-12 object-contain"
                              />
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
                    <div className="bg-custom-gray rrounded-md overflow-hidden">
                      <img
                        src="/images/WC262nd.svg"
                        alt="FIFA World Cup 2026"
                        className="w-full h-auto object-cover"
                      />
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
                            <div className="bg-custom-gray rrounded-md overflow-hidden">
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
                              <div className="bg-custom-gray rrounded-md overflow-hidden">
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
                          className="bg-custom-gray rrounded-md overflow-hidden"
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
