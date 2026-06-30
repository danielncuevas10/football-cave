"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { getLocalizedTeamName } from "@/lib/teamName";
import { supabase } from "@/lib/supabase";
import { useLiveMinute } from "@/hooks/useLiveMinute";
import { getWcRoundKey } from "@/lib/wcRoundLabel";
import type {
  DbMatch,
  DbMatchDetails,
  FixtureStatus,
  MatchEvent,
} from "@/types/sports";
import { LIVE_STATUSES } from "@/types/sports";

const FINISHED_STATUSES: FixtureStatus[] = ["FT", "AET", "PEN", "AWD", "WO"];

function scoreFromEvents(
  events: MatchEvent[],
  homeTeamId: number | undefined
): { home: number; away: number } {
  let home = 0;
  let away = 0;
  events.forEach((ev) => {
    if (ev.type !== "Goal" || ev.detail === "Missed Penalty") return;
    const isHome = homeTeamId ? ev.team.id === homeTeamId : false;
    if (isHome) home++;
    else away++;
  });
  return { home, away };
}

// Derive penalty shootout score from match_details events.
// Tries the synthetic "penaltyResult" event first (added when the API doesn't
// provide individual kicks), then counts individual kicks as fallback.
function penaltyScoreFromEvents(
  events: MatchEvent[],
  homeTeamId: number | undefined
): { home: number; away: number } | null {
  // synthetic penaltyResult event: detail is "4–3" (en-dash)
  const resultEv = events.find((e) => e.type === "penaltyResult");
  if (resultEv) {
    const parts = resultEv.detail.split(/[–\-]/);
    if (parts.length === 2) {
      const h = parseInt(parts[0].trim(), 10);
      const a = parseInt(parts[1].trim(), 10);
      if (!isNaN(h) && !isNaN(a)) return { home: h, away: a };
    }
  }

  // Individual kicks (elapsed >= 120)
  const kicks = events.filter(
    (e) =>
      e.type === "Goal" &&
      (e.detail === "Penalty" || e.detail === "Missed Penalty") &&
      e.time.elapsed >= 120
  );
  if (kicks.length === 0 || !homeTeamId) return null;

  const home = kicks.filter(
    (k) => k.team.id === homeTeamId && k.detail === "Penalty"
  ).length;
  const away = kicks.filter(
    (k) => k.team.id !== homeTeamId && k.detail === "Penalty"
  ).length;
  return { home, away };
}

