"use client";
import type { DbMatch, FixtureStatus } from "@/types/sports";
import Image from "next/image";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { useState, useEffect } from "react";
import { getLocalizedTeamName } from "@/lib/teamName";
import { useLiveMinute, formatMinute } from "@/hooks/useLiveMinute";
import { resolveFlag } from "@/lib/flagUrl";
import { supabase } from "@/lib/supabase";
import { TWO_LEGGED_LEAGUES } from "@/lib/twoLeggedMatch";

function isFlag(logo: string | null): boolean {
  return !!logo && logo.includes("/flags/");
}

function isNationalTeamMatch(leagueId: number): boolean {
  const NATIONAL_TEAM_LEAGUES = [1, 4, 5, 6, 9, 10, 17, 25, 29, 30, 32, 34];
  return NATIONAL_TEAM_LEAGUES.includes(leagueId);
}

const FINISHED_STATUSES: FixtureStatus[] = ["FT", "AET", "PEN", "AWD", "WO"];

function formatKickoff(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

const circleBase =
  "flex items-center justify-center w-8 h-8 rounded-full font-extrabold font-mono text-[10px] shrink-0";

function StatusBadge({ match }: { match: DbMatch }) {
  const minute = useLiveMinute(match);

  if (match.status === "NS" || match.status === "TBD") return null;

  if (FINISHED_STATUSES.includes(match.status)) {
    return <div className={`${circleBase} bg-gray-600 text-white`}>FT</div>;
  }

  switch (match.status) {
    case "1H":
    case "2H":
    case "ET":
      return (
        <div className={`${circleBase} bg-accent text-white`}>
          <span className="animate-pulse">
            {formatMinute(minute, match.status)}
          </span>
        </div>
      );
    case "HT":
      return <div className={`${circleBase} bg-gray-600 text-white`}>HT</div>;
    default:
      return null;
  }
}

export default function MatchCard({
  match,
  viewingTeamLogo,
}: {
  match: DbMatch;
  viewingTeamLogo?: string;
}) {
  const tEv = useTranslations("matchEvents");
  const locale = useLocale();

  const isLive = match.is_live === true;
  const [firstLegScore, setFirstLegScore] = useState<{
    home: number;
    away: number;
  } | null>(null);

  useEffect(() => {
    const isFinished = !match.is_live && FINISHED_STATUSES.includes(match.status);
    if (isFinished || !match.round || !TWO_LEGGED_LEAGUES.has(match.league_id))
      return;
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
          // Swap perspective: 2nd-leg home team was the away team in leg 1
          setFirstLegScore({ home: data.away_score, away: data.home_score });
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.id]);

  const kickoffPassed = new Date(match.fixture_date) < new Date();
  const isScheduled =
    (match.status === "NS" || match.status === "TBD") && !kickoffPassed;
  const isConfirmedFinished =
    !match.is_live && FINISHED_STATUSES.includes(match.status);

  const hasScore =
    isConfirmedFinished &&
    match.home_score !== null &&
    match.away_score !== null;
  const homeWon = hasScore && match.home_score! > match.away_score!;
  const awayWon = hasScore && match.away_score! > match.home_score!;
  const isDraw = hasScore && match.home_score === match.away_score;
  const homeDim = awayWon || isDraw;
  const awayDim = homeWon || isDraw;

  const isWcKnockout =
    (match.league_id === 1 || match.league_id === 10) &&
    match.stage !== null &&
    match.stage !== "GROUP" &&
    match.stage !== "UNKNOWN";

  // Use != null (loose) to handle undefined when DB columns don't exist yet
  const hasPenWinner =
    match.penalty_home != null &&
    match.penalty_away != null &&
    match.penalty_home !== match.penalty_away;

  const homeIsLoser =
    isWcKnockout &&
    hasScore &&
    (match.home_score! < match.away_score! ||
      (hasPenWinner && match.penalty_home! < match.penalty_away!));
  const awayIsLoser =
    isWcKnockout &&
    hasScore &&
    (match.away_score! < match.home_score! ||
      (hasPenWinner && match.penalty_away! < match.penalty_home!));

  const showPenScore = match.penalty_home != null && match.penalty_away != null;

  return (
    <Link
      href={`/match/${match.id}`}
      className="block hover:opacity-90 transition-opacity will-change-transform"
    >
      <div
        className={`bg-custom-gray-2 h-16 px-3 grid gap-2 items-center ${
          viewingTeamLogo && isConfirmedFinished
            ? "grid-cols-[1fr_auto_1fr]"
            : "grid-cols-[2rem_1fr_auto_1fr_2rem]"
        }`}
      >
        {/* Left badge — skipped in centered result mode */}
        {!(viewingTeamLogo && isConfirmedFinished) && (
          <div className="flex items-center justify-center">
            <StatusBadge match={match} />
          </div>
        )}

        {/* Home team */}
        <div
          className={`flex items-center justify-end gap-2 min-w-0 transition-opacity ${
            !isWcKnockout && homeDim ? "opacity-70" : ""
          }`}
        >
          <span
            className={`text-xs lg:text-md font-medium text-right leading-tight line-clamp-2${
              homeIsLoser ? " line-through opacity-50" : ""
            }`}
          >
            {getLocalizedTeamName(match.home_team, locale)}
          </span>
          {match.home_logo &&
            (isFlag(match.home_logo) ? (
              <div
                className={`w-9 h-5 shrink-0 bg-cover bg-center bg-no-repeat bg-origin-border ${
                  match.league_id === 1 || match.league_id === 10
                    ? "border border-gray-300 rounded-tr-lg rounded-bl-lg"
                    : ""
                }`}
                style={{
                  backgroundImage: `url(${resolveFlag(match.home_logo)})`,
                }}
              />
            ) : isNationalTeamMatch(match.league_id) ? (
              <div className="w-9 h-5 overflow-hidden shrink-0 border border-gray-300 rounded-tr-lg rounded-bl-lg">
                <Image
                  src={match.home_logo}
                  alt=""
                  width={72}
                  height={40}
                  className="w-full h-full object-cover scale-[1.15] will-change-transform"
                />
              </div>
            ) : (
              <Image
                src={match.home_logo}
                alt=""
                width={48}
                height={48}
                className="w-6 h-6 object-contain rounded-sm"
              />
            ))}
        </div>

        {/* Center: score / kickoff / dash */}
        <div className="relative flex items-center justify-center px-2 min-w-14">
          {isScheduled ? (
            <div className="flex flex-col items-center gap-0 justify-center">
              {firstLegScore && (
                <span className="invisible text-[9px] font-mono" aria-hidden="true">·</span>
              )}
              <span className="text-gray-400 text-xs font-medium tabular-nums whitespace-nowrap">
                {match.status === "TBD"
                  ? "TBA"
                  : formatKickoff(match.fixture_date)}
              </span>
              {firstLegScore && (
                <span className="text-[9px] text-gray-400 font-mono tabular-nums whitespace-nowrap mt-0.5">
                  ({firstLegScore.home}–{firstLegScore.away})
                </span>
              )}
            </div>
          ) : viewingTeamLogo && hasScore ? (
            (() => {
              const isHome = match.home_logo === viewingTeamLogo;
              const teamScore = isHome ? match.home_score! : match.away_score!;
              const oppScore = isHome ? match.away_score! : match.home_score!;
              const bg =
                teamScore > oppScore
                  ? "rgb(52, 199, 89)"
                  : teamScore < oppScore
                  ? "rgb(201, 52, 52)"
                  : "rgb(107, 114, 128)";
              return (
                <span
                  className="font-mono text-[11px] text-white tabular-nums shrink-0 rounded-lg border border-white/8 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] px-2 py-0.5"
                  style={{ backgroundColor: bg }}
                >
                  {teamScore}–{oppScore}
                </span>
              );
            })()
          ) : match.home_score !== null && match.away_score !== null ? (
            <div className="flex flex-col items-center gap-0 justify-center">
              {isLive && firstLegScore && (
                <span className="invisible text-[9px] font-mono" aria-hidden="true">·</span>
              )}
              <div className="flex items-center gap-1.5 justify-center">
                <span className="text-lg font-bold tabular-nums">
                  {match.home_score}
                </span>
                <span className="text-gray-400 font-bold text-sm">–</span>
                <span className="text-lg font-bold tabular-nums">
                  {match.away_score}
                </span>
              </div>
              {isLive && firstLegScore && (
                <span className="text-[9px] text-gray-400 font-mono tabular-nums whitespace-nowrap mt-0.5">
                  ({firstLegScore.home + match.home_score!}–{firstLegScore.away + match.away_score!})
                </span>
              )}
            </div>
          ) : (
            <span className="text-gray-300 text-sm font-medium">–</span>
          )}
          {(showPenScore || (isWcKnockout && isConfirmedFinished)) && (
            <span
              className={`absolute top-full left-1/2 -translate-x-1/2 mt-0.5 text-[9px] font-mono tabular-nums whitespace-nowrap${
                showPenScore ? " text-gray-300" : " invisible"
              }`}
            >
              {tEv("penLabel")} {match.penalty_home ?? 0}–
              {match.penalty_away ?? 0}
            </span>
          )}
        </div>

        {/* Away team */}
        <div
          className={`flex items-center justify-start gap-2 min-w-0 transition-opacity ${
            !isWcKnockout && awayDim ? "opacity-70" : ""
          }`}
        >
          {match.away_logo &&
            (isFlag(match.away_logo) ? (
              <div
                className={`w-9 h-5 shrink-0 bg-cover bg-center bg-no-repeat bg-origin-border ${
                  match.league_id === 1 || match.league_id === 10
                    ? "border border-gray-300 rounded-tr-lg rounded-bl-lg"
                    : ""
                }`}
                style={{
                  backgroundImage: `url(${resolveFlag(match.away_logo)})`,
                }}
              />
            ) : isNationalTeamMatch(match.league_id) ? (
              <div className="w-9 h-5 overflow-hidden shrink-0 border border-gray-300 rounded-tr-lg rounded-bl-lg">
                <Image
                  src={match.away_logo}
                  alt=""
                  width={72}
                  height={40}
                  className="w-full h-full object-cover scale-[1.15] will-change-transform"
                />
              </div>
            ) : (
              <Image
                src={match.away_logo}
                alt=""
                width={48}
                height={48}
                className="w-6 h-6 object-contain rounded-sm"
              />
            ))}
          <span
            className={`text-xs lg:text-md font-medium text-left leading-tight line-clamp-2${
              awayIsLoser ? " line-through opacity-50" : ""
            }`}
          >
            {getLocalizedTeamName(match.away_team, locale)}
          </span>
        </div>

        {/* Right spacer — mirrors the left status badge column to keep score centered */}
        {!(viewingTeamLogo && isConfirmedFinished) && <div />}
      </div>
    </Link>
  );
}
