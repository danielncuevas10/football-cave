"use client";
import type { DbMatch, FixtureStatus } from "@/types/sports";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { getLocalizedTeamName } from "@/lib/teamName";
import { useLiveMinute } from "@/hooks/useLiveMinute";
import { resolveFlag } from "@/lib/flagUrl";

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

function StatusBadge({
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

  if (status === "NS" || status === "TBD") return null;

  const circleBase = "flex items-center justify-center w-8 h-8 rounded-full font-extrabold font-mono text-[10px] shrink-0";

  if (FINISHED_STATUSES.includes(status)) {
    const label =
      status === "FT"
        ? tEv("ftLabel")
        : status === "PEN"
        ? tEv("penLabel")
        : status;
    return (
      <div className={`${circleBase} bg-gray-600 text-white`}>
        {label}
      </div>
    );
  }

  switch (status) {
    case "1H":
    case "2H":
    case "ET":
      return (
        <div className={`${circleBase} bg-accent text-white`}>
          <span className="animate-pulse">{minute}</span>
        </div>
      );
    case "HT":
      return (
        <div className={`${circleBase} bg-gray-600 text-white`}>
          {tEv("halfTimeBadge")}
        </div>
      );
    default:
      return (
        <div className={`${circleBase} bg-gray-700 text-gray-200`}>
          {status}
        </div>
      );
  }
}

export default function MatchCard({ match }: { match: DbMatch }) {
  const tEv = useTranslations("matchEvents");
  const locale = useLocale();
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
      {/* Fixed 4-column layout: [badge][home][score][away]
          The badge column is always reserved so nothing shifts when live */}
      <div className="bg-custom-gray-2 h-16 px-3 grid grid-cols-[2rem_1fr_auto_1fr] gap-2 items-center">
        {/* Left badge — always occupies 2rem; empty when not live */}
        <div className="flex items-center justify-center">
          <StatusBadge
            status={match.status}
            elapsed={match.elapsed}
            fixtureDate={match.fixture_date}
          />
        </div>

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
                <img
                  src={match.home_logo}
                  alt=""
                  className="w-full h-full object-cover scale-[1.15] will-change-transform"
                />
              </div>
            ) : (
              <img
                src={match.home_logo}
                alt=""
                className="w-6 h-6 object-contain rounded-sm"
              />
            ))}
        </div>

        {/* Center: score / kickoff / dash */}
        <div className="relative flex items-center justify-center px-2 min-w-14">
          {isScheduled ? (
            <span className="text-gray-400 text-xs font-medium tabular-nums whitespace-nowrap">
              {formatKickoff(match.fixture_date)}
            </span>
          ) : match.home_score !== null && match.away_score !== null ? (
            <div className="flex items-center gap-1.5 justify-center">
              <span className="text-lg font-bold tabular-nums">
                {match.home_score}
              </span>
              <span className="text-gray-400 font-bold text-sm">–</span>
              <span className="text-lg font-bold tabular-nums">
                {match.away_score}
              </span>
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
                <img
                  src={match.away_logo}
                  alt=""
                  className="w-full h-full object-cover scale-[1.15] will-change-transform"
                />
              </div>
            ) : (
              <img
                src={match.away_logo}
                alt=""
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
      </div>
    </Link>
  );
}