function formatKickoff(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusLabel({
  status,
  elapsed,
  fixtureDate,
}: {
  status: FixtureStatus;
  elapsed: number | null;
  fixtureDate: string;
}) {
  const tEv = useTranslations("matchEvents");
  const minute = useLiveMinute(status, elapsed, fixtureDate);

  if (FINISHED_STATUSES.includes(status))
    return (
      <span className="text-gray-200 text-xs tracking-wider">
        {tEv("matchFinished")}
      </span>
    );

  if (status === "HT")
    return (
      <span className="text-white text-xs font-mono px-1.5 py-0.5 bg-gray-600 rounded-xl">
        {tEv("halfTimeBadge")}
      </span>
    );

  if (status === "1H" || status === "2H" || status === "ET")
    return <span className="text-[#00A800] text-xs font-mono">{minute}′</span>;

  if (status === "NS" || status === "TBD") return null;

  return <span className="text-gray-200 text-xs tracking-wider">{status}</span>;
}

function teamIdFromLogo(logo: string | null | undefined): number | null {
  if (!logo) return null;
  const m = logo.match(/\/teams\/(\d+)\.png$/);
  return m ? parseInt(m[1]) : null;
}

export default function MatchScoreHeader({
  initialMatch,
  details,
}: {
  initialMatch: DbMatch;
  details: DbMatchDetails | null;
}) {
  const tEv = useTranslations("matchEvents");
  const tTabs = useTranslations("matchTabs");
  const locale = useLocale();
  const [match, setMatch] = useState(initialMatch);
  // Penalty score derived from match_details events (reliable for all past + live PEN matches)
  const [penScore, setPenScore] = useState<{ home: number; away: number } | null>(null);

  useEffect(() => {
    const channel = supabase
      .channel(`match-detail-${match.id}`)
      .on<DbMatch>(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "matches",
          filter: `id=eq.${match.id}`,
        },
        (payload) => setMatch(payload.new as DbMatch)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [match.id]);

  // Fetch penalty score via the events API (same route MatchTabs already uses).
  // This is the most reliable source: covers finished matches (PEN) and live
  // shootouts (P) regardless of whether the DB penalty_home/penalty_away columns exist.
  // Direct client-side Supabase reads for match_details are blocked by RLS,
  // so we always go through the API route here.
  useEffect(() => {
    const isPen = match.status === "PEN" || match.status === "P";
    if (!isPen) return;

    // DB columns take priority when populated (after migration + cron backfill).
    if (match.penalty_home != null && match.penalty_away != null) {
      setPenScore({ home: match.penalty_home, away: match.penalty_away });
      return;
    }

    // Fall back to deriving from events.
    const logoHomeId = teamIdFromLogo(match.home_logo) ?? undefined;

    fetch(`/api/match/${match.id}/events`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: DbMatchDetails | null) => {
        if (!data?.events) return;
        // Prefer team ID from lineups/statistics; fall back to logo URL.
        const detailsHomeId =
          data.lineups?.[0]?.team?.id ?? data.statistics?.[0]?.team?.id;
        const homeTeamId = detailsHomeId ?? logoHomeId;
        const score = penaltyScoreFromEvents(data.events, homeTeamId);
        if (score) setPenScore(score);
      })
      .catch(() => {});
  }, [match.id, match.status, match.home_logo, match.penalty_home, match.penalty_away]);

  // Re-poll every 60 s during a live shootout (status "P") so the count
  // updates as the cron writes fresh kick events to match_details.
  useEffect(() => {
    if (match.status !== "P") return;

    const logoHomeId = teamIdFromLogo(match.home_logo) ?? undefined;

    const poll = async () => {
      const res = await fetch(`/api/match/${match.id}/events`).catch(() => null);
      if (!res?.ok) return;
      const data: DbMatchDetails | null = await res.json().catch(() => null);
      if (!data?.events) return;
      const detailsHomeId =
        data.lineups?.[0]?.team?.id ?? data.statistics?.[0]?.team?.id;
      const homeTeamId = detailsHomeId ?? logoHomeId;
      const score = penaltyScoreFromEvents(data.events, homeTeamId);
      if (score) setPenScore(score);
    };

    const id = setInterval(poll, 60_000);
    return () => clearInterval(id);
  }, [match.id, match.status, match.home_logo]);

  const kickoffPassed = new Date(match.fixture_date) < new Date();
  const isScheduled =
    (match.status === "NS" || match.status === "TBD") && !kickoffPassed;
  const isLive = match.is_live || LIVE_STATUSES.includes(match.status);

  const isWcKnockout =
    (match.league_id === 1 || match.league_id === 10) &&
    match.stage !== null &&
    match.stage !== "GROUP" &&
    match.stage !== "UNKNOWN";

  const isPenFinished = match.status === "PEN" && !match.is_live;
  const hasPenaltyWinner =
    isPenFinished &&
    penScore !== null &&
    penScore.home !== penScore.away;

  const canDetermineWinner =
    isWcKnockout &&
    !match.is_live &&
    FINISHED_STATUSES.includes(match.status) &&
    match.home_score !== null &&
    match.away_score !== null &&
    (match.home_score !== match.away_score || hasPenaltyWinner);

  const homeIsLoser =
    canDetermineWinner &&
    (match.home_score! < match.away_score! ||
      (hasPenaltyWinner && penScore!.home < penScore!.away));
  const awayIsLoser =
    canDetermineWinner &&
    (match.away_score! < match.home_score! ||
      (hasPenaltyWinner && penScore!.away < penScore!.home));

  const showPenScore =
    (match.status === "PEN" || match.status === "P") && penScore !== null;

  // Prefer DB score; fall back to counting goal events (handles sync lag).
  const homeTeamId =
    details?.lineups?.[0]?.team?.id ?? details?.statistics?.[0]?.team?.id;
  const derived =
    homeTeamId && details?.events?.length
      ? scoreFromEvents(details.events, homeTeamId)
      : null;

  const finishedFallback = FINISHED_STATUSES.includes(match.status) ? 0 : null;
  const displayHome = match.home_score ?? derived?.home ?? finishedFallback;
  const displayAway = match.away_score ?? derived?.away ?? finishedFallback;
  const hasScore = displayHome !== null && displayAway !== null;

  return (
    <div className="bg-custom-gray">
      <div className="px-6 py-5">
        <div className="flex flex-col items-center gap-6 w-full">
          <div className="flex flex-col items-center gap-2 w-full">
            {match.league_id === 1 &&
              (() => {
                const key = getWcRoundKey(match.round);
                return key ? (
                  <span className="text-[12px] text-gray-200 font-bold tracking-wide">
                    {tTabs(key)}
                  </span>
                ) : null;
              })()}
            <p className="font-light text-sm text-gray-200">
              {new Date(match.fixture_date).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 w-full">
            {(() => {
              const homeId = teamIdFromLogo(match.home_logo);
              const awayId = teamIdFromLogo(match.away_logo);
              const teamClass =
                "flex items-center gap-3 flex-col hover:opacity-80 transition-opacity";
              return (
                <>
                  {homeId ? (
                    <Link href={`/team/${homeId}`} className={teamClass}>
                      <div
                        className={`w-18 h-12 overflow-hidden scale[1.15] shrink-0 block relative ${
                          match.league_id === 1 || match.league_id === 10
                            ? "border border-gray-300 rounded-tr-md rounded-bl-md"
                            : ""
                        }`}
                      >
                        <Image
                          src={match.home_logo || "/placeholder.png"}
                          alt=""
                          width={72}
                          height={48}
                          className="w-full h-full object-cover  will-change-transform scale-[1.20]"
                        />
                      </div>

                      <span className={`text-center text-sm leading-tight line-clamp-2${homeIsLoser ? " line-through opacity-50" : ""}`}>
                        {getLocalizedTeamName(match.home_team, locale)}
                      </span>
                    </Link>
                  ) : (
                    <div className={teamClass}>
                      <Image
                        src={match.home_logo || "/placeholder.png"}
                        alt=""
                        width={40}
                        height={40}
                        className="w-15 h-15 object-contain"
                      />
                      <span className={`text-center text-sm leading-tight line-clamp-2${homeIsLoser ? " line-through opacity-50" : ""}`}>
                        {getLocalizedTeamName(match.home_team, locale)}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-center gap-2 flex-col text-center">
                    <div className="text-xl font-bold">
                      {isScheduled ? (
                        <span className="text-gray-300 text-sm font-medium">
                          {formatKickoff(match.fixture_date)}
                        </span>
                      ) : hasScore ? (
                        <>
                          {displayHome} – {displayAway}
                        </>
                      ) : (
                        <span className="text-gray-300 text-sm">–</span>
                      )}
                    </div>
                    {showPenScore && (
                      <span className="text-gray-300 text-xs font-mono tabular-nums">
                        {tEv("penLabel")} {penScore!.home}–{penScore!.away}
                      </span>
                    )}
                    {!match.is_live &&
                    FINISHED_STATUSES.includes(match.status) ? (
                      <span className="text-gray-200 text-xs tracking-wider">
                        {tEv("matchFinished")}
                      </span>
                    ) : (
                      <StatusLabel
                        status={match.status}
                        elapsed={match.elapsed}
                        fixtureDate={match.fixture_date}
                      />
                    )}
                  </div>

                  {awayId ? (
                    <Link href={`/team/${awayId}`} className={teamClass}>
                      <div
                        className={`w-18 h-12 overflow-hidden scale[1.15] shrink-0 block relative ${
                          match.league_id === 1 || match.league_id === 10
                            ? "border border-gray-300 rounded-tr-md rounded-bl-md"
                            : ""
                        }`}
                      >
                        <Image
                          src={match.away_logo || "/placeholder.png"}
                          alt=""
                          width={72}
                          height={48}
                          className="w-full h-full object-cover  will-change-transform scale-[1.20]"
                        />
                      </div>
                      <span className={`text-center text-sm leading-tight line-clamp-2${awayIsLoser ? " line-through opacity-50" : ""}`}>
                        {getLocalizedTeamName(match.away_team, locale)}
                      </span>
                    </Link>
                  ) : (
                    <div className={teamClass}>
                      <Image
                        src={match.away_logo || "/placeholder.png"}
                        alt=""
                        width={40}
                        height={40}
                        className="w-15 h-15 object-contain"
                      />
                      <span className={`text-center text-sm leading-tight line-clamp-2${awayIsLoser ? " line-through opacity-50" : ""}`}>
                        {getLocalizedTeamName(match.away_team, locale)}
                      </span>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      </div>
      {isLive && (
        <div className="h-0.5 overflow-hidden relative">
          <div
            className="absolute h-full w-50 bg-[#00A800]/50"
            style={{
              animation: "live-scan 5s ease-in-out infinite",
              boxShadow: "0 0 10px rgba(255,255,255,0.5)",
            }}
          />
        </div>
      )}
    </div>
  );
}