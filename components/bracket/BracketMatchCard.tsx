"use client";

import type { DbMatch, FixtureStatus } from "@/types/sports";
import { LIVE_STATUSES } from "@/types/sports";
import Link from "next/link";
import Image from "next/image";
import { useTranslations, useLocale } from "next-intl";
import { getLocalizedTeamName } from "@/lib/teamName";
import { useLiveMinute, formatMinute } from "@/hooks/useLiveMinute";
import { resolveFlag } from "@/lib/flagUrl";

const FINISHED_STATUSES: FixtureStatus[] = ["FT", "AET", "PEN", "AWD", "WO"];

function isFlag(logo: string | null): boolean {
  return !!logo && logo.includes("/flags/");
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function Flag({ src, isWc }: { src: string; isWc?: boolean }) {
  if (isFlag(src)) {
    return (
      <div
        className={`w-6 h-4 lg:w-10 lg:h-6 shrink-0 bg-cover bg-center bg-no-repeat bg-origin-border${
          isWc ? " border border-gray-300 rounded-tr-lg rounded-bl-lg" : ""
        }`}
        style={{ backgroundImage: `url(${resolveFlag(src)})` }}
      />
    );
  }
  return (
    <div
      className={`w-6 h-4 lg:w-10 lg:h-6 overflow-hidden shrink-0${
        isWc ? " border border-gray-300 rounded-tr-lg rounded-bl-lg" : ""
      }`}
    >
      <Image
        src={src}
        alt=""
        width={64}
        height={40}
        className="w-full h-full object-cover scale-[1.15] will-change-transform"
      />
    </div>
  );
}

function FlagPlaceholder() {
  return (
    <div className="w-6 h-4 lg:w-10 lg:h-6 shrink-0 border border-gray-300/30 rounded-tr-lg rounded-bl-lg bg-custom-gray" />
  );
}

function LiveBadge({ match }: { match: DbMatch }) {
  const tEv = useTranslations("matchEvents");
  const minute = useLiveMinute(match);
  const { status } = match;

  switch (status) {
    case "1H":
    case "2H":
    case "ET":
      return (
        <span className="text-white text-[6px] font-mono px-1.5 py-1.5 bg-accent rounded-2xl">
          {formatMinute(minute, status)}′
        </span>
      );
    case "HT":
      return (
        <span className="text-white text-xs font-mono px-1.5 py-0.5 bg-gray-600 rounded-xl">
          {tEv("halfTimeBadge")}
        </span>
      );
    default:
      return <span className="text-gray-200 text-xs">{status}</span>;
  }
}

export default function BracketMatchCard({
  match,
  isFinal = false,
}: {
  match: DbMatch;
  isFinal?: boolean;
}) {
  const tEv = useTranslations("matchEvents");
  const locale = useLocale();
  const isWc = match.league_id === 1 || match.league_id === 10;
  const kickoffPassed = new Date(match.fixture_date) < new Date();
  const isScheduled =
    (match.status === "NS" || match.status === "TBD") && !kickoffPassed;
  const isLive = LIVE_STATUSES.includes(match.status);
  const isConfirmedFinished =
    !match.is_live && FINISHED_STATUSES.includes(match.status);

  const hasPenWinner =
    match.status === "PEN" &&
    match.penalty_home != null &&
    match.penalty_away != null &&
    match.penalty_home !== match.penalty_away;

  const showPenScore =
    match.status === "PEN" &&
    match.penalty_home != null &&
    match.penalty_away != null;

  const canDetermineWinner =
    isConfirmedFinished &&
    match.home_score !== null &&
    match.away_score !== null &&
    (match.home_score !== match.away_score || hasPenWinner);

  const homeIsLoser =
    canDetermineWinner &&
    (match.home_score! < match.away_score! ||
      (hasPenWinner && match.penalty_home! < match.penalty_away!));
  const awayIsLoser =
    canDetermineWinner &&
    (match.away_score! < match.home_score! ||
      (hasPenWinner && match.penalty_away! < match.penalty_home!));

  return (
    <Link
      href={`/match/${match.id}`}
      className="block hover:opacity-90 transition-opacity will-change-transform"
    >
      <div
        className={`${
          isFinal ? "bg-[#C5A059]/50" : "bg-custom-gray-2"
        } h-14 lg:h-20 px-1 lg:px-3 grid grid-cols-[1fr_auto_1fr] gap-1 lg:gap-2 items-center border border-custom-gray/5 rounded-xl`}
      >
        {/* Home: flag + name below */}
        <div
          className={`flex flex-col items-center gap-1.5 min-w-0 transition-opacity${
            homeIsLoser ? " opacity-50" : ""
          }`}
        >
          {match.home_logo ? (
            <Flag src={match.home_logo} isWc={isWc} />
          ) : (
            <FlagPlaceholder />
          )}
          <span
            className={`hidden md:block w-full text-center text-[8px] truncate${
              isFinal ? " font-bold text-white" : " font-light text-gray-200"
            }${homeIsLoser ? " line-through" : ""}`}
          >
            {getLocalizedTeamName(match.home_team, locale)}
          </span>
        </div>

        {/* Center: live badge + date/time when scheduled, score + FT when done */}
        <div className="flex flex-col items-center justify-center gap-0.5 px-1 lg:px-2 min-w-10 lg:min-w-14">
          {(isLive || match.status === "HT") && (
            <div className="mb-0.5">
              <LiveBadge match={match} />
            </div>
          )}
          {isScheduled ? (
            <>
              <span
                className={`text-[8px] lg:text-[10px] whitespace-nowrap${
                  isFinal ? " text-white font-bold" : " text-gray-400"
                }`}
              >
                {formatDate(match.fixture_date)}
              </span>
              <span
                className={`text-[8px] lg:text-[10px] tabular-nums whitespace-nowrap${
                  isFinal
                    ? " text-white font-bold"
                    : " text-gray-200 font-medium"
                }`}
              >
                {formatTime(match.fixture_date)}
              </span>
            </>
          ) : match.home_score !== null && match.away_score !== null ? (
            <>
              <div className="flex items-center gap-1 justify-center">
                <span
                  className={`text-xs font-bold tabular-nums${
                    isFinal ? " text-white" : ""
                  }`}
                >
                  {match.home_score}
                </span>
                <span className="text-gray-600 font-bold text-sm">–</span>
                <span
                  className={`text-xs font-bold tabular-nums${
                    isFinal ? " text-white" : ""
                  }`}
                >
                  {match.away_score}
                </span>
              </div>
              {isConfirmedFinished && (
                <span
                  className={`text-[6px] lg:text-[8px] uppercase tracking-wider${
                    isFinal ? " text-white font-bold" : " text-gray-200"
                  }`}
                >
                  {tEv("ftLabel")}
                </span>
              )}
              {showPenScore && (
                <span
                  className={`text-[6px] lg:text-[8px] font-mono tabular-nums${
                    isFinal ? " text-white" : " text-gray-300"
                  }`}
                >
                  {tEv("penLabel")}: {match.penalty_home}–{match.penalty_away}
                </span>
              )}
            </>
          ) : (
            <span
              className={`text-sm font-medium${
                isFinal ? " text-white" : " text-gray-300"
              }`}
            >
              –
            </span>
          )}
        </div>

        {/* Away: flag + name below */}
        <div
          className={`flex flex-col items-center gap-1.5 min-w-0 transition-opacity${
            awayIsLoser ? " opacity-50" : ""
          }`}
        >
          {match.away_logo ? (
            <Flag src={match.away_logo} isWc={isWc} />
          ) : (
            <FlagPlaceholder />
          )}
          <span
            className={`hidden md:block w-full text-center text-[8px] truncate${
              isFinal ? " font-bold text-white" : " font-light text-gray-200"
            }${awayIsLoser ? " line-through" : ""}`}
          >
            {getLocalizedTeamName(match.away_team, locale)}
          </span>
        </div>
      </div>
    </Link>
  );
}
