"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { getLocalizedTeamName, cleanLeagueName } from "@/lib/teamName";
import { supabase } from "@/lib/supabase";
import { useLiveMinute, formatMinute } from "@/hooks/useLiveMinute";
import { getWcRoundKey } from "@/lib/wcRoundLabel";
import { TWO_LEGGED_LEAGUES } from "@/lib/twoLeggedMatch";
import type {
  DbMatch,
  DbMatchDetails,
  FixtureStatus,
  MatchEvent,
} from "@/types/sports";

const FINISHED_STATUSES: FixtureStatus[] = ["FT", "AET", "PEN", "AWD", "WO"];

// Hardcoded venue data for WC 2026 knockout matches.
// The API often omits venue for future/unplayed matches; this fills the gap.
// When the API eventually provides venue, it takes priority (see usage below).
const VENUE_OVERRIDES: Record<
  number,
  { venueName: string; venueCity: string }
> = {
  // Round of 16
  1569870: { venueName: "Lincoln Financial Field", venueCity: "Philadelphia" },
  1567824: { venueName: "NRG Stadium", venueCity: "Houston" },
  1576756: { venueName: "AT&T Stadium", venueCity: "Dallas" },
  1570715: { venueName: "Lumen Field", venueCity: "Seattle" },
  1568100: { venueName: "MetLife Stadium", venueCity: "East Rutherford" },
  1570714: { venueName: "Estadio Azteca", venueCity: "Mexico City" },
  1576804: { venueName: "Mercedes-Benz Stadium", venueCity: "Atlanta" },
  1576805: { venueName: "BC Place", venueCity: "Vancouver" },
  // Quarterfinals
  // Match 97: Boston area (Gillette Stadium, Foxborough)
  // Match 98: Los Angeles (SoFi Stadium)
  // Match 99: Miami (Hard Rock Stadium)
  // Match 100: Kansas City (Arrowhead Stadium / GEHA Field)
  // (IDs not yet in DB — add when available)
  // Semifinals
  // Match 101: Dallas (AT&T Stadium)
  // Match 102: Atlanta (Mercedes-Benz Stadium)
  // Third Place
  // Match 103: Miami (Hard Rock Stadium)
  // Final
  // Match 104: New York/NJ (MetLife Stadium)
};

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
    hour12: false,
  });
}

function StatusLabel({
  match,
}: {
  match: Parameters<typeof useLiveMinute>[0];
}) {
  const tEv = useTranslations("matchEvents");
  const minute = useLiveMinute(match);
  const { status } = match;

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
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-accent text-white font-extrabold font-mono text-[10px] shrink-0">
        <span className="animate-pulse">{formatMinute(minute, status)}</span>
      </div>
    );

  if (status === "NS" || status === "TBD") return null;

  return <span className="text-gray-200 text-xs tracking-wider">{status}</span>;
}

function isNationalTeamMatch(leagueId: number): boolean {
  const NATIONAL_TEAM_LEAGUES = [1, 4, 5, 6, 9, 10, 17, 25, 29, 30, 32, 34];
  return NATIONAL_TEAM_LEAGUES.includes(leagueId);
}

function teamIdFromLogo(logo: string | null | undefined): number | null {
  if (!logo) return null;
  const m = logo.match(/\/teams\/(\d+)\.png$/);
  return m ? parseInt(m[1]) : null;
}

