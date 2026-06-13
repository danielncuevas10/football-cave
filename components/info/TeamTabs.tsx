"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
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
}

function formatMatchDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export default function TeamTabs({
  teamName,
  teamLogoUrl,
  matches,
  standings,
  leagueId,
}: TeamTabsProps) {
  const t = useTranslations("teamPage");
  const [activeTab, setActiveTab] = useState<TabType>("matches");

  const isWorldCup = leagueId === League.WorldCup;
  const hasStandings = standings.length > 0;

  const tabs: { id: TabType; label: string }[] = [
    { id: "matches", label: "Matches" },
    ...(hasStandings
      ? [
          {
            id: "standings" as TabType,
            label: isWorldCup ? "Group Stage" : "Standings",
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
          className="object-contain w-14 h-14 shrink-0"
        />
        <h1 className="text-xl font-extrabold tracking-tight">{teamName}</h1>
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
                      : "border-transparent text-gray-400 hover:text-white hover:bg-gray-900/30"
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
                  <div className="p-8 text-center text-gray-500 text-sm border border-custom-gray rounded-xl">
                    No matches found.
                  </div>
                );
              }

              return (
                <div className="space-y-6">
                  {groups.map((group) => {
                    const upcoming = group.matches
                      .filter((m) => !FINISHED_STATUSES.includes(m.status))
                      .sort((a, b) => new Date(a.fixture_date).getTime() - new Date(b.fixture_date).getTime());
                    const finished = group.matches
                      .filter((m) => FINISHED_STATUSES.includes(m.status))
                      .sort((a, b) => new Date(a.fixture_date).getTime() - new Date(b.fixture_date).getTime());

                    const isFriendly = group.leagueId === League.Friendly;
                    if (isFriendly) {
                      const lastThreeFinished = finished.slice(-3);
                      const friendlyMatches = [...lastThreeFinished, ...upcoming];
                      return (
                        <div key={group.leagueId} className="bg-custom-gray rounded-xl overflow-hidden">
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
                            <div key={m.id} className="border-t border-custom-gray/40 first:border-0">
                              <div className="px-4 py-1 bg-custom-gray">
                                <span className="text-[10px] text-gray-500 tracking-widest">
                                  {formatMatchDate(m.fixture_date)}
                                </span>
                              </div>
                              <MatchCard match={m} />
                            </div>
                          ))}
                        </div>
                      );
                    }

                    return (
                      <div key={group.leagueId} className="space-y-4">
                        {/* Upcoming matches container */}
                        {(upcoming.length > 0 || finished.length === 0) && (
                          <div className="bg-custom-gray rounded-xl overflow-hidden">
                            {group.leagueId === League.WorldCup ? (
                              <img
                                src="/images/WC262nd.svg"
                                alt="FIFA World Cup 2026"
                                className="w-full h-auto object-cover"
                              />
                            ) : (
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
                            )}
                            {upcoming.map((m) => (
                              <div key={m.id} className="border-t border-custom-gray/40 first:border-0">
                                <div className="px-4 py-1 bg-custom-gray">
                                  <span className="text-[10px] text-gray-500 tracking-widest">
                                    {formatMatchDate(m.fixture_date)}
                                  </span>
                                </div>
                                <MatchCard match={m} />
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Past matches — separate container below */}
                        {finished.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-[11px] font-light tracking-widest text-gray-500 uppercase px-1">
                              {t("pastMatches")}
                            </p>
                            <div className="bg-custom-gray rounded-xl overflow-hidden">
                              {group.leagueId === League.WorldCup ? (
                                <img
                                  src="/images/WC262nd.svg"
                                  alt="FIFA World Cup 2026"
                                  className="w-full h-auto object-cover"
                                />
                              ) : (
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
                              )}
                              {finished.map((m) => (
                                <div key={m.id} className="border-t border-custom-gray/40 first:border-0">
                                  <div className="px-4 py-1 bg-custom-gray">
                                    <span className="text-[10px] text-gray-500 tracking-widest">
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
                <WorldCupGroups standings={standings} />
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
