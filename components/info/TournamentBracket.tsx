"use client";

import React from "react";
import Link from "next/link";
import type { DbMatch, FixtureStatus } from "@/types/sports";

interface TournamentBracketProps {
  matches: DbMatch[];
}

const KNOCKOUT_STAGES = [
  { key: "R16", label: "Round of 16" },
  { key: "QF", label: "Quarter-Finals" },
  { key: "SF", label: "Semi-Finals" },
  { key: "FINAL", label: "Final" },
];

function StatusBadge({
  status,
  elapsed,
}: {
  status: FixtureStatus;
  elapsed: number | null;
}) {
  switch (status) {
    case "1H":
    case "2H":
    case "ET":
      return (
        <span className="flex items-center gap-1 text-gray-200 text-sm font-medium">
          <span className="w-1.5 h-1.5 rounded-full" />
          {elapsed ?? ""}′
        </span>
      );
    case "HT":
      return <span className="text-yellow-400 text-sm font-medium">HT</span>;
    case "FT":
    case "AET":
    case "PEN":
      return <span className="text-gray-300 text-sm">FT</span>;
    case "PST":
      return <span className="text-orange-400 text-sm">Postponed</span>;
    case "CANC":
    default:
      return <span className="text-gray-200 text-sm">{status}</span>;
  }
}

function formatKickoff(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TournamentBracket({ matches }: TournamentBracketProps) {
  return (
    <div className="w-full min-w-0">
      <div className="space-y-12">
        {KNOCKOUT_STAGES.map((stage) => {
          const stageMatches = matches.filter((m) => {
            const roundStr = m.round?.toLowerCase() || "";
            if (stage.key === "R16")
              return m.round === "R16" || roundStr.includes("16");
            if (stage.key === "QF")
              return m.round === "QF" || roundStr.includes("quarter");
            if (stage.key === "SF")
              return m.round === "SF" || roundStr.includes("semi");
            if (stage.key === "FINAL") {
              return (
                m.round === "FINAL" ||
                (roundStr.includes("final") &&
                  !roundStr.includes("semi") &&
                  !roundStr.includes("quarter"))
              );
            }
            return false;
          });

          if (stageMatches.length === 0) return null;

          // Group individual leg fixtures into unified "Ties"
          const tiesMap: Record<string, DbMatch[]> = {};
          stageMatches.forEach((match) => {
            const tieKey = [match.home_team, match.away_team]
              .sort()
              .join(" vs ");
            if (!tiesMap[tieKey]) tiesMap[tieKey] = [];
            tiesMap[tieKey].push(match);
          });

          return (
            <div key={stage.key} className="w-full space-y-4">
              {/* Stage Title Header */}
              <div className="flex items-center gap-3 border-b border-custom-gray pb-3">
                <h3 className="text-sm font-extrabold tracking-widest text-white">
                  {stage.label}
                </h3>
              </div>

              {/* Layout Stack Grid */}
              <div className="space-y-6">
                {Object.entries(tiesMap).map(([tieName, legs]) => {
                  const sortedLegs = legs.sort(
                    (a, b) =>
                      new Date(a.fixture_date).getTime() -
                      new Date(b.fixture_date).getTime()
                  );

                  const leg1 = sortedLegs[0];
                  const leg2 = sortedLegs[1];

                  // Calculate Aggregate Scores dynamically
                  const teamA = leg1.home_team;
                  const teamB = leg1.away_team;
                  let aggScoreA = leg1.home_score ?? 0;
                  let aggScoreB = leg1.away_score ?? 0;

                  if (leg2) {
                    aggScoreA +=
                      leg2.home_team === teamA
                        ? leg2.home_score ?? 0
                        : leg2.away_score ?? 0;
                    aggScoreB +=
                      leg2.home_team === teamB
                        ? leg2.home_score ?? 0
                        : leg2.away_score ?? 0;
                  }

                  const hasPlayed = leg1.home_score !== null;

                  return (
                    <div
                      key={tieName}
                      className="bg-custom-gray border border-custom-gray rounded-xl overflow-hidden p-0"
                    >
                      {/* Global Aggregate Header Ribbon */}
                      <div className="flex items-center justify-end px-4 py-2 text-xs text-gray-200 tracking-wider">
                        {hasPlayed && (
                          <span className="text-gray-200 font-bold text-md px-2 py-0.5">
                            {leg2
                              ? `AGG: ${aggScoreA} – ${aggScoreB}`
                              : "Final"}
                          </span>
                        )}
                      </div>

                      {/* Leg Rows rendered side-by-side using the 12-Column Grid system */}
                      <div className="space-y-1">
                        {sortedLegs.map((leg, index) => {
                          const isScheduled =
                            leg.status === "NS" || leg.status === "TBD";

                          return (
                            <Link
                              href={`/match/${leg.id}`}
                              key={leg.id}
                              className="block bg-custom-gray-2  transition-colors border border-transparent hover:bg-custom-gray/30 rounded-xl overflow-hidden"
                            >
                              <div className="grid grid-cols-12 gap-2 items-center p-4">
                                {/* Column 1: Status & Info */}
                                <div className="col-span-1 flex flex-col min-w-0">
                                  <StatusBadge
                                    status={leg.status as FixtureStatus}
                                    elapsed={leg.elapsed}
                                  />
                                </div>

                                {/* Column 2: Home Team */}
                                <div className="col-span-4 flex items-center justify-end gap-3 min-w-0 border-l border-custom-gray py-2">
                                  <span className="text-sm font-medium truncate text-gray-200">
                                    {leg.home_team}
                                  </span>
                                  {leg.home_logo && (
                                    <img
                                      src={leg.home_logo}
                                      alt=""
                                      className="w-10 h-10 object-contain shrink-0"
                                    />
                                  )}
                                </div>

                                {/* Column 3: Center Score / Time */}
                                <div className="col-span-2 flex flex-col items-center justify-center px-2">
                                  {isScheduled ? (
                                    <span className="text-gray-200 text-sm font-medium">
                                      {formatKickoff(leg.fixture_date)}
                                    </span>
                                  ) : (
                                    <div className="flex items-center gap-1.5 justify-center">
                                      <span className="text-xl font-extrabold tabular-nums text-white">
                                        {leg.home_score ?? 0}
                                      </span>
                                      <span className="text-gray-600 text-md font-bold">
                                        –
                                      </span>
                                      <span className="text-xl font-extrabold tabular-nums text-white">
                                        {leg.away_score ?? 0}
                                      </span>
                                    </div>
                                  )}
                                </div>

                                {/* Column 4: Away Team */}
                                <div className="col-span-5 flex items-center justify-start gap-3 min-w-0">
                                  {leg.away_logo && (
                                    <img
                                      src={leg.away_logo}
                                      alt=""
                                      className="w-10 h-10 object-contain shrink-0"
                                    />
                                  )}
                                  <span className="text-sm font-medium truncate text-gray-200">
                                    {leg.away_team}
                                  </span>
                                </div>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
