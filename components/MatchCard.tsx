"use client";
import type { DbMatch, FixtureStatus } from "@/types/sports";
import { LIVE_STATUSES } from "@/types/sports";
import Link from "next/link";
import { useLiveMinute } from "@/hooks/useLiveMinute";

const FINISHED_STATUSES: FixtureStatus[] = ["FT", "AET", "PEN", "AWD", "WO"];

function formatKickoff(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
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
  const minute = useLiveMinute(status, elapsed, fixtureDate);

  if (status === "NS" || status === "TBD") return null;

  if (FINISHED_STATUSES.includes(status)) return null;

  switch (status) {
    case "1H":
    case "2H":
    case "ET":
      return (
        <span className="text-black text-md font-mono px-1 py-1 bg-[#00A800] rounded-xl">
          {minute}′
        </span>
      );
    case "HT":
      return (
        <span className="text-white text-md font-mono px-2 py-1 bg-gray-600 rounded-xl">
          HT
        </span>
      );
    default:
      return <span className="text-gray-400 text-xs px-2">{status}</span>;
  }
}

export default function MatchCard({ match }: { match: DbMatch }) {
  const kickoffPassed = new Date(match.fixture_date) < new Date();
  const isScheduled =
    (match.status === "NS" || match.status === "TBD") && !kickoffPassed;
  const isLive = LIVE_STATUSES.includes(match.status);
  const isHalfTime = match.status === "HT";
  const isConfirmedFinished =
    !match.is_live && FINISHED_STATUSES.includes(match.status);
  const isFinished =
    !isLive &&
    (FINISHED_STATUSES.includes(match.status) ||
      (kickoffPassed && match.home_score !== null));

  return (
    <Link
      href={`/match/${match.id}`}
      className="block hover:opacity-90 transition-opacity will-change-transform"
    >
      <div className="bg-custom-gray-2 py-5 px-1 grid grid-cols-12 gap-1 items-center border border-custom-gray-2/20">
        {/* Left: 2 cols for live minute, 1 empty col for scheduled, nothing for finished */}
        {!isFinished && (
          <div
            className={`${
              isLive ? "col-span-2" : "col-span-1"
            } flex justify-start`}
          >
            <StatusBadge
              status={match.status}
              elapsed={match.elapsed}
              fixtureDate={match.fixture_date}
            />
          </div>
        )}

        {/* Home team: col-span-4 for live/scheduled, col-span-5 for finished */}
        <div
          className={`${
            isFinished ? "col-span-5" : "col-span-4"
          } flex items-center justify-end gap-2 min-w-0 py-2`}
        >
          <span className="text-sm font-medium truncate text-right">
            {match.home_team}
          </span>
          {match.home_logo && (
            <img
              src={match.home_logo}
              alt=""
              className="w-8 h-8 object-contain shrink-0"
            />
          )}
        </div>

        {/* Center: col-span-3 for scheduled, col-span-2 for live/finished */}
        <div
          className={`${
            isScheduled ? "col-span-3" : "col-span-2"
          } flex flex-col items-center justify-center gap-0.5 px-2`}
        >
          {isScheduled ? (
            <span className="text-gray-300 text-sm font-medium tabular-nums">
              {formatKickoff(match.fixture_date)}
            </span>
          ) : match.home_score !== null && match.away_score !== null ? (
            <div className="flex items-center gap-2 justify-center">
              <span className="text-lg font-extrabold tabular-nums">
                {match.home_score}
              </span>
              <span className="text-gray-600 font-bold">–</span>
              <span className="text-lg font-extrabold tabular-nums">
                {match.away_score}
              </span>
            </div>
          ) : (
            <span className="text-gray-500 text-sm font-medium">–</span>
          )}
          {isHalfTime && (
            <span className="text-gray-400 text-[10px] uppercase tracking-wider">
              HT
            </span>
          )}
          {isConfirmedFinished && (
            <span className="text-gray-400 text-[10px] uppercase tracking-wider">
              FT
            </span>
          )}
        </div>

        {/* Away team: col-span-4 for live/scheduled, col-span-5 for finished */}
        <div
          className={`${
            isFinished ? "col-span-5" : "col-span-4"
          } flex items-center justify-start gap-3 min-w-0`}
        >
          {match.away_logo && (
            <img
              src={match.away_logo}
              alt=""
              className="w-8 h-8 object-contain shrink-0"
            />
          )}
          <span className="text-sm font-medium truncate text-left">
            {match.away_team}
          </span>
        </div>
      </div>
    </Link>
  );
}