export default function MatchScoreHeader({
  initialMatch,
  details,
  venueName,
  venueCity,
}: {
  initialMatch: DbMatch;
  details: DbMatchDetails | null;
  venueName?: string | null;
  venueCity?: string | null;
}) {
  const tEv = useTranslations("matchEvents");
  const tTabs = useTranslations("matchTabs");
  const tBadge = useTranslations("liveBadge");
  const locale = useLocale();
  const [match, setMatch] = useState(initialMatch);
  const [firstLeg, setFirstLeg] = useState<{
    home: number;
    away: number;
  } | null>(null);

  // Penalty score derived from match_details events (reliable for all past + live PEN matches)
  const [penScore, setPenScore] = useState<{
    home: number;
    away: number;
  } | null>(() => {
    if (
      initialMatch.penalty_home != null &&
      initialMatch.penalty_away != null
    ) {
      return {
        home: initialMatch.penalty_home,
        away: initialMatch.penalty_away,
      };
    }
    return null;
  });

  useEffect(() => {
    if (!match.round || !TWO_LEGGED_LEAGUES.has(match.league_id)) return;
    supabase
      .from("matches")
      .select("home_score, away_score")
      .eq("league_id", match.league_id)
      .eq("round", match.round)
      .eq("home_team", match.away_team)
      .eq("away_team", match.home_team)
      .lt("fixture_date", match.fixture_date)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.home_score != null && data?.away_score != null) {
          // Swap perspective: 2nd-leg home was away in leg 1
          setFirstLeg({ home: data.away_score, away: data.home_score });
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.id]);

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
    const hasPenData = match.penalty_home != null && match.penalty_away != null;
    const isPen = match.status === "PEN" || match.status === "P" || hasPenData;
    if (!isPen) return;

    // DB columns take priority when populated.
    if (hasPenData) {
      setPenScore({ home: match.penalty_home!, away: match.penalty_away! });
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
  }, [
    match.id,
    match.status,
    match.home_logo,
    match.penalty_home,
    match.penalty_away,
  ]);

  // Re-poll every 60 s during a live shootout (status "P") so the count
  // updates as the cron writes fresh kick events to match_details.
  useEffect(() => {
    if (match.status !== "P") return;

    const logoHomeId = teamIdFromLogo(match.home_logo) ?? undefined;

    const poll = async () => {
      const res = await fetch(`/api/match/${match.id}/events`).catch(
        () => null
      );
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
  const isWcKnockout =
    (match.league_id === 1 || match.league_id === 10) &&
    match.stage !== null &&
    match.stage !== "GROUP" &&
    match.stage !== "UNKNOWN";

  const isPenFinished =
    (match.status === "PEN" ||
      (match.penalty_home != null && match.penalty_away != null)) &&
    !match.is_live;
  const hasPenaltyWinner =
    isPenFinished && penScore !== null && penScore.home !== penScore.away;

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

  const showPenScore = penScore !== null;

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
    <div className="bg-custom-gray md:rounded-xl overflow-hidden">
      <div className="px-6 py-8">
        <div className="flex flex-col items-center gap-6 w-full">
          <div className="flex flex-col items-center gap-2 w-full">
            {(() => {
              const competition =
                match.league_id === 1
                  ? tBadge("worldCup")
                  : cleanLeagueName(match.league_name);

              let roundLabel: string | null = null;
              const round = match.round;
              if (round) {
                const rl = round.toLowerCase();
                if (match.league_id === 1) {
                  if (rl.includes("group")) roundLabel = tTabs("groupStage");
                  else {
                    const key = getWcRoundKey(round);
                    if (key) roundLabel = tTabs(key);
                  }
                }
                if (!roundLabel) {
                  const m = round.match(/[-–]\s*(\d+)\s*$/);
                  if (m) roundLabel = tTabs("matchday", { n: parseInt(m[1]) });
                }
                if (!roundLabel) {
                  const key = getWcRoundKey(round);
                  if (key) roundLabel = tTabs(key);
                }
              }

              const parts = [competition, roundLabel].filter(Boolean);
              if (!parts.length) return null;
              return (
                <span className="text-[12px] text-gray-200 font-medium tracking-wide text-center">
                  {parts.join(" – ")}
                </span>
              );
            })()}
          </div>

          <div className="grid grid-cols-3 gap-4 w-full">
            {(() => {
              const homeId = teamIdFromLogo(match.home_logo);
              const awayId = teamIdFromLogo(match.away_logo);
              const baseTeamClass =
                "flex items-center gap-3 flex-col transition-opacity";
              const homeClass = `${baseTeamClass}${
                homeIsLoser ? " opacity-50" : " hover:opacity-80"
              }`;
              const awayClass = `${baseTeamClass}${
                awayIsLoser ? " opacity-50" : " hover:opacity-80"
              }`;
              const isNational = isNationalTeamMatch(match.league_id);
              const flagClass = isNational
                ? "w-18 h-12 overflow-hidden shrink-0 block relative border border-gray-300 rounded-tr-lg rounded-bl-lg"
                : "w-14 h-14 overflow-hidden shrink-0 block relative rounded-sm";
              const flagImgClass = isNational
                ? "w-full h-full object-cover will-change-transform scale-[1.20]"
                : "w-full h-full object-contain";
              return (
                <>
                  {homeId ? (
                    <Link href={`/team/${homeId}`} className={homeClass}>
                      <div className={flagClass}>
                        <Image
                          src={match.home_logo || "/placeholder.png"}
                          alt=""
                          width={72}
                          height={48}
                          className={flagImgClass}
                        />
                      </div>

                      <span
                        className={`text-center text-sm leading-tight line-clamp-2${
                          homeIsLoser ? " line-through" : ""
                        }`}
                      >
                        {getLocalizedTeamName(match.home_team, locale)}
                      </span>
                    </Link>
                  ) : (
                    <div className={homeClass}>
                      <Image
                        src={match.home_logo || "/placeholder.png"}
                        alt=""
                        width={40}
                        height={40}
                        className="w-15 h-15 object-contain"
                      />
                      <span
                        className={`text-center text-sm leading-tight line-clamp-2${
                          homeIsLoser ? " line-through" : ""
                        }`}
                      >
                        {getLocalizedTeamName(match.home_team, locale)}
                      </span>
                    </div>
                  )}

                  <div className="relative flex items-center justify-center text-center min-h-20">
                    {/* Agg — anchored above the score */}
                    {firstLeg && hasScore && (
                      <span className="absolute bottom-[calc(50%+1.4rem)] left-1/2 -translate-x-1/2 whitespace-nowrap text-gray-200 text-[10px] font-mono tabular-nums font-medium shrink-0 rounded-lg border border-white/8 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] bg-custom-gray-2 px-2 py-1">
                        {tEv("aggLabel")}: {firstLeg.home + displayHome!}–{firstLeg.away + displayAway!}
                      </span>
                    )}

                    {/* Score — true vertical center */}
                    <div className="text-xl font-bold font-mono">
                      {isScheduled ? (
                        <span className="text-gray-300 text-sm font-medium font-sans">
                          {formatKickoff(match.fixture_date)}
                        </span>
                      ) : hasScore ? (
                        <>
                          {displayHome} – {displayAway}
                        </>
                      ) : (
                        <span className="text-gray-300 text-sm font-sans">–</span>
                      )}
                    </div>

                    {/* Status + pen — anchored below the score */}
                    <div className="absolute top-[calc(50%+1.4rem)] left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 whitespace-nowrap">
                      {!match.is_live && FINISHED_STATUSES.includes(match.status) ? (
                        <span className="text-gray-200 text-xs tracking-wider">
                          {tEv("matchFinished")}
                        </span>
                      ) : (
                        <StatusLabel match={match} />
                      )}
                      {showPenScore && (
                        <span className="text-gray-300/70 text-[10px] font-mono tabular-nums">
                          {tEv("penLabel")}: {penScore!.home}–{penScore!.away}
                        </span>
                      )}
                    </div>
                  </div>

                  {awayId ? (
                    <Link href={`/team/${awayId}`} className={awayClass}>
                      <div className={flagClass}>
                        <Image
                          src={match.away_logo || "/placeholder.png"}
                          alt=""
                          width={72}
                          height={48}
                          className={flagImgClass}
                        />
                      </div>
                      <span
                        className={`text-center text-sm leading-tight line-clamp-2${
                          awayIsLoser ? " line-through" : ""
                        }`}
                      >
                        {getLocalizedTeamName(match.away_team, locale)}
                      </span>
                    </Link>
                  ) : (
                    <div className={awayClass}>
                      <Image
                        src={match.away_logo || "/placeholder.png"}
                        alt=""
                        width={40}
                        height={40}
                        className="w-15 h-15 object-contain"
                      />
                      <span
                        className={`text-center text-sm leading-tight line-clamp-2${
                          awayIsLoser ? " line-through" : ""
                        }`}
                      >
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

      {/* Date · time | venue bar */}
      {(() => {
        const d = new Date(match.fixture_date);
        const datePart = d.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        });
        const timePart = d.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });
        const override = VENUE_OVERRIDES[match.id];
        const resolvedVenueName = venueName ?? override?.venueName ?? null;
        const resolvedVenueCity = venueCity ?? override?.venueCity ?? null;
        const venue = [resolvedVenueName, resolvedVenueCity]
          .filter(Boolean)
          .join(", ");
        return (
          <div className="px-2 py-4.5 flex items-center justify-center gap-2 text-[8px] lg:text-[12px] text-gray-300 flex-wrap">
            <img
              src="/images/specs/clock.svg"
              alt=""
              className="w-3 h-3 shrink-0 opacity-60"
            />
            <span>
              {datePart} · {timePart}
            </span>
            {venue && (
              <>
                <span className="text-white/80 font-light px-0.5">|</span>
                <img
                  src="/images/stadium.svg"
                  alt=""
                  className="w-3 h-3 shrink-0 opacity-60"
                />
                <span>{venue}</span>
              </>
            )}
          </div>
        );
      })()}
    </div>
  );
}
