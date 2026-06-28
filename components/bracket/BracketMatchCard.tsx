"use client";

import type { DbMatch, FixtureStatus } from "@/types/sports";
import { LIVE_STATUSES } from "@/types/sports";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { getLocalizedTeamName } from "@/lib/teamName";
import { useLiveMinute } from "@/hooks/useLiveMinute";
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
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function Flag({ src, isWc }: { src: string; isWc?: boolean }) {
  if (isFlag(src)) {
    return (
      <div
        className={`w-6 h-4 lg:w-10 lg:h-6 shrink-0 bg-cover bg-center bg-no-repeat bg-origin-border${
          isWc ? " border border-gray-300 rounded-tr-md rounded-bl-md" : ""
        }`}
        style={{ backgroundImage: `url(${resolveFlag(src)})` }}
      />
    );
  }
  return (
    <div
      className={`w-6 h-4 lg:w-10 lg:h-6 overflow-hidden shrink-0${
        isWc ? " border border-gray-300 rounded-tr-md rounded-bl-md" : ""
      }`}
    >
      <img
        src={src}
        alt=""
        className="w-full h-full object-cover scale-[1.15] will-change-transform"
      />
    </div>
  );
}

function FlagPlaceholder() {
  return (
    <div className="w-6 h-4 lg:w-10 lg:h-6 shrink-0 border border-gray-300/30 rounded-tr-md rounded-bl-md bg-custom-gray" />
  );
}

function LiveBadge({
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

  switch (status) {
    case "1H":
    case "2H":
    case "ET":
      return (
        <span className="text-white text-xs font-mono px-1.5 py-1.5 bg-[#00A800] rounded-md">
          {minute}′
        </span>
      );
    case "HT":
      return (
        <span className="text-white text-xs font-mono px-1.5 py-0.5 bg-gray-600 rounded-md">
          {tEv("halfTimeBadge")}
        </span>
      );
    default:
      return <span className="text-gray-200 text-xs">{status}</span>;
  }
}

export default function BracketMatchCard({ match }: { match: DbMatch }) {
  const tEv = useTranslations("matchEvents");
  const locale = useLocale();
  const isWc = match.league_id === 1 || match.league_id === 10;
  const kickoffPassed = new Date(match.fixture_date) < new Date();
  const isScheduled =
    (match.status === "NS" || match.status === "TBD") && !kickoffPassed;
  const isLive = LIVE_STATUSES.includes(match.status);
  const isConfirmedFinished =
    !match.is_live && FINISHED_STATUSES.includes(match.status);

  return (
    <Link
      href={`/match/${match.id}`}
      className="block hover:opacity-90 transition-opacity will-change-transform"
    >
      <div className="bg-custom-gray-2 py-2 lg:py-3 px-1 lg:px-3 grid grid-cols-[1fr_auto_1fr] gap-1 lg:gap-2 items-center border border-custom-gray/5 rounded-md">
        {/* Home: flag + name below */}
        <div className="flex flex-col items-center gap-1.5 min-w-0">
          {match.home_logo ? (
            <Flag src={match.home_logo} isWc={isWc} />
          ) : (
            <FlagPlaceholder />
          )}
          <span className="hidden md:block w-full text-center text-[8px] font-light text-gray-200 truncate">
            {getLocalizedTeamName(match.home_team, locale)}
          </span>
        </div>

        {/* Center: live badge + date/time when scheduled, score + FT when done */}
        <div className="flex flex-col items-center justify-center gap-0.5 px-1 lg:px-2 min-w-10 lg:min-w-14">
          {(isLive || match.status === "HT") && (
            <div className="mb-0.5">
              <LiveBadge
                status={match.status}
                elapsed={match.elapsed}
                fixtureDate={match.fixture_date}
              />
            </div>
          )}
          {isScheduled ? (
            <>
              <span className="text-gray-400 text-[8px] lg:text-[10px] whitespace-nowrap">
                {formatDate(match.fixture_date)}
              </span>
              <span className="text-gray-200 text-[8px] lg:text-[10px] font-medium tabular-nums whitespace-nowrap">
                {formatTime(match.fixture_date)}
              </span>
            </>
          ) : match.home_score !== null && match.away_score !== null ? (
            <>
              <div className="flex items-center gap-1.5 justify-center">
                <span className="text-xl font-extrabold tabular-nums">
                  {match.home_score}
                </span>
                <span className="text-gray-600 font-bold text-sm">–</span>
                <span className="text-xl font-extrabold tabular-nums">
                  {match.away_score}
                </span>
              </div>
              {isConfirmedFinished && (
                <span className="text-gray-200 text-[10px] uppercase tracking-wider">
                  {tEv("ftLabel")}
                </span>
              )}
            </>
          ) : (
            <span className="text-gray-300 text-sm font-medium">–</span>
          )}
        </div>

        {/* Away: flag + name below */}
        <div className="flex flex-col items-center gap-1.5 min-w-0">
          {match.away_logo ? (
            <Flag src={match.away_logo} isWc={isWc} />
          ) : (
            <FlagPlaceholder />
          )}
          <span className="hidden md:block w-full text-center text-[8px] font-light text-gray-200 truncate">
            {getLocalizedTeamName(match.away_team, locale)}
          </span>
        </div>
      </div>
    </Link>
  );
}
