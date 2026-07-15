"use client";

import { useState, useEffect, useRef, Fragment } from "react";
import { useTranslations } from "next-intl";
import StandingsTable from "@/components/info/standings/page";
import WorldCupGroups, { WorldCupLegend } from "@/components/WorldCupGroups";
import MatchCenterDetails from "@/components/info/matchDetails/page";
import TeamLastMatches from "@/components/info/matchDetails/TeamLastMatches";
import PreMatchStats from "@/components/info/matchDetails/PreMatchStats";
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
import PredictionWidget from "@/components/PredictionWidget";

const FINISHED_STATUSES: FixtureStatus[] = ["FT", "AET", "PEN", "AWD", "WO"];

function getLeagueFlag(leagueId: number): string | null {
  switch (leagueId) {
    case 39:
      return "/images/flags/gb-eng.svg";
    case 140:
      return "/images/flags/es.svg";
    case 135:
      return "/images/flags/it.svg";
    case 253:
      return "/images/flags/us.svg";
    case 262:
      return "/images/flags/mx.svg";
    default:
      return null;
  }
}

function applyOptimisticResult(
  standings: DbStanding[],
  homeTeamName: string,
  awayTeamName: string,
  homeScore: number,
  awayScore: number
): DbStanding[] {
  const updated = standings.map((s) => {
    const isHome = s.team_name === homeTeamName;
    const isAway = s.team_name === awayTeamName;
    if (!isHome && !isAway) return s;

    const scored = isHome ? homeScore : awayScore;
    const conceded = isHome ? awayScore : homeScore;
    const teamWon = isHome ? homeScore > awayScore : awayScore > homeScore;
    const isDraw = homeScore === awayScore;

    return {
      ...s,
      played: s.played + 1,
      won: s.won + (teamWon ? 1 : 0),
      drawn: s.drawn + (isDraw ? 1 : 0),
      lost: s.lost + (!teamWon && !isDraw ? 1 : 0),
      goals_for: s.goals_for + scored,
      goals_against: s.goals_against + conceded,
      points: s.points + (teamWon ? 3 : isDraw ? 1 : 0),
    };
  });

  // Re-rank within each group by: points → GD → GF
  const groups = new Map<string, DbStanding[]>();
  for (const row of updated) {
    const key = row.group_name ?? "";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  const reranked: DbStanding[] = [];
  for (const group of groups.values()) {
    group.sort((a, b) => {
      const ptsDiff = b.points - a.points;
      if (ptsDiff !== 0) return ptsDiff;
      const gdDiff =
        b.goals_for - b.goals_against - (a.goals_for - a.goals_against);
      if (gdDiff !== 0) return gdDiff;
      return b.goals_for - a.goals_for;
    });
    group.forEach((row, i) => reranked.push({ ...row, rank: i + 1 }));
  }

  return reranked;
}

type TabType = "events" | "table" | "scorers" | "details" | "lineups";

interface MatchTabsProps {
  details: DbMatchDetails | null;
  standings: DbStanding[];
  scorers: DbTopScorer[];
  leagueName: string | null;
  leagueId: number;
  matchId: number;
  homeTeamName?: string;
  awayTeamName?: string;
  initialIsLive: boolean;
  initialStatus: FixtureStatus;
  initialElapsed: number | null;
  homeLogo?: string | null;
  awayLogo?: string | null;
  venueName?: string | null;
  venueCity?: string | null;
  referee?: string | null;
  penaltyHome?: number | null;
  penaltyAway?: number | null;
  round?: string | null;
  kickoffDate?: string;
}

export default function MatchTabs({
  details,
  standings,
  leagueName,
  leagueId,
  matchId,
  homeTeamName,
  awayTeamName,
  homeLogo,
  awayLogo,
  initialIsLive,
  initialStatus,
  initialElapsed,
  venueName,
  venueCity,
  referee,
  penaltyHome,
  penaltyAway,
  round,
  kickoffDate,
}: MatchTabsProps) {
  const knockoutKeywords = [
    "round of 16",
    "round of 32",
    "round of 64",
    "quarter",
    "semi",
    "final",
    "3rd place",
    "third place",
    "playoff",
    "knockout",
  ];
  const isKnockout = knockoutKeywords.some((k) =>
    round?.toLowerCase().includes(k)
  );

  const [activeTab, setActiveTab] = useState<TabType>("events");
  const [isLive, setIsLive] = useState(initialIsLive);

  // When a not-yet-started match kicks off, snap back to events tab
  useEffect(() => {
    if (isLive) setActiveTab("events");
  }, [isLive]);
  const [status, setStatus] = useState<FixtureStatus>(initialStatus);
  const [elapsed, setElapsed] = useState<number | null>(initialElapsed);
  const [liveMinute, setLiveMinute] = useState<number>(initialElapsed ?? 0);
  const liveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [liveDetails, setLiveDetails] = useState<DbMatchDetails | null>(
    details
  );
  const [localStandings, setLocalStandings] = useState<DbStanding[]>(standings);
  const optimisticApplied = useRef(false);
  const standingsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  // Season derived from the server-rendered prop; stable for this match's lifetime.
  const standingsSeason = standings[0]?.season ?? null;

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
            home_score: number | null;
            away_score: number | null;
          };
          setIsLive(updated.is_live);
          setStatus(updated.status);
          setElapsed(updated.elapsed);

          if (
            !updated.is_live &&
            FINISHED_STATUSES.includes(updated.status) &&
            updated.home_score != null &&
            updated.away_score != null &&
            !optimisticApplied.current
          ) {
            optimisticApplied.current = true;
            setLocalStandings((prev) =>
              applyOptimisticResult(
                prev,
                homeTeamName ?? "",
                awayTeamName ?? "",
                updated.home_score!,
                updated.away_score!
              )
            );
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId]);

  // When the cron syncs standings to the DB, Supabase pushes the change here.
  // We debounce 2 s so all rows in the batch arrive before we re-fetch.
  useEffect(() => {
    const channel = supabase
      .channel(`standings-live-${leagueId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "standings",
          filter: `league_id=eq.${leagueId}`,
        },
        () => {
          if (standingsDebounceRef.current)
            clearTimeout(standingsDebounceRef.current);
          standingsDebounceRef.current = setTimeout(async () => {
            const query =
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
                    .eq("season", standingsSeason ?? new Date().getFullYear())
                    .order("rank", { ascending: true });
            const { data } = await query;
            if (data) {
              optimisticApplied.current = false; // real data arrived, allow future optimistic updates
              setLocalStandings(data);
            }
          }, 2000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (standingsDebounceRef.current)
        clearTimeout(standingsDebounceRef.current);
    };
  }, [leagueId, standingsSeason]);

  // Realtime: re-fetch events the moment the cron writes to match_details.
  // Requires the match_details table to be enabled under Database → Replication
  // in the Supabase dashboard, otherwise this subscription receives no events.
  useEffect(() => {
    if (!isLive) return;

    const channel = supabase
      .channel(`match-details-rt-${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "match_details",
          filter: `match_id=eq.${matchId}`,
        },
        async () => {
          try {
            const res = await fetch(`/api/match/${matchId}/events`);
            if (res.ok) {
              const data: DbMatchDetails | null = await res.json();
              if (data) setLiveDetails(data);
            }
          } catch {
            /* network hiccup — the 30 s fallback poll will catch it */
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId, isLive]);

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

  // Keep liveDetails in sync if the server-rendered prop ever changes (navigation)
  useEffect(() => {
    setLiveDetails(details);
  }, [details]);

  // Poll for fresh events every 60 s during live matches.
  // The cron is the only caller that hits the API; the client just reads
  // from match_details so no quota is burned here.
  useEffect(() => {
    if (!isLive) return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/match/${matchId}/events`);
        if (res.ok) {
          const data: DbMatchDetails | null = await res.json();
          if (data) setLiveDetails(data);
        }
      } catch {
        /* network hiccup — will retry next tick */
      }
    };
    poll();
    const id = setInterval(poll, 30_000);
    return () => clearInterval(id);
  }, [matchId, isLive]);

  const tTabs = useTranslations("matchTabs");
  const tEv = useTranslations("matchEvents");
  const tBadge = useTranslations("liveBadge");

  const isConfirmedFinished = !isLive && FINISHED_STATUSES.includes(status);
  const isFriendly = leagueId === 10;

  const homeTeamId =
    liveDetails?.lineups?.[0]?.team?.id ??
    liveDetails?.statistics?.[0]?.team?.id;

  const isWorldCup = leagueId === League.WorldCup;
  const matchGroupName = isWorldCup
    ? localStandings.find((s) => s.team_id === homeTeamId)?.group_name ??
      localStandings.find((s) => s.team_name === homeTeamName)?.group_name ??
      localStandings.find((s) => s.team_name === awayTeamName)?.group_name ??
      null
    : null;
  const groupStandings = matchGroupName
    ? localStandings.filter((s) => s.group_name === matchGroupName)
    : localStandings;

  const homeGroupName = isWorldCup
    ? localStandings.find((s) => s.team_id === homeTeamId)?.group_name ??
      localStandings.find((s) => s.team_name === homeTeamName)?.group_name ??
      null
    : null;
  const awayGroupName = isWorldCup
    ? localStandings.find((s) => s.team_name === awayTeamName)?.group_name ??
      null
    : null;
  const isDualGroup = !!(
    homeGroupName &&
    awayGroupName &&
    homeGroupName !== awayGroupName
  );
  const homeGroupStandings = homeGroupName
    ? localStandings.filter((s) => s.group_name === homeGroupName)
    : [];
  const awayGroupStandings = awayGroupName
    ? localStandings.filter((s) => s.group_name === awayGroupName)
    : [];

  const isPenStatus =
    status === "P" ||
    status === "PEN" ||
    (penaltyHome != null && penaltyAway != null);

  // If non-penalty events exist in the 91-119 min window, the match had extra
  // time before the shootout → threshold is 120. If that window is empty
  // (direct penalties from 90 min), use 91 so shootout kicks reported by some
  // APIs with elapsed < 120 are still correctly classified.
  const hasNonPenaltyETEvents =
    isPenStatus &&
    (liveDetails?.events ?? []).some(
      (e) =>
        e.time.elapsed > 90 &&
        e.time.elapsed < 120 &&
        !(
          e.type === "Goal" &&
          (e.detail === "Penalty" || e.detail === "Missed Penalty")
        )
    );
  const penaltyShootoutThreshold = isPenStatus
    ? hasNonPenaltyETEvents
      ? 120
      : 90
    : Infinity;

  const getScoreAtMinute = (minute: number): string => {
    let home = 0;
    let away = 0;

    liveDetails?.events?.forEach((ev: MatchEvent) => {
      if (
        ev.type === "Goal" &&
        ev.detail !== "Missed Penalty" &&
        ev.time.elapsed <= minute &&
        !(
          isPenStatus &&
          ev.time.elapsed >= penaltyShootoutThreshold &&
          (hasNonPenaltyETEvents ||
            ev.time.elapsed > penaltyShootoutThreshold ||
            !ev.time.extra)
        )
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

  const getVarDetail = (detail: string): string => {
    const map: Record<string, string> = {
      "Goal Disallowed - handball": tEv("varGoalDisallowedHandball"),
      "Goal Disallowed - offside": tEv("varGoalDisallowedOffside"),
      "Goal Disallowed - Offside": tEv("varGoalDisallowedOffside"),
      "Goal Disallowed": tEv("varGoalDisallowed"),
      "Goal ok": tEv("varGoalConfirmed"),
      "Goal confirmed": tEv("varGoalConfirmed"),
      "Penalty confirmed": tEv("varPenaltyConfirmed"),
      "Penalty awarded": tEv("penaltyAwarded"),
      "Penalty cancelled": tEv("penaltyCancelled"),
      "Red Card Upgrade": tEv("varRedCardUpgrade"),
      "Yellow Card Upgrade": tEv("varYellowCardUpgrade"),
    };
    if (map[detail]) return map[detail];
    // Any "Goal Disallowed - <reason>" variant the API sends that isn't in the
    // explicit map above (e.g. "Goal Disallowed - Foul") — show base label + reason.
    if (detail.toLowerCase().startsWith("goal disallowed")) {
      const sep = detail.indexOf(" - ");
      const reason = sep !== -1 ? detail.slice(sep + 3) : "";
      return reason
        ? `${tEv("varGoalDisallowed")} – ${reason}`
        : tEv("varGoalDisallowed");
    }
    return detail;
  };

  const tabs: { id: TabType; label: string }[] = [
    {
      id: "events",
      label:
        status === "NS" || status === "TBD"
          ? tTabs("overview")
          : tTabs("events"),
    },
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
    liveDetails?.events?.reduce(
      (max, ev) =>
        ev.time.elapsed === 45 && ev.time.extra
          ? Math.max(max, ev.time.extra)
          : max,
      0
    ) ?? 0;
  const secondHalfAdded =
    liveDetails?.events?.reduce(
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

  // True only for matches that actually went to extra time (AET/PEN) or are
  // currently live in ET/BT. Group-stage matches always end FT — never true.
  const matchHadExtraTime = ["AET", "PEN", "ET", "BT"].includes(status);

  // Chronological event timeline state triggers
  let renderedStartDivider = false;
  let renderedHalfTimeDivider = false;
  let renderedFirstHalfAddedTime = false;
  let renderedSecondHalfAddedTime = false;
  let renderedRegularTimeEndDivider = false;
  let renderedEtStartDivider = false;
  let renderedEtHalfTimeDivider = false;
  let renderedEt2ndHalfDivider = false;

  const penaltyResultEvent = isPenStatus
    ? (liveDetails?.events ?? []).find((e) => e.type === "penaltyResult") ??
      null
    : null;
  const shootoutKicks = isPenStatus
    ? (liveDetails?.events ?? []).filter(
        (e) =>
          e.type === "Goal" &&
          (e.detail === "Penalty" || e.detail === "Missed Penalty") &&
          e.time.elapsed >= penaltyShootoutThreshold &&
          (hasNonPenaltyETEvents ||
            e.time.elapsed > penaltyShootoutThreshold ||
            !e.time.extra)
      )
    : [];

  const penFinalScore = penaltyResultEvent
    ? penaltyResultEvent.detail
    : shootoutKicks.length > 0 && homeTeamId
    ? `${
        shootoutKicks.filter(
          (k) => k.detail === "Penalty" && k.team.id === homeTeamId
        ).length
      }–${
        shootoutKicks.filter(
          (k) => k.detail === "Penalty" && k.team.id !== homeTeamId
        ).length
      }`
    : penaltyHome != null && penaltyAway != null
    ? `${penaltyHome}–${penaltyAway}`
    : null;

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
              className="w-1/4 text-center py-2 text-xs font-light tracking-wider border-b transition-colors whitespace-nowrap border-transparent text-gray-200 hover:text-white hover:bg-custom-gray/50 hover:rounded-t-xl active:cursor-pointer"
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
          {(status === "NS" || status === "TBD") ? (
            <div className="space-y-2">
              <PredictionWidget
                matchId={matchId}
                leagueId={leagueId}
                homeTeam={homeTeamName ?? ""}
                awayTeam={awayTeamName ?? ""}
                homeLogo={homeLogo ?? null}
                awayLogo={awayLogo ?? null}
                isKnockout={isKnockout}
              />
              <TeamLastMatches
                homeLogoUrl={homeLogo ?? null}
                awayLogoUrl={awayLogo ?? null}
                homeTeamName={homeTeamName ?? ""}
                awayTeamName={awayTeamName ?? ""}
              />
            </div>
          ) : (
            <div className="flex flex-col lg:grid lg:grid-cols-[7fr_3fr] gap-4 items-start">
              <div className="w-full space-y-2 min-w-0">
                {liveDetails?.events && liveDetails.events.length > 0 ? (
              <div className="bg-custom-gray rounded-[14px] border border-white/8 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] overflow-hidden">
                <div className=" divide-y divide-custom-gray/30">
                  {[...liveDetails.events]
                    .sort(
                      (a, b) =>
                        a.time.elapsed * 1000 +
                        (a.time.extra ?? 999) -
                        (b.time.elapsed * 1000 + (b.time.extra ?? 999))
                    )
                    .map((ev: MatchEvent, index: number) => {
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
                      const isPenaltyGoal =
                        ev.type === "Goal" && ev.detail === "Penalty";
                      const isMissedPenalty =
                        ev.type === "Goal" && ev.detail === "Missed Penalty";
                      const isShootoutEvent =
                        isPenStatus &&
                        (isPenaltyGoal || isMissedPenalty) &&
                        ev.time.elapsed >= penaltyShootoutThreshold &&
                        (hasNonPenaltyETEvents ||
                          ev.time.elapsed > penaltyShootoutThreshold ||
                          !ev.time.extra);
                      const isPenaltyResult = ev.type === "penaltyResult";
                      const isVar = ev.type === "Var";
                      const isRegularGoal =
                        ev.type === "Goal" &&
                        ev.detail !== "Penalty" &&
                        ev.detail !== "Own Goal" &&
                        ev.detail !== "Missed Penalty";

                      // Any penalty-call event (awarded/confirmed/cancelled) that
                      // belongs to the shootout phase should be hidden from the
                      // regular timeline — regardless of event type, because some
                      // API responses emit these as non-Var events during shootouts.
                      const isShootoutCallEvent =
                        isPenStatus &&
                        ev.time.elapsed >= penaltyShootoutThreshold &&
                        (hasNonPenaltyETEvents ||
                          ev.time.elapsed > penaltyShootoutThreshold ||
                          !ev.time.extra) &&
                        (ev.detail === "Penalty awarded" ||
                          ev.detail === "Penalty confirmed" ||
                          ev.detail === "Penalty cancelled");
                      if (isShootoutCallEvent) return null;

                      // Drop VAR events whose detail is not meaningful.
                      // The API logs interim decisions ("Corner Cancelled" etc.) that
                      // are often deleted in the next update — only show decisions that
                      // carry real information. Any "Goal Disallowed - <reason>" variant
                      // is allowed via prefix so new foul types (e.g. "Foul") pass through.
                      const MEANINGFUL_VAR_DETAILS = new Set([
                        "Goal ok",
                        "Goal confirmed",
                        "Penalty confirmed",
                        "Penalty awarded",
                        "Penalty cancelled",
                        "Red Card Upgrade",
                        "Yellow Card Upgrade",
                      ]);
                      if (isVar) {
                        const meaningful =
                          MEANINGFUL_VAR_DETAILS.has(ev.detail) ||
                          ev.detail.toLowerCase().startsWith("goal disallowed");
                        if (!meaningful) return null;
                      }

                      // Drop events with unrecognized types that carry no player name —
                      // nothing meaningful can be shown and they'd fall into the catch-all
                      // with "unknown" text.
                      const isKnownType =
                        isOwnGoal ||
                        isPenaltyGoal ||
                        isMissedPenalty ||
                        isRegularGoal ||
                        isSubstitution ||
                        isVar ||
                        isPenaltyResult ||
                        isShootoutEvent;
                      if (!isKnownType && !ev.player.name) return null;

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

                      // Also trigger for substitutions at elapsed=45 with no extra when the
                      // first half is over — the API commonly reports HT subs or early 2H
                      // subs with elapsed=45 before correcting to the real minute.
                      const showHalfTimeBreak =
                        !renderedHalfTimeDivider &&
                        (ev.time.elapsed > 45 ||
                          (ev.time.elapsed === 45 &&
                            !ev.time.extra &&
                            ev.type === "subst" &&
                            status !== "1H")) &&
                        !isPenaltyResult;
                      if (showHalfTimeBreak) renderedHalfTimeDivider = true;

                      // Extra Time Chronology Triggers
                      const showRegularTimeEnd =
                        !renderedRegularTimeEndDivider &&
                        matchHadExtraTime &&
                        ev.time.elapsed > 90 &&
                        !isShootoutEvent &&
                        !isPenaltyResult;
                      if (showRegularTimeEnd)
                        renderedRegularTimeEndDivider = true;

                      const showEtStart =
                        !renderedEtStartDivider &&
                        matchHadExtraTime &&
                        ev.time.elapsed > 90 &&
                        !isShootoutEvent &&
                        !isPenaltyResult;
                      if (showEtStart) renderedEtStartDivider = true;

                      const showEtHalfTime =
                        !renderedEtHalfTimeDivider &&
                        matchHadExtraTime &&
                        ev.time.elapsed > 105 &&
                        !isShootoutEvent &&
                        !isPenaltyResult;
                      if (showEtHalfTime) renderedEtHalfTimeDivider = true;

                      const showEt2ndHalf =
                        !renderedEt2ndHalfDivider &&
                        matchHadExtraTime &&
                        ev.time.elapsed > 105 &&
                        !isShootoutEvent &&
                        !isPenaltyResult;
                      if (showEt2ndHalf) renderedEt2ndHalfDivider = true;

                      return (
                        <Fragment key={index}>
                          {/* Start Section Banner */}
                          {showStart && (
                            <div className="bg-custom-gray-2 flex items-center justify-center gap-2 py-4 text-[11px] font-light text-white tracking-widest border-b border-custom-gray rounded-t-xl">
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
                            <div className="bg-custom-gray-2 flex flex-col items-center justify-center gap-1 py-3 text-[11px] font-light text-white tracking-widest border-y border-custom-gray">
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
                          {showHalfTimeBreak && !isConfirmedFinished && (
                            <div className="flex items-center justify-center gap-2 py-2 text-[10px] font-medium text-gray-300 tracking-widest border-b border-custom-gray/40">
                              <img
                                src="/images/specs/final.svg"
                                alt=""
                                className="w-3 h-3 object-contain opacity-60"
                              />
                              <span>{tEv("secondHalfStarts")}</span>
                            </div>
                          )}

                          {/* Regular Time Finished Banner */}
                          {showRegularTimeEnd && (
                            <div className="bg-custom-gray-2 flex flex-col items-center justify-center gap-1 py-3 text-[11px] font-light text-white tracking-widest">
                              <div className="flex items-center gap-2">
                                <img
                                  src="/images/specs/final.svg"
                                  alt=""
                                  className="w-3.5 h-3.5 object-contain"
                                />
                                <span>{tEv("regularTimeFinished")}</span>
                              </div>
                              <span className="font-mono text-sm font-bold text-gray-200 mt-0.5">
                                {getScoreAtMinute(90)}
                              </span>
                            </div>
                          )}

                          {/* Extra Time 1st Half Banner */}
                          {showEtStart && !isConfirmedFinished && (
                            <div className="flex items-center justify-center gap-2 py-2 text-[10px] font-medium text-gray-300 tracking-widest border-b border-custom-gray/40">
                              <img
                                src="/images/specs/final.svg"
                                alt=""
                                className="w-3 h-3 object-contain opacity-60"
                              />
                              <span>{tEv("firstHalfExtraTimeStarts")}</span>
                            </div>
                          )}

                          {/* Extra Time Intermission Break Banner */}
                          {showEtHalfTime && (
                            <div className="bg-custom-gray-2 flex flex-col items-center justify-center gap-1 py-3 text-[11px] font-light text-white tracking-widest">
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

                          {/* Extra Time 2nd Half Banner */}
                          {showEt2ndHalf && !isConfirmedFinished && (
                            <div className="flex items-center justify-center gap-2 py-2 text-[10px] font-medium text-gray-300 tracking-widest border-b border-custom-gray/40">
                              <img
                                src="/images/specs/final.svg"
                                alt=""
                                className="w-3 h-3 object-contain opacity-60"
                              />
                              <span>{tEv("secondHalfExtraTimeStarts")}</span>
                            </div>
                          )}

                          {/* Synthetic penalty-awarded row — shown before in-game penalty
                            attempts only (not shootout kicks or result events) */}
                          {!isShootoutEvent &&
                            !isPenaltyResult &&
                            (isPenaltyGoal || isMissedPenalty) && (
                              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 py-2 px-4 border-b border-custom-gray/40">
                                <div className="w-full min-w-0">
                                  {isHomeEvent && (
                                    <div className="flex items-center justify-between w-full gap-2.5">
                                      <span className="text-[11px] text-gray-200 font-medium truncate">
                                        {tEv("penaltyAwarded")}
                                      </span>
                                      <span className="flex items-center justify-center w-6 h-6 rounded-full shrink-0">
                                        <img
                                          src="/images/specs/final.svg"
                                          alt=""
                                          className="w-4 h-4 object-contain"
                                        />
                                      </span>
                                    </div>
                                  )}
                                </div>
                                <div className="px-2.5 py-1 text-gray-200 font-bold font-mono text-xs text-center min-w-10.5">
                                  {ev.time.extra
                                    ? `${ev.time.elapsed}+`
                                    : ev.time.elapsed}
                                  ′
                                </div>
                                <div className="w-full min-w-0">
                                  {!isHomeEvent && (
                                    <div className="flex items-center justify-between w-full gap-2.5">
                                      <span className="flex items-center justify-center w-6 h-6 rounded-full shrink-0">
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

                          {isPenaltyResult ? null : isShootoutEvent ? (
                            /* Compact row for penalty shootout kicks — live only; finished matches render below "Match Finished" */
                            isConfirmedFinished ? null : (
                              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-2.5 px-4">
                                <div className="w-full min-w-0">
                                  {isHomeEvent && (
                                    <div className="flex items-center justify-end gap-2 w-full">
                                      {ev.player.name && (
                                        <span className="text-[11px] text-gray-200 font-medium truncate">
                                          {ev.player.name}
                                        </span>
                                      )}
                                      <img
                                        src={
                                          isMissedPenalty
                                            ? "/images/specs/missed-penalty.svg"
                                            : "/images/specs/ball.svg"
                                        }
                                        alt=""
                                        className="w-6 h-6 object-contain shrink-0"
                                      />
                                    </div>
                                  )}
                                </div>
                                <div className="w-2 shrink-0" />
                                <div className="w-full min-w-0">
                                  {!isHomeEvent && (
                                    <div className="flex items-center gap-2 w-full">
                                      <img
                                        src={
                                          isMissedPenalty
                                            ? "/images/specs/missed-penalty.svg"
                                            : "/images/specs/ball.svg"
                                        }
                                        alt=""
                                        className="w-6 h-6 object-contain shrink-0"
                                      />
                                      {ev.player.name && (
                                        <span className="text-[11px] text-gray-200 font-medium truncate">
                                          {ev.player.name}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          ) : (
                            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 py-3 px-4 text-sm w-full">
                              {/* Left Side: Home Team Incidents */}
                              <div className="w-full min-w-0">
                                {isHomeEvent && (
                                  <div className="flex items-center justify-between w-full gap-2.5">
                                    <div className="flex items-center gap-2 min-w-0 text-left">
                                      {isSubstitution ? (
                                        <div className="flex flex-col text-xs min-w-0">
                                          <span className="text-accent font-medium truncate">
                                            {ev.assist?.name || tEv("inPlayer")}
                                          </span>
                                          <span className="text-[#C93434] font-medium truncate">
                                            {ev.player.name || tEv("outPlayer")}
                                          </span>
                                        </div>
                                      ) : isVar ? (
                                        <div className="flex flex-col gap-0.5 min-w-0">
                                          {ev.player.name && (
                                            <span className="text-[11px] text-gray-200 font-medium truncate">
                                              {ev.player.name}
                                            </span>
                                          )}
                                          <span className="text-[9px] text-gray-300 leading-tight">
                                            {getVarDetail(ev.detail)}
                                          </span>
                                        </div>
                                      ) : isOwnGoal ||
                                        isPenaltyGoal ||
                                        isMissedPenalty ||
                                        isRegularGoal ? (
                                        <div className="flex flex-col gap-0.5 min-w-0">
                                          {ev.player.name && (
                                            <span className="text-[11px] text-gray-200 font-medium truncate">
                                              {ev.player.name}
                                            </span>
                                          )}
                                          <span className="text-[9px] text-gray-300 truncate">
                                            {isOwnGoal
                                              ? tEv("ownGoal")
                                              : isPenaltyGoal
                                              ? tEv("penaltyGoal")
                                              : isMissedPenalty
                                              ? tEv("missedPenalty")
                                              : tEv("goal")}
                                          </span>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          {ev.player.name && (
                                            <span className="text-gray-200 font-medium truncate">
                                              {ev.player.name}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </div>

                                    <div className="flex items-center shrink-0 min-w-7">
                                      <span className="flex items-center justify-center w-6 h-6 rounded-full ">
                                        <img
                                          src={getEventIcon(ev.type, ev.detail)}
                                          alt=""
                                          className={`w-5.5 h-5.5 object-contain${
                                            isSubstitution ? " rotate-180" : ""
                                          }`}
                                        />
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Center Column: Time Indicator */}
                              <div className="px-2.5 py-1 text-gray-200 font-bold font-mono text-xs text-center min-w-10.5">
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
                                      <span className="flex items-center justify-center w-6 h-6 rounded-full">
                                        <img
                                          src={getEventIcon(ev.type, ev.detail)}
                                          alt=""
                                          className="w-5.5 h-5.5 object-contain"
                                        />
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-2 min-w-0 text-right justify-end w-full">
                                      {isSubstitution ? (
                                        <div className="flex flex-col text-xs text-right items-end min-w-0">
                                          <span className="text-accent font-medium truncate">
                                            {ev.assist?.name || tEv("inPlayer")}
                                          </span>
                                          <span className="text-[#C93434] font-medium truncate">
                                            {ev.player.name || tEv("outPlayer")}
                                          </span>
                                        </div>
                                      ) : isVar ? (
                                        <div className="flex flex-col gap-0.5 min-w-0 items-end">
                                          {ev.player.name && (
                                            <span className="text-[11px] text-gray-200 font-medium truncate">
                                              {ev.player.name}
                                            </span>
                                          )}
                                          <span className="text-[9px] text-gray-300 text-right leading-tight">
                                            {getVarDetail(ev.detail)}
                                          </span>
                                        </div>
                                      ) : isOwnGoal ||
                                        isPenaltyGoal ||
                                        isMissedPenalty ||
                                        isRegularGoal ? (
                                        <div className="flex flex-col gap-0.5 min-w-0 items-end">
                                          {ev.player.name && (
                                            <span className="text-[11px] text-gray-200 font-medium truncate">
                                              {ev.player.name}
                                            </span>
                                          )}
                                          <span className="text-[9px] text-gray-300 truncate">
                                            {isOwnGoal
                                              ? tEv("ownGoal")
                                              : isPenaltyGoal
                                              ? tEv("penaltyGoal")
                                              : isMissedPenalty
                                              ? tEv("missedPenalty")
                                              : tEv("goal")}
                                          </span>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-1.5 min-w-0 justify-end">
                                          {ev.player.name && (
                                            <span className="text-gray-200 font-medium truncate">
                                              {ev.player.name}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </Fragment>
                      );
                    })}

                  {/* Live first-half added time — no event has happened yet in added time */}
                  {liveFirstHalfExtra > 0 &&
                    firstHalfAdded === 0 &&
                    !renderedHalfTimeDivider && (
                      <div className="flex items-center justify-center gap-2 py-2 text-[10px] font-medium text-gray-300 tracking-widest">
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
                      <div className="flex items-center justify-center gap-2 py-2 text-[10px] font-medium text-gray-300 tracking-widest">
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
                    <div className="bg-custom-gray-2 flex flex-col items-center justify-center gap-1 py-3 text-[11px] font-light text-white tracking-widest">
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
                      <div className="bg-custom-gray-2 flex flex-col items-center justify-center gap-1 py-3 text-[11px] font-light text-white tracking-widest">
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
                      <div className="flex items-center justify-center gap-2 py-2 text-[10px] font-medium text-gray-300 tracking-widest">
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
                    <div className="bg-custom-gray-2 flex flex-col items-center justify-center gap-1 py-3 text-[11px] font-light text-white tracking-widest">
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

                  {/* Penalty Shootout Section — rendered after "Match Finished" for completed PEN matches */}
                  {isConfirmedFinished &&
                    isPenStatus &&
                    (penaltyResultEvent !== null ||
                      shootoutKicks.length > 0 ||
                      (penaltyHome != null && penaltyAway != null)) && (
                      <>
                        {/* Shootout header banner */}
                        <div className="bg-custom-gray flex flex-col items-center justify-center gap-1 py-3 text-[11px] font-light text-white tracking-widest">
                          <div className="flex items-center gap-2">
                            <img
                              src="/images/specs/final.svg"
                              alt=""
                              className="w-3.5 h-3.5 object-contain"
                            />
                            <span>{tEv("penaltyShootout")}</span>
                          </div>
                          {penaltyResultEvent && (
                            <span className="font-mono text-sm font-bold text-gray-200 mt-0.5">
                              {penaltyResultEvent.detail}
                            </span>
                          )}
                        </div>

                        {/* Individual kick rows (when API provides them) */}
                        {shootoutKicks.map((kick, i) => {
                          const isHomeKick = homeTeamId
                            ? kick.team.id === homeTeamId
                            : false;
                          const isMiss = kick.detail === "Missed Penalty";
                          return (
                            <div
                              key={i}
                              className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-2.5 px-4"
                            >
                              <div className="w-full min-w-0">
                                {isHomeKick && (
                                  <div className="flex items-center justify-end gap-2 w-full">
                                    {kick.player.name && (
                                      <span className="text-[11px] text-gray-200 font-medium truncate">
                                        {kick.player.name}
                                      </span>
                                    )}
                                    <img
                                      src={
                                        isMiss
                                          ? "/images/specs/missed-penalty.svg"
                                          : "/images/specs/ball.svg"
                                      }
                                      alt=""
                                      className="w-6 h-6 object-contain shrink-0"
                                    />
                                  </div>
                                )}
                              </div>
                              <div className="w-2 shrink-0" />
                              <div className="w-full min-w-0">
                                {!isHomeKick && (
                                  <div className="flex items-center gap-2 w-full">
                                    <img
                                      src={
                                        isMiss
                                          ? "/images/specs/missed-penalty.svg"
                                          : "/images/specs/ball.svg"
                                      }
                                      alt=""
                                      className="w-6 h-6 object-contain shrink-0"
                                    />
                                    {kick.player.name && (
                                      <span className="text-[11px] text-gray-200 font-medium truncate">
                                        {kick.player.name}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        {/* Penalty Shootout Final Score Banner */}
                        {penFinalScore && (
                          <div className="bg-custom-gray-2 flex flex-row items-center justify-center gap-1 py-3 text-[11px] font-light text-white tracking-widest">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-bold text-gray-200 mt-0.5">
                                {tEv("penLabel")}:
                              </span>
                            </div>
                            <span className="font-mono text-sm font-bold text-gray-200 mt-0.5">
                              {penFinalScore}
                            </span>
                          </div>
                        )}
                      </>
                    )}
                </div>
              </div>
            ) : status === "HT" ? (
              <div className="bg-custom-gray rounded-[14px] border border-white/8 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] overflow-hidden">
                <div className="bg-custom-gray-2 flex items-center justify-center gap-2 py-4 text-[11px] font-light text-white tracking-widest">
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
                <div className="bg-custom-gray-2 flex flex-col items-center justify-center gap-1 py-3 text-[11px] font-light text-white tracking-widest">
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
              <div className="bg-custom-gray rounded-[14px] border border-white/8 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] overflow-hidden">
                <div className="bg-custom-gray-2 flex items-center justify-center gap-2 py-4 text-[11px] font-light text-white tracking-widest">
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
            )}
            {referee &&
              (() => {
                const commaIdx = referee.indexOf(",");
                const refName =
                  commaIdx !== -1
                    ? referee.slice(0, commaIdx).trim()
                    : referee.trim();
                const refCountry =
                  commaIdx !== -1 ? referee.slice(commaIdx + 1).trim() : null;
                const countryFlagCode: Record<string, string> = {
                  Germany: "de",
                  France: "fr",
                  Italy: "it",
                  Spain: "es",
                  Netherlands: "nl",
                  Poland: "pl",
                  Portugal: "pt",
                  Belgium: "be",
                  England: "gb-eng",
                  Argentina: "ar",
                  Brazil: "br",
                  Uruguay: "uy",
                  Colombia: "co",
                  Chile: "cl",
                  Mexico: "mx",
                  "United States": "us",
                  USA: "us",
                  Canada: "ca",
                  Japan: "jp",
                  "South Korea": "kr",
                  Australia: "au",
                  "Saudi Arabia": "sa",
                  Qatar: "qa",
                  Morocco: "ma",
                  Nigeria: "ng",
                  Senegal: "sn",
                  Ghana: "gh",
                  Egypt: "eg",
                  Tunisia: "tn",
                  Algeria: "dz",
                  Cameroon: "cm",
                  Turkey: "tr",
                  Serbia: "rs",
                  Croatia: "hr",
                  Switzerland: "ch",
                  Sweden: "se",
                  Norway: "no",
                  Denmark: "dk",
                  Austria: "at",
                  Greece: "gr",
                  Romania: "ro",
                  Ukraine: "ua",
                  Slovakia: "sk",
                  "Czech Republic": "cz",
                  Russia: "ru",
                  Iran: "ir",
                  Ecuador: "ec",
                  Peru: "pe",
                  Venezuela: "ve",
                  "Costa Rica": "cr",
                  Panama: "pa",
                  Honduras: "hn",
                };
                const flagCode = refCountry
                  ? countryFlagCode[refCountry] ?? null
                  : null;
                return (
                  <div className="bg-[#1C1C1E] rounded-[14px] border border-white/8 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] p-4 mt-5">
                    <div className="flex items-center gap-4">
                      <img
                        src="/images/specs/final.svg"
                        alt=""
                        className="w-7 h-7 object-contain opacity-70 shrink-0"
                      />
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[11px] text-gray-400 tracking-wider font-semibold uppercase">
                          {tTabs("referee")}
                        </span>
                        <span className="text-sm font-medium text-white leading-tight">
                          {refName}
                        </span>
                        {refCountry && (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {flagCode && (
                              <div className="w-5 h-3.5 overflow-hidden shrink-0 relative border border-gray-300 rounded-tr-sm rounded-bl-sm">
                                <img
                                  src={`/images/flags/${flagCode}.svg`}
                                  alt={refCountry}
                                  className="w-full h-full object-cover scale-[1.15]"
                                />
                              </div>
                            )}
                            <span className="text-[11px] text-gray-400">
                              {flagCode ? "- " : ""}
                              {refCountry}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
              </div>
              <div className="w-full">
                <TeamLastMatches
                  homeLogoUrl={homeLogo ?? null}
                  awayLogoUrl={awayLogo ?? null}
                  homeTeamName={homeTeamName ?? ""}
                  awayTeamName={awayTeamName ?? ""}
                />
              </div>
            </div>
          )}
        </div>

        <div
          className={`col-start-1 row-start-1 w-full ${
            activeTab === "details" ? "" : "h-0 overflow-hidden"
          }`}
        >
          <div className="overflow-hidden">
            {(() => {
              const isScheduled = status === "NS" || status === "TBD";
              const hasStats = (liveDetails?.statistics?.length ?? 0) >= 2;
              if (isScheduled) {
                return (
                  <PreMatchStats
                    homeLogoUrl={homeLogo ?? null}
                    awayLogoUrl={awayLogo ?? null}
                    homeTeamName={homeTeamName ?? ""}
                    awayTeamName={awayTeamName ?? ""}
                    leagueId={leagueId}
                  />
                );
              }
              if (!hasStats) {
                return (
                  <TeamLastMatches
                    homeLogoUrl={homeLogo ?? null}
                    awayLogoUrl={awayLogo ?? null}
                    homeTeamName={homeTeamName ?? ""}
                    awayTeamName={awayTeamName ?? ""}
                  />
                );
              }
              return <MatchCenterDetails details={liveDetails} />;
            })()}
          </div>
        </div>

        <div
          className={`col-start-1 row-start-1 w-full ${
            activeTab === "lineups" ? "" : "h-0 overflow-hidden"
          }`}
        >
          <div className="overflow-hidden">
            <MatchCenterLinenups
              details={liveDetails}
              status={status}
              kickoffDate={kickoffDate}
            />
          </div>
        </div>

        <div
          className={`col-start-1 row-start-1 w-full ${
            activeTab === "table" ? "" : "h-0 overflow-hidden"
          }`}
        >
          <div className="w-full bg-custom-gray-2 rounded-xl overflow-hidden">
            <Link href={`/league/${leagueId}`} className="block">
              {isWorldCup ? (
                <div className="relative">
                  <img
                    src="/images/WCstandings.svg"
                    alt="FIFA World Cup 2026"
                    className="w-full h-auto object-cover"
                  />
                  <span className="absolute inset-0 flex items-center justify-center text-black text-[11px] lg:text-[18px] font-sans font-medium tracking-[0.5em] uppercase tracking-wide pointer-events-none">
                    {tBadge("worldCup")}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-4">
                  {(() => {
                    const flag = getLeagueFlag(leagueId);
                    return flag ? (
                      <img
                        src={flag}
                        alt=""
                        className="w-5 h-3.5 object-cover rounded-xs shrink-0"
                      />
                    ) : null;
                  })()}
                  <h1 className="text-xl font-extrabold tracking-tight">
                    {leagueName}
                  </h1>
                </div>
              )}
            </Link>
            {isWorldCup ? (
              isDualGroup ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-.5">
                  <WorldCupGroups
                    standings={homeGroupStandings}
                    allStandings={localStandings}
                    hideLegends
                  />
                  <WorldCupGroups
                    standings={awayGroupStandings}
                    allStandings={localStandings}
                    hideLegends
                  />
                </div>
              ) : (
                <WorldCupGroups
                  standings={groupStandings}
                  allStandings={localStandings}
                  hideLegends
                />
              )
            ) : (
              <StandingsTable
                standings={localStandings}
                highlightNames={[homeTeamName ?? "", awayTeamName ?? ""].filter(
                  Boolean
                )}
              />
            )}
          </div>
          {isWorldCup && <WorldCupLegend />}
        </div>
      </div>

      {/* Venue & referee — always visible below all tabs */}
    </div>
  );
}
