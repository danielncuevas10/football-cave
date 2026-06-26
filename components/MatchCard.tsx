"use client";
import type { DbMatch, FixtureStatus } from "@/types/sports";
import { LIVE_STATUSES } from "@/types/sports";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { getLocalizedTeamName } from "@/lib/teamName";
import { useLiveMinute } from "@/hooks/useLiveMinute";
import { resolveFlag } from "@/lib/flagUrl";

function isFlag(logo: string | null): boolean {
  return !!logo && logo.includes("/flags/");
}

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
  const tEv = useTranslations("matchEvents");
  const minute = useLiveMinute(status, elapsed, fixtureDate);

  if (status === "NS" || status === "TBD") return null;
  if (FINISHED_STATUSES.includes(status)) return null;

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

export default function MatchCard({ match }: { match: DbMatch }) {
  const tEv = useTranslations("matchEvents");
  const locale = useLocale();
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
      {/* Fixed 4-column layout: [badge][home][score][away]
          The badge column is always reserved so nothing shifts when live */}
      <div className="bg-custom-gray-2 py-5 px-3 grid grid-cols-[1rem_1fr_auto_1fr] gap-2 items-center border border-custom-gray/5">
        {/* Left badge — always occupies 2rem; empty when not live */}
        <div className="flex items-center justify-center">
          {(isLive || match.status === "HT") && (
            <StatusBadge
              status={match.status}
              elapsed={match.elapsed}
              fixtureDate={match.fixture_date}
            />
          )}
        </div>

        {/* Home team */}
        <div className="flex items-center justify-end gap-2 min-w-0">
          <span className="text-sm font-medium text-right leading-tight line-clamp-2">
            {getLocalizedTeamName(match.home_team, locale)}
          </span>
          {match.home_logo &&
            (isFlag(match.home_logo) ? (
              <div
                className={`w-10 h-6 shrink-0 bg-cover bg-center bg-no-repeat bg-origin-border ${
                  match.league_id === 1 || match.league_id === 10
                    ? "border border-gray-300 rounded-tr-md rounded-bl-md"
                    : ""
                }`}
                style={{
                  backgroundImage: `url(${resolveFlag(match.home_logo)})`,
                }}
              />
            ) : (
              <div
                className={`w-10 h-6 overflow-hidden shrink-0 ${
                  match.league_id === 1 || match.league_id === 10
                    ? "border border-gray-300 rounded-tr-md rounded-bl-md"
                    : ""
                }`}
              >
                <img
                  src={match.home_logo}
                  alt=""
                  className="w-full h-full object-cover scale-[1.15] will-change-transform"
                />
              </div>
            ))}
        </div>

        {/* Center: score / kickoff / dash */}
        <div className="flex flex-col items-center justify-center gap-0.5 px-2 min-w-14">
          {isScheduled ? (
            <span className="text-gray-400 text-xs font-medium tabular-nums whitespace-nowrap py-3">
              {formatKickoff(match.fixture_date)}
            </span>
          ) : match.home_score !== null && match.away_score !== null ? (
            <div className="flex items-center gap-1.5 justify-center">
              <span className="text-xl font-extrabold tabular-nums">
                {match.home_score}
              </span>
              <span className="text-gray-600 font-bold text-sm">–</span>
              <span className="text-xl font-extrabold tabular-nums">
                {match.away_score}
              </span>
            </div>
          ) : (
            <span className="text-gray-300 text-sm font-medium">–</span>
          )}
          {isConfirmedFinished && (
            <span className="text-gray-200 text-[10px] uppercase tracking-wider">
              {tEv("ftLabel")}
            </span>
          )}
        </div>

        {/* Away team */}
        <div className="flex items-center justify-start gap-2 min-w-0">
          {match.away_logo &&
            (isFlag(match.away_logo) ? (
              <div
                className={`w-10 h-6 shrink-0 bg-cover bg-center bg-no-repeat bg-origin-border ${
                  match.league_id === 1 || match.league_id === 10
                    ? "border border-gray-300 rounded-tr-md rounded-bl-md"
                    : ""
                }`}
                style={{
                  backgroundImage: `url(${resolveFlag(match.away_logo)})`,
                }}
              />
            ) : (
              <div
                className={`w-10 h-6 overflow-hidden shrink-0 ${
                  match.league_id === 1 || match.league_id === 10
                    ? "border border-gray-300 rounded-tr-md rounded-bl-md"
                    : ""
                }`}
              >
                <img
                  src={match.away_logo}
                  alt=""
                  className="w-full h-full object-cover scale-[1.15] will-change-transform"
                />
              </div>
            ))}
          <span className="text-sm font-medium text-left leading-tight line-clamp-2">
            {getLocalizedTeamName(match.away_team, locale)}
          </span>
        </div>
      </div>
    </Link>
  );
}
