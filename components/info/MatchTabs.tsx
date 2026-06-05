"use client";

import { useState, useEffect, Fragment } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import StandingsTable from "@/components/info/standings/page";
import MatchCenterDetails from "@/components/info/matchDetails/page";
import MatchCenterLinenups from "./matchLineups/page";
import type {
  DbMatchDetails,
  DbStanding,
  DbTopScorer,
  MatchEvent,
  FixtureStatus,
} from "@/types/sports";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

const FINISHED_STATUSES: FixtureStatus[] = ["FT", "AET", "PEN", "AWD", "WO"];

type TabType = "events" | "table" | "scorers" | "details" | "lineups";

interface MatchTabsProps {
  details: DbMatchDetails | null;
  standings: DbStanding[];
  scorers: DbTopScorer[];
  leagueName: string | null;
  leagueLogo: string | null;
  leagueId: number;
  matchId: number;
  initialIsLive: boolean;
  initialStatus: FixtureStatus;
}

export default function MatchTabs({
  details,
  standings,
  leagueName,
  leagueLogo,
  leagueId,
  matchId,
  initialIsLive,
  initialStatus,
}: MatchTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>("events");
  const [isLive, setIsLive] = useState(initialIsLive);
  const [status, setStatus] = useState<FixtureStatus>(initialStatus);

  useEffect(() => {
    const channel = supabase
      .channel(`matchtabs-${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "matches",
          filter: `id=eq.${matchId}`,
        },
        (payload) => {
          const updated = payload.new as {
            is_live: boolean;
            status: FixtureStatus;
          };
          setIsLive(updated.is_live);
          setStatus(updated.status);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId]);

  const tTabs = useTranslations("matchTabs");
  const tEv = useTranslations("matchEvents");

  const isConfirmedFinished = !isLive && FINISHED_STATUSES.includes(status);
  const isFriendly = leagueId === 10;

  const homeTeamId =
    details?.lineups?.[0]?.team?.id ?? details?.statistics?.[0]?.team?.id;

  const getScoreAtMinute = (minute: number): string => {
    let home = 0;
    let away = 0;

    details?.events?.forEach((ev: MatchEvent) => {
      if (
        ev.type === "Goal" &&
        ev.detail !== "Missed Penalty" &&
        ev.time.elapsed <= minute
      ) {
        const isOwnGoal = ev.detail === "Own Goal";
        const isHomeTeam = homeTeamId ? ev.team.id === homeTeamId : false;

        if ((isHomeTeam && !isOwnGoal) || (!isHomeTeam && isOwnGoal)) {
          home++;
        } else {
          away++;
        }
      }
    });

    return `${home} – ${away}`;
  };

  const tabs: { id: TabType; label: string }[] = [
    { id: "events", label: tTabs("events") },
    { id: "details", label: tTabs("stats") },
    { id: "lineups", label: tTabs("lineups") },
    ...(!isFriendly ? [{ id: "table" as TabType, label: tTabs("standings") }] : []),
  ];

  const getEventIcon = (type: string, detail: string): string => {
    if (type === "Goal") {
      if (detail === "Penalty") return "/images/specs/ball.svg";
      if (detail === "Missed Penalty")
        return "/images/specs/missed-penalty.svg";
      if (detail === "Own Goal") return "/images/specs/own-goal.svg";
      return "/images/specs/ball.svg";
    }
    if (type === "Var") return "/images/specs/var.svg";
    if (type === "Card") {
      return detail === "Red Card"
        ? "/images/specs/red-card.svg"
        : "/images/specs/yellow-card.svg";
    }
    if (type === "subst") return "/images/specs/substitution.svg";
    return "/icons/default-event.svg";
  };

  const getEventSubtext = (type: string, detail: string): string | null => {
    if (type !== "Goal" && type !== "Var") return null;
    if (detail === "Penalty") return "Penalty";
    if (detail === "Own Goal") return "Own Goal";
    if (detail === "Missed Penalty") return "Miss P";
    if (detail === "Penalty confirmed") return "Penalty";
    if (detail === "Penalty awarded") return "Penalty VAR";
    return null;
  };

  // Chronological event timeline state triggers
  let renderedStartDivider = false;
  let renderedHalfTimeDivider = false;
  let renderedRegularTimeEndDivider = false; // New trigger
  let renderedEtStartDivider = false; // New trigger
  let renderedEtHalfTimeDivider = false;

  return (
    <div className="space-y-6 w-full ">
      {/* Tabs Navigation Links Row */}
      <div className="flex justify-center">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="w-1/4 text-center py-2 text-xs font-light tracking-wider border-b transition-colors whitespace-nowrap border-transparent text-gray-400 hover:text-white hover:bg-gray-900/30"
              style={{
                borderBottomColor: isActive ? "#ffffff" : "transparent",
                color: isActive ? "#ffffff" : "",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="w-full my-10">
        {activeTab === "events" && (
          <div className="w-full space-y-2">
            {details?.events && details.events.length > 0 ? (
              <div className="bg-custom-gray-2 rounded-xl border border-custom-gray overflow-hidden">
                <div className=" divide-y divide-custom-gray/30">
                  {details.events.map((ev: MatchEvent, index: number) => {
                    const isHomeEvent = homeTeamId
                      ? ev.team.id === homeTeamId
                      : false;
                    const isSubstitution = ev.type === "subst";
                    const subtext = getEventSubtext(ev.type, ev.detail);

                    const showStart = !renderedStartDivider;
                    if (showStart) renderedStartDivider = true;

                    const showHalfTimeBreak =
                      !renderedHalfTimeDivider && ev.time.elapsed > 45;
                    if (showHalfTimeBreak) renderedHalfTimeDivider = true;

                    // Extra Time Chronology Triggers
                    const showRegularTimeEnd =
                      !renderedRegularTimeEndDivider && ev.time.elapsed > 90;
                    if (showRegularTimeEnd)
                      renderedRegularTimeEndDivider = true;

                    const showEtStart =
                      !renderedEtStartDivider && ev.time.elapsed > 90;
                    if (showEtStart) renderedEtStartDivider = true;

                    const showEtHalfTime =
                      !renderedEtHalfTimeDivider && ev.time.elapsed > 105;
                    if (showEtHalfTime) renderedEtHalfTimeDivider = true;

                    return (
                      <Fragment key={index}>
                        {/* Start Section Banner */}
                        {showStart && (
                          <div className="bg-custom-gray flex items-center justify-center gap-2 py-4 text-[11px] font-light text-white tracking-widest border-b border-custom-gray">
                            <img
                              src="/images/specs/clock.svg"
                              alt=""
                              className="w-3.5 h-3.5 object-contain"
                            />
                            <span>{tEv("matchStarted")}</span>
                          </div>
                        )}

                        {/* Spacer when no events occurred in the first half */}
                        {showStart && showHalfTimeBreak && (
                          <div className="py-5 text-center text-[11px] text-gray-600 tracking-wider">
                            {tEv("noNotableActions")}
                          </div>
                        )}

                        {/* Half Time Break Banner */}
                        {showHalfTimeBreak && (
                          <div className="bg-custom-gray flex flex-col items-center justify-center gap-1 py-3 text-[11px] font-light text-white tracking-widest border-y border-custom-gray">
                            <div className="flex items-center gap-2">
                              <img
                                src="/images/specs/clock.svg"
                                alt=""
                                className="w-3.5 h-3.5 object-contain"
                              />
                              <span>{tEv("halfTimeBreak")}</span>
                            </div>
                            <span className="font-mono text-sm font-bold text-gray-200 mt-0.5">
                              {getScoreAtMinute(45)}
                            </span>
                          </div>
                        )}

                        {/* Second Half Starts Banner */}
                        {showHalfTimeBreak && (
                          <div className="bg-custom-gray flex items-center justify-center gap-2 py-4 text-[11px] font-light text-white tracking-widest border-b border-custom-gray">
                            <img
                              src="/images/specs/clock.svg"
                              alt=""
                              className="w-3.5 h-3.5 object-contain"
                            />
                            <span>{tEv("secondHalfStarts")}</span>
                          </div>
                        )}

                        {/* 1. Regular Time Concluded Banner */}
                        {showRegularTimeEnd && (
                          <div className="bg-custom-gray flex flex-col items-center justify-center gap-1 py-3 text-[11px] font-light text-white tracking-widest border-y border-custom-gray/60">
                            <span className="font-mono text-xs font-bold text-white mt-0.5">
                              {tEv("ftScore")}: {getScoreAtMinute(90)}
                            </span>
                            <div className="flex items-center gap-2">
                              <img
                                src="/images/specs/final.svg"
                                alt=""
                                className="w-3.5 h-3.5 object-contain"
                              />
                              <div className="flex flex-col items-center">
                                <span className="text-gray-300 py-2">
                                  {tEv("regularTimeFinished")}
                                </span>
                                <span className="text-gray-300">
                                  {tEv("extraTimeStartsSoon")}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* 2. First Half Extra Time Initiated Banner */}
                        {showEtStart && (
                          <div className="bg-custom-gray/80 flex items-center justify-center gap-2 py-3.5 text-[11px] font-medium text-white tracking-widest border-b border-custom-gray">
                            <span>{tEv("firstHalfExtraTimeStarts")}</span>
                          </div>
                        )}

                        {/* Extra Time Intermission Break Banner */}
                        {showEtHalfTime && (
                          <div className="bg-custom-gray flex flex-col items-center justify-center gap-1 py-3 text-[11px] font-light text-white tracking-widest border-y border-custom-gray">
                            <div className="flex items-center gap-2">
                              <img
                                src="/images/specs/clock.svg"
                                alt=""
                                className="w-3.5 h-3.5 object-contain"
                              />
                              <span>{tEv("extraTimeHalfTime")}</span>
                            </div>
                            <span className="font-mono text-sm font-bold text-gray-200 mt-0.5">
                              {getScoreAtMinute(105)}
                            </span>
                          </div>
                        )}

                        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 py-3 px-4 text-sm w-full">
                          {/* Left Side: Home Team Incidents */}
                          <div className="w-full min-w-0">
                            {isHomeEvent && (
                              <div className="flex items-center justify-between w-full gap-2.5">
                                <div className="flex items-center gap-2 min-w-0 text-left">
                                  {isSubstitution ? (
                                    <div className="flex flex-col text-xs">
                                      <span className="text-[#20C547] font-medium truncate">
                                        {ev.assist.name || "In Player"}
                                      </span>
                                      <span className="text-[#C50212] font-medium truncate">
                                        {ev.player.name || "Out Player"}
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <span className="text-gray-200 font-medium truncate">
                                        {ev.player.name || "Unknown Player"}
                                      </span>
                                    </div>
                                  )}
                                </div>

                                <div className="flex flex-col items-center shrink-0 gap-0.5 min-w-7">
                                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-zinc-800/50">
                                    <img
                                      src={getEventIcon(ev.type, ev.detail)}
                                      alt=""
                                      className="w-4 h-4 object-contain"
                                    />
                                  </span>
                                  {subtext && (
                                    <span className="text-[9px] font-extrabold tracking-wider text-gray-400 leading-none">
                                      {subtext}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Center Column: Time Indicator */}
                          <div className="px-2.5 py-1 text-gray-400 font-bold text-xs text-center min-w-10.5">
                            {ev.time.elapsed}′
                          </div>

                          {/* Right Side: Away Team Incidents */}
                          <div className="w-full min-w-0">
                            {!isHomeEvent && (
                              <div className="flex items-center justify-between w-full gap-2.5">
                                <div className="flex flex-col items-center shrink-0 gap-0.5 min-w-7">
                                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-zinc-800/50">
                                    <img
                                      src={getEventIcon(ev.type, ev.detail)}
                                      alt=""
                                      className="w-4 h-4 object-contain"
                                    />
                                  </span>
                                  {subtext && (
                                    <span className="text-[9px] font-extrabold tracking-wider font-mono text-gray-400 leading-none">
                                      {subtext}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 min-w-0 text-right justify-end w-full">
                                  {isSubstitution ? (
                                    <div className="flex flex-col text-xs text-right items-end">
                                      <span className="text-[#20C547] font-medium truncate">
                                        {ev.assist.name || "In Player"}
                                      </span>
                                      <span className="text-[#C50212] font-medium truncate">
                                        {ev.player.name || "Out Player"}
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1.5 min-w-0 justify-end">
                                      <span className="text-gray-200 font-medium truncate">
                                        {ev.player.name || "Unknown Player"}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </Fragment>
                    );
                  })}

                  {/* Half Time row — shown when match is currently at HT and no 2nd-half events exist yet */}
                  {status === "HT" && !renderedHalfTimeDivider && (
                    <div className="bg-custom-gray flex flex-col items-center justify-center gap-1 py-3 text-[11px] font-light text-white tracking-widest border-y border-custom-gray">
                      <div className="flex items-center gap-2">
                        <img
                          src="/images/specs/clock.svg"
                          alt=""
                          className="w-3.5 h-3.5 object-contain"
                        />
                        <span>{tEv("halfTime")}</span>
                      </div>
                      <span className="font-mono text-sm font-bold text-gray-200 mt-0.5">
                        {getScoreAtMinute(45)}
                      </span>
                    </div>
                  )}

                  {/* End Match Banner with Final Full Time Score */}
                  {isConfirmedFinished && (
                    <div className="bg-custom-gray flex flex-col items-center justify-center gap-1 py-3 text-[11px] font-light text-white tracking-widest">
                      <div className="flex items-center gap-2">
                        <img
                          src="/images/specs/final.svg"
                          alt=""
                          className="w-3.5 h-3.5 object-contain"
                        />
                        <span>{tEv("matchFinished")}</span>
                      </div>
                      <span className="font-mono text-sm font-bold text-gray-200 mt-0.5">
                        {getScoreAtMinute(999)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : status === "HT" ? (
              <div className="bg-custom-gray-2 rounded-xl border border-custom-gray overflow-hidden">
                <div className="bg-custom-gray flex items-center justify-center gap-2 py-4 text-[11px] font-light text-white tracking-widest border-b border-custom-gray">
                  <img
                    src="/images/specs/clock.svg"
                    alt=""
                    className="w-3.5 h-3.5 object-contain"
                  />
                  <span>{tEv("matchStarted")}</span>
                </div>
                <div className="py-5 text-center text-[11px] text-gray-600 tracking-wider">
                  {tEv("noNotableActions")}
                </div>
                <div className="bg-custom-gray flex flex-col items-center justify-center gap-1 py-3 text-[11px] font-light text-white tracking-widest border-y border-custom-gray">
                  <div className="flex items-center gap-2">
                    <img
                      src="/images/specs/clock.svg"
                      alt=""
                      className="w-3.5 h-3.5 object-contain"
                    />
                    <span>{tEv("halfTime")}</span>
                  </div>
                  <span className="font-mono text-sm font-bold text-gray-200 mt-0.5">
                    0 – 0
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-sm text-gray-200 rounded-xl bg-custom-gray-2">
                {tTabs("noInfo")}
              </div>
            )}
          </div>
        )}

        {activeTab === "details" && (
          <div className="w-full">
            <MatchCenterDetails details={details} />
          </div>
        )}

        {activeTab === "lineups" && (
          <div className="w-full">
            <MatchCenterLinenups details={details} />
          </div>
        )}

        {activeTab === "table" && (
          <div className="w-full bg-custom-gray rounded-xl overflow-x-auto">
            <Link
              href={`/league/${leagueId}`}
              className="flex items-center justify-center gap-3 py-4"
            >
              <div className="flex items-center gap-4 p-4 bg-custom-gray ">
                {leagueLogo && (
                  <Image
                    src={leagueLogo}
                    alt={leagueName || "League Logo"}
                    width={50}
                    height={50}
                    className="object-contain w-15 h-15"
                  />
                )}
                <div>
                  <h1 className="text-xl font-extrabold tracking-tight">
                    {leagueName}
                  </h1>
                </div>
              </div>
            </Link>
            <StandingsTable standings={standings} />
          </div>
        )}
      </div>
    </div>
  );
}
