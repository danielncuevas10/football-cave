"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { getLocalizedTeamName } from "@/lib/teamName";
import { supabase } from "@/lib/supabase";
import { useLiveMinute } from "@/hooks/useLiveMinute";
import type {
  DbMatch,
  DbMatchDetails,
  FixtureStatus,
  MatchEvent,
} from "@/types/sports";

const FINISHED_STATUSES: FixtureStatus[] = ["FT", "AET", "PEN", "AWD", "WO"];

function scoreFromEvents(
  events: MatchEvent[],
  homeTeamId: number | undefined
): { home: number; away: number } {
  let home = 0;
  let away = 0;
  events.forEach((ev) => {
    if (ev.type !== "Goal" || ev.detail === "Missed Penalty") return;
    // The API places every goal event (including own goals) under the
    // benefiting team's ID, so count directly by team without flipping.
    const isHome = homeTeamId ? ev.team.id === homeTeamId : false;
    if (isHome) home++;
    else away++;
  });
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
      <span className="text-gray-200 text-xs uppercase tracking-wider">
        {tEv("matchFinished")}
      </span>
    );

  if (status === "HT")
    return (
      <span className="text-[#00A800] text-xs uppercase tracking-wider">
        {tEv("halfTime")}
      </span>
    );

  if (status === "1H" || status === "2H" || status === "ET")
    return <span className="text-[#00A800] text-xs font-mono">{minute}′</span>;

  if (status === "NS" || status === "TBD") return null;

  return (
    <span className="text-gray-200 text-xs uppercase tracking-wider">
      {status}
    </span>
  );
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
  const locale = useLocale();
  const [match, setMatch] = useState(initialMatch);

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

  const kickoffPassed = new Date(match.fixture_date) < new Date();
  const isScheduled =
    (match.status === "NS" || match.status === "TBD") && !kickoffPassed;

  // Prefer DB score; fall back to counting goal events (handles sync lag).
  // statistics[0] is always the home team and is more reliably populated than lineups.
  const homeTeamId =
    details?.lineups?.[0]?.team?.id ?? details?.statistics?.[0]?.team?.id;
  const derived =
    homeTeamId && details?.events?.length
      ? scoreFromEvents(details.events, homeTeamId)
      : null;

  // For officially-finished matches with no score data at all, default to 0-0.
  const finishedFallback = FINISHED_STATUSES.includes(match.status) ? 0 : null;
  const displayHome = match.home_score ?? derived?.home ?? finishedFallback;
  const displayAway = match.away_score ?? derived?.away ?? finishedFallback;
  const hasScore = displayHome !== null && displayAway !== null;

  return (
    <div className="px-6 py-8 bg-custom-gray-2">
      <div className="flex flex-col items-center gap-6 w-full">
        <p className="font-light text-sm text-gray-200">
          {new Date(match.fixture_date).toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
          })}
        </p>

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
                      className={`w-18 h-12 overflow-hidden shrink-0 block relative ${
                        match.league_id === 1 || match.league_id === 10
                          ? "border border-gray-300 rounded-tr-md rounded-bl-md"
                          : ""
                      }`}
                    >
                      <Image
                        src={match.home_logo || "/placeholder.png"}
                        alt=""
                        width={72} // Matches w-18 (72px) for Next.js optimization
                        height={48} // Matches h-12 (48px) for Next.js optimization
                        className="w-full h-full object-cover scale-[1.15] will-change-transform"
                      />
                    </div>

                    <span className="text-center text-sm leading-tight line-clamp-2">
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
                    <span className="text-center text-sm leading-tight line-clamp-2">
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
                  {!match.is_live &&
                  FINISHED_STATUSES.includes(match.status) ? (
                    <span className="text-gray-200 text-xs uppercase tracking-wider">
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
                      className={`w-18 h-12 overflow-hidden shrink-0 block relative ${
                        match.league_id === 1 || match.league_id === 10
                          ? "border border-gray-300 rounded-tr-md rounded-bl-md"
                          : ""
                      }`}
                    >
                      <Image
                        src={match.away_logo || "/placeholder.png"}
                        alt=""
                        width={72} // Matches w-18 (72px) for Next.js optimization
                        height={48} // Matches h-12 (48px) for Next.js optimization
                        className="w-full h-full object-cover scale-[1.15] will-change-transform"
                      />
                    </div>
                    <span className="text-center text-sm leading-tight line-clamp-2">
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
                    <span className="text-center text-sm leading-tight line-clamp-2">
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
  );
}
