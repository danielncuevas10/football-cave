"use client";

import { useState, useEffect, useRef, Fragment } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import StandingsTable from "@/components/info/standings/page";
import WorldCupGroups from "@/components/WorldCupGroups";
import MatchCenterDetails from "@/components/info/matchDetails/page";
import MatchCenterLinenups from "./matchLineups/page";
import type {
  DbMatchDetails,
  DbStanding,
  DbTopScorer,
  MatchEvent,
  FixtureStatus,
} from "@/types/sports";
import { League } from "@/types/sports";
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
  homeTeamName?: string;
  awayTeamName?: string;
  venueName?: string | null;
  venueCity?: string | null;
  referee?: string | null;
  initialIsLive: boolean;
  initialStatus: FixtureStatus;
  initialElapsed: number | null;
}

export default function MatchTabs({
  details,
  standings,
  leagueName,
  leagueLogo,
  leagueId,
  matchId,
  homeTeamName,
  awayTeamName,
  venueName,
  venueCity,
  referee,
  initialIsLive,
  initialStatus,
  initialElapsed,
}: MatchTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>("events");
  const [isLive, setIsLive] = useState(initialIsLive);
  const [status, setStatus] = useState<FixtureStatus>(initialStatus);
  const [elapsed, setElapsed] = useState<number | null>(initialElapsed);
  const [liveMinute, setLiveMinute] = useState<number>(initialElapsed ?? 0);
  const liveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
            elapsed: number | null;
          };
          setIsLive(updated.is_live);
          setStatus(updated.status);
          setElapsed(updated.elapsed);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId]);

  // Uncapped per-minute ticker — resets to the latest DB value on every cron
  // update, then keeps ticking beyond 45/90 so added time shows automatically.
  useEffect(() => {
    setLiveMinute(elapsed ?? 0);

    if (liveIntervalRef.current) {
      clearInterval(liveIntervalRef.current);
      liveIntervalRef.current = null;
    }

    if (!isLive || (status !== "1H" && status !== "2H")) return;

    const tick = () => setLiveMinute((prev) => prev + 1);
    const msUntilNextMinute = 60_000 - (Date.now() % 60_000);

    const timeout = setTimeout(() => {
      tick();
      liveIntervalRef.current = setInterval(tick, 60_000);
    }, msUntilNextMinute);

    return () => {
      clearTimeout(timeout);
      if (liveIntervalRef.current) {
        clearInterval(liveIntervalRef.current);
        liveIntervalRef.current = null;
      }
    };
  }, [status, elapsed, isLive]);

  const tTabs = useTranslations("matchTabs");
  const tEv = useTranslations("matchEvents");

  const isConfirmedFinished = !isLive && FINISHED_STATUSES.includes(status);
  const isFriendly = leagueId === 10;

  const homeTeamId =
    details?.lineups?.[0]?.team?.id ?? details?.statistics?.[0]?.team?.id;

  const isWorldCup = leagueId === League.WorldCup;
  const matchGroupName = isWorldCup
    ? standings.find((s) => s.team_id === homeTeamId)?.group_name ??
      standings.find((s) => s.team_name === homeTeamName)?.group_name ??
      standings.find((s) => s.team_name === awayTeamName)?.group_name ??
      null
    : null;
  const groupStandings = matchGroupName
    ? standings.filter((s) => s.group_name === matchGroupName)
    : standings;

  const getScoreAtMinute = (minute: number): string => {
    let home = 0;
    let away = 0;

    details?.events?.forEach((ev: MatchEvent) => {
      if (
        ev.type === "Goal" &&
        ev.detail !== "Missed Penalty" &&
        ev.time.elapsed <= minute
      ) {
        // The API places every goal event (including own goals) under the team
        // that BENEFITED from the goal, so no own-goal flip is needed here.
        const isHomeTeam = homeTeamId ? ev.team.id === homeTeamId : false;
        if (isHomeTeam) {
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
    ...(!isFriendly
      ? [{ id: "table" as TabType, label: tTabs("standings") }]
      : []),
  ];

  const getEventIcon = (type: string, detail: string): string => {
    if (detail === "Penalty awarded" || detail === "Penalty confirmed")
      return "/images/specs/final.svg";
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
    if (type === "subst") return "/images/specs/Substitution.svg";
    return "/icons/default-event.svg";
  };

  // Pre-compute how many added minutes were signalled each half from event data
  const firstHalfAdded =
    details?.events?.reduce(
      (max, ev) =>
        ev.time.elapsed === 45 && ev.time.extra
          ? Math.max(max, ev.time.extra)
          : max,
      0
    ) ?? 0;
  const secondHalfAdded =
    details?.events?.reduce(
      (max, ev) =>
        ev.time.elapsed === 90 && ev.time.extra
          ? Math.max(max, ev.time.extra)
          : max,
      0
    ) ?? 0;

  // Derived from the uncapped liveMinute ticker — shows even with no events
  const liveFirstHalfExtra =
    status === "1H" && isLive && liveMinute > 45 ? liveMinute - 45 : 0;
  const liveSecondHalfExtra =
    status === "2H" && isLive && liveMinute > 90 ? liveMinute - 90 : 0;

  // Chronological event timeline state triggers
  let renderedStartDivider = false;
  let renderedHalfTimeDivider = false;
  let renderedFirstHalfAddedTime = false;
  let renderedSecondHalfAddedTime = false;
  let renderedRegularTimeEndDivider = false;
  let renderedEtStartDivider = false;
  let renderedEtHalfTimeDivider = false;

  return (
    <div className="space-y-6 w-full px-4">
      {/* Tabs Navigation Links Row */}
      <div className="flex justify-center">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="w-1/4 text-center py-2 text-xs font-light tracking-wider border-b transition-colors whitespace-nowrap border-transparent text-gray-200 hover:text-white hover:bg-gray-900/30"
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

      <div className="grid w-full my-10">
        <div
          className={`col-start-1 row-start-1 w-full ${
            activeTab === "events" ? "" : "h-0 overflow-hidden"
          }`}
        >
          <div className="w-full space-y-2">
            {details?.events && details.events.length > 0 ? (
              <div className="bg-custom-gray-2 rounded-md border border-custom-gray overflow-hidden">
                <div className=" divide-y divide-custom-gray/30">
                  {details.events.map((ev: MatchEvent, index: number) => {
                    const isOwnGoal =
                      ev.type === "Goal" && ev.detail === "Own Goal";
                    const eventFromHome = homeTeamId
                      ? ev.team.id === homeTeamId
                      : false;
                    // Own goals benefit the opposing team — show them on that side
                    const isHomeEvent = isOwnGoal
                      ? !eventFromHome
                      : eventFromHome;
                    const isSubstitution = ev.type === "subst";
                    const isVarPenalty =
                      ev.type === "Var" &&
                      (ev.detail === "Penalty confirmed" ||
                        ev.detail === "Penalty awarded");
                    const isPenaltyGoal =
                      ev.type === "Goal" && ev.detail === "Penalty";
                    const isMissedPenalty =
                      ev.type === "Goal" && ev.detail === "Missed Penalty";
                    const isRegularGoal =
                      ev.type === "Goal" &&
                      ev.detail !== "Penalty" &&
                      ev.detail !== "Own Goal" &&
                      ev.detail !== "Missed Penalty";
                    const displaySubtext = (() => {
                      // These show their label in the two-row player-name area
                      if (
                        isVarPenalty ||
                        isPenaltyGoal ||
                        isMissedPenalty ||
                        isRegularGoal
                      )
                        return null;
                      if (ev.type === "Goal" && ev.detail === "Own Goal")
                        return tEv("ownGoal");
                      if (
                        ev.type === "Var" &&
                        ev.detail === "Penalty cancelled"
                      )
                        return tEv("penaltyCancelled");
                      return null;
                    })();

                    const showStart = !renderedStartDivider;
                    if (showStart) renderedStartDivider = true;

                    const showFirstHalfAddedTime =
                      !renderedFirstHalfAddedTime &&
                      firstHalfAdded > 0 &&
                      ev.time.elapsed === 45 &&
                      (ev.time.extra ?? 0) > 0;
                    if (showFirstHalfAddedTime)
                      renderedFirstHalfAddedTime = true;

                    const showSecondHalfAddedTime =
                      !renderedSecondHalfAddedTime &&
                      secondHalfAdded > 0 &&
                      ev.time.elapsed === 90 &&
                      (ev.time.extra ?? 0) > 0;
                    if (showSecondHalfAddedTime)
                      renderedSecondHalfAddedTime = true;

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

                        {/* First-half added time indicator */}
                        {showFirstHalfAddedTime && (
                          <div className="flex items-center justify-center gap-2 py-2 text-[10px] font-medium text-gray-300 tracking-widest border-b border-custom-gray/40">
                            <img
                              src="/images/specs/clock.svg"
                              alt=""
                              className="w-3 h-3 object-contain opacity-60"
                            />
                            <span>
                              +{firstHalfAdded} {tEv("minAdded")}
                            </span>
                          </div>
                        )}

                        {/* Second-half added time indicator */}
                        {showSecondHalfAddedTime && (
                          <div className="flex items-center justify-center gap-2 py-2 text-[10px] font-medium text-gray-300 tracking-widest border-b border-custom-gray/40">
                            <img
                              src="/images/specs/clock.svg"
                              alt=""
                              className="w-3 h-3 object-contain opacity-60"
                            />
                            <span>
                              +{secondHalfAdded} {tEv("minAdded")}
                            </span>
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
                          <div className="flex items-center justify-center gap-2 py-2 text-[10px] font-medium text-gray-300 tracking-widest border-b border-custom-gray/40">
                            <img
                              src="/images/specs/final.svg"
                              alt=""
                              className="w-3 h-3 object-contain opacity-60"
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

                        {/* Synthetic penalty-awarded row — shown before every penalty
                            attempt because the API only sends a VAR event for reviewed ones */}
                        {(isPenaltyGoal || isMissedPenalty) && (
                          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 py-2 px-4 border-b border-custom-gray/40">
                            <div className="w-full min-w-0">
                              {isHomeEvent && (
                                <div className="flex items-center justify-between w-full gap-2.5">
                                  <span className="text-[11px] text-gray-200 font-medium truncate">
                                    {tEv("penaltyAwarded")}
                                  </span>
                                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-zinc-800/50 shrink-0">
                                    <img
                                      src="/images/specs/final.svg"
                                      alt=""
                                      className="w-4 h-4 object-contain"
                                    />
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="px-2.5 py-1 text-gray-200 font-bold text-xs text-center min-w-10.5">
                              {ev.time.extra
                                ? `${ev.time.elapsed}+`
                                : ev.time.elapsed}
                              ′
                            </div>
                            <div className="w-full min-w-0">
                              {!isHomeEvent && (
                                <div className="flex items-center justify-between w-full gap-2.5">
                                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-zinc-800/50 shrink-0">
                                    <img
                                      src="/images/specs/final.svg"
                                      alt=""
                                      className="w-4 h-4 object-contain"
                                    />
                                  </span>
                                  <span className="text-[10px] text-gray-200 font-medium truncate">
                                    {tEv("penaltyAwarded")}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 py-3 px-4 text-sm w-full">
                          {/* Left Side: Home Team Incidents */}
                          <div className="w-full min-w-0">
                            {isHomeEvent && (
                              <div className="flex items-center justify-between w-full gap-2.5">
                                <div className="flex items-center gap-2 min-w-0 text-left">
                                  {isSubstitution ? (
                                    <div className="flex flex-col text-xs min-w-0">
                                      <span className="text-[#20C547] font-medium truncate">
                                        {ev.assist.name || tEv("inPlayer")}
                                      </span>
                                      <span className="text-[#C50212] font-medium truncate">
                                        {ev.player.name || tEv("outPlayer")}
                                      </span>
                                    </div>
                                  ) : isVarPenalty ? (
                                    <span className="text-[11px] text-gray-200 font-medium truncate">
                                      {tEv("penaltyAwarded")}
                                    </span>
                                  ) : isPenaltyGoal ||
                                    isMissedPenalty ||
                                    isRegularGoal ? (
                                    <div className="flex flex-col gap-0.5 min-w-0">
                                      <span className="text-[11px] text-gray-200 font-medium truncate">
                                        {ev.player.name || tEv("unknownPlayer")}
                                      </span>
                                      <span className="text-[9px] text-gray-300 truncate">
                                        {isPenaltyGoal
                                          ? tEv("penaltyGoal")
                                          : isMissedPenalty
                                          ? tEv("missedPenalty")
                                          : tEv("goal")}
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <span className="text-gray-200 font-medium truncate">
                                        {ev.player.name || tEv("unknownPlayer")}
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
                                  {displaySubtext && (
                                    <span className="text-[9px] font-extrabold tracking-wider text-gray-200 leading-none">
                                      {displaySubtext}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Center Column: Time Indicator */}
                          <div className="px-2.5 py-1 text-gray-200 font-bold text-xs text-center min-w-10.5">
                            {ev.time.extra
                              ? `${ev.time.elapsed}+`
                              : ev.time.elapsed}
                            ′
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
                                  {displaySubtext && (
                                    <span className="text-[9px] font-extrabold tracking-wider font-mono text-gray-200 leading-none">
                                      {displaySubtext}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 min-w-0 text-right justify-end w-full">
                                  {isSubstitution ? (
                                    <div className="flex flex-col text-xs text-right items-end min-w-0">
                                      <span className="text-[#20C547] font-medium truncate">
                                        {ev.assist.name || tEv("inPlayer")}
                                      </span>
                                      <span className="text-[#C50212] font-medium truncate">
                                        {ev.player.name || tEv("outPlayer")}
                                      </span>
                                    </div>
                                  ) : isVarPenalty ? (
                                    <span className="text-[11px] text-gray-200 font-medium truncate">
                                      {tEv("penaltyAwarded")}
                                    </span>
                                  ) : isPenaltyGoal ||
                                    isMissedPenalty ||
                                    isRegularGoal ? (
                                    <div className="flex flex-col gap-0.5 min-w-0 items-end">
                                      <span className="text-[11px] text-gray-200 font-medium truncate">
                                        {ev.player.name || tEv("unknownPlayer")}
                                      </span>
                                      <span className="text-[9px] text-gray-300 truncate">
                                        {isPenaltyGoal
                                          ? tEv("penaltyGoal")
                                          : isMissedPenalty
                                          ? tEv("missedPenalty")
                                          : tEv("goal")}
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1.5 min-w-0 justify-end">
                                      <span className="text-gray-200 font-medium truncate">
                                        {ev.player.name || tEv("unknownPlayer")}
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

                  {/* Live first-half added time — no event has happened yet in added time */}
                  {liveFirstHalfExtra > 0 &&
                    firstHalfAdded === 0 &&
                    !renderedHalfTimeDivider && (
                      <div className="flex items-center justify-center gap-2 py-2 text-[10px] font-medium text-gray-300 tracking-widest border-b border-custom-gray/40">
                        <img
                          src="/images/specs/clock.svg"
                          alt=""
                          className="w-3 h-3 object-contain opacity-60"
                        />
                        <span>
                          +{liveFirstHalfExtra} {tEv("minAdded")}
                        </span>
                      </div>
                    )}

                  {/* Live second-half added time — no event has happened yet in added time */}
                  {liveSecondHalfExtra > 0 &&
                    secondHalfAdded === 0 &&
                    !isConfirmedFinished && (
                      <div className="flex items-center justify-center gap-2 py-2 text-[10px] font-medium text-gray-300 tracking-widest border-b border-custom-gray/40">
                        <img
                          src="/images/specs/clock.svg"
                          alt=""
                          className="w-3 h-3 object-contain opacity-60"
                        />
                        <span>
                          +{liveSecondHalfExtra} {tEv("minAdded")}
                        </span>
                      </div>
                    )}

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

                  {/* Second half has started but no 2nd-half events yet — show HT break + 2H banner immediately */}
                  {status === "2H" && !renderedHalfTimeDivider && (
                    <>
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
                      <div className="flex items-center justify-center gap-2 py-2 text-[10px] font-medium text-gray-300 tracking-widest border-b border-custom-gray/40">
                        <img
                          src="/images/specs/clock.svg"
                          alt=""
                          className="w-3 h-3 object-contain opacity-60"
                        />
                        <span>{tEv("secondHalfStarts")}</span>
                      </div>
                    </>
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
              <div className="bg-custom-gray-2 rounded-md border border-custom-gray overflow-hidden">
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
            ) : isLive ? (
              <div className="bg-custom-gray-2 rounded-md border border-custom-gray overflow-hidden">
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
                {liveFirstHalfExtra > 0 && (
                  <div className="flex items-center justify-center gap-2 py-2 text-[10px] font-medium text-gray-300 tracking-widest border-t border-custom-gray/40">
                    <img
                      src="/images/specs/clock.svg"
                      alt=""
                      className="w-3 h-3 object-contain opacity-60"
                    />
                    <span>
                      +{liveFirstHalfExtra} {tEv("minAdded")}
                    </span>
                  </div>
                )}
                {liveSecondHalfExtra > 0 && (
                  <div className="flex items-center justify-center gap-2 py-2 text-[10px] font-medium text-gray-300 tracking-widest border-t border-custom-gray/40">
                    <img
                      src="/images/specs/clock.svg"
                      alt=""
                      className="w-3 h-3 object-contain opacity-60"
                    />
                    <span>
                      +{liveSecondHalfExtra} {tEv("minAdded")}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-10 text-center rounded-md bg-custom-gray-2 space-y-2">
                {venueCity || venueName ? (
                  <div className="space-y-3">
                    {/* Venue row */}
                    <div className="flex items-center justify-center gap-2">
                      <img
                        src="/images/stadium.svg"
                        alt=""
                        className="w-6 h-6 object-contain opacity-60 shrink-0"
                      />
                      <span className="text-sm text-gray-200">
                        {[venueName, venueCity].filter(Boolean).join(", ")}
                      </span>
                    </div>

                    {/* Referee row */}
                    {referee && (
                      <div className="flex items-center justify-center gap-2">
                        <img
                          src="/images/specs/final.svg"
                          alt=""
                          className="w-4 h-4 object-contain opacity-60 shrink-0"
                        />
                        <span className="text-sm text-gray-200">{referee}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-300">{tTabs("noInfo")}</p>
                )}
              </div>
            )}
          </div>
        </div>

        <div
          className={`col-start-1 row-start-1 w-full ${
            activeTab === "details" ? "" : "h-0 overflow-hidden"
          }`}
        >
          <div className="w-full">
            <MatchCenterDetails details={details} />
          </div>
        </div>

        <div
          className={`col-start-1 row-start-1 w-full ${
            activeTab === "lineups" ? "" : "h-0 overflow-hidden"
          }`}
        >
          <div className="w-full">
            <MatchCenterLinenups details={details} />
          </div>
        </div>

        <div
          className={`col-start-1 row-start-1 w-full ${
            activeTab === "table" ? "" : "h-0 overflow-hidden"
          }`}
        >
          <div className="w-full bg-custom-gray rounded-md overflow-hidden">
            <Link href={`/league/${leagueId}`} className="block">
              {isWorldCup ? (
                <img
                  src="/images/WC262nd.svg"
                  alt="FIFA World Cup 2026"
                  className="w-full h-auto object-cover"
                />
              ) : (
                <div className="flex items-center gap-4 p-4">
                  {leagueLogo && (
                    <Image
                      src={leagueLogo}
                      alt={leagueName || "League Logo"}
                      width={50}
                      height={50}
                      className="object-contain w-15 h-15"
                    />
                  )}
                  <h1 className="text-xl font-extrabold tracking-tight">
                    {leagueName}
                  </h1>
                </div>
              )}
            </Link>
            {isWorldCup ? (
              <WorldCupGroups standings={groupStandings} />
            ) : (
              <StandingsTable standings={standings} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
