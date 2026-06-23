"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { DbStanding } from "@/types/sports";
import { getLocalizedTeamName } from "@/lib/teamName";

interface WorldCupGroupsProps {
  standings: DbStanding[];
  allStandings?: DbStanding[];
}

const PAGE_SIZE = 4;

export default function WorldCupGroups({
  standings,
  allStandings,
}: WorldCupGroupsProps) {
  const t = useTranslations("matchTabs");
  const locale = useLocale();
  const [page, setPage] = useState(0);

  const pool = allStandings ?? standings;
  const top8ThirdIds = new Set(
    pool
      .filter((s) => s.rank === 3)
      .sort((a, b) => {
        const ptsDiff = b.points - a.points;
        if (ptsDiff !== 0) return ptsDiff;
        const gdDiff =
          b.goals_for - b.goals_against - (a.goals_for - a.goals_against);
        if (gdDiff !== 0) return gdDiff;
        return b.goals_for - a.goals_for;
      })
      .slice(0, 8)
      .map((s) => s.team_id)
  );

  const grouped = standings.reduce<Record<string, DbStanding[]>>((acc, row) => {
    const key = row.group_name || "Unknown";
    if (!acc[key]) acc[key] = [];
    acc[key].push(row);
    return acc;
  }, {});

  const sortedGroups = Object.keys(grouped).sort((a, b) => a.localeCompare(b));
  const totalPages = Math.ceil(sortedGroups.length / PAGE_SIZE);
  const safePage = Math.min(page, totalPages - 1);
  const desktopGroups = sortedGroups.slice(
    safePage * PAGE_SIZE,
    (safePage + 1) * PAGE_SIZE
  );

  const renderGroup = (groupName: string) => {
    const teams = grouped[groupName].sort((a, b) => a.rank - b.rank);
    const letter = groupName.replace(/^Group\s*/i, "").trim() || groupName;

    return (
      <div
        key={groupName}
        className="bg-custom-gray rounded-md overflow-hidden"
      >
        <table className="w-full text-xs text-gray-200 bg-custom-gray-2">
          <thead>
            <tr className="text-[10px] tracking-wider bg-custom-gray">
              <th className="px-3 py-2 text-center w-7 text-gray-300">#</th>
              <th className="px-2 py-5 text-left text-white font-light tracking-widest">
                {t("group")} {letter}
              </th>
              <th className="px-2 py-2 text-center w-8" title="Goal Difference">
                GD
              </th>
              <th className="px-2 py-2 text-center w-8" title="Matches Played">
                MP
              </th>
              <th className="px-3 py-2 text-center w-8 text-white font-black">
                Pts
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/30">
            {teams.map((team) => {
              const advances = team.rank <= 2;
              const advancesAsThird =
                team.rank === 3 && top8ThirdIds.has(team.team_id);
              return (
                <tr
                  key={team.team_id}
                  className={`hover:bg-gray-800/20 transition-colors ${
                    advances
                      ? "[&>td:first-child]:border-l-2 [&>td:first-child]:border-[#4ade80]"
                      : advancesAsThird
                      ? "[&>td:first-child]:border-l-2 [&>td:first-child]:border-[#FFC000]"
                      : "[&>td:first-child]:border-l-2 [&>td:first-child]:border-[#C93434]"
                  }`}
                >
                  <td className="px-2 py-2.5 text-center font-bold text-gray-300">
                    {team.rank}
                  </td>
                  <td className="px-1 py-2.5">
                    <Link
                      href={`/team/${team.team_id}`}
                      className="flex items-center gap-2 hover:opacity-75 transition-opacity"
                    >
                      {team.team_logo && (
                        <div className="w-8 h-4 overflow-hidden shrink-0 block relative border border-gray-300 rounded-tr-md rounded-bl-md">
                          <img
                            src={team.team_logo}
                            alt=""
                            className="w-full h-full object-cover scale-[1.15] will-change-transform"
                          />
                        </div>
                      )}
                      <span className="truncate max-w-27.5 font-medium">
                        {getLocalizedTeamName(team.team_name, locale)}
                      </span>
                    </Link>
                  </td>
                  <td className="px-2 py-2.5 text-center text-gray-200 font-mono">
                    {(() => {
                      const gd =
                        (team.goals_for ?? 0) - (team.goals_against ?? 0);
                      return gd > 0 ? `+${gd}` : gd;
                    })()}
                  </td>
                  <td className="px-2 py-2.5 text-center text-gray-200 font-mono">
                    {team.played}
                  </td>
                  <td className="px-3 py-2.5 text-center font-bold text-white bg-white/5">
                    {team.points}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const legend = (
    <div className="flex items-center gap-2 p-2">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-[#4ade80] shrink-0" />
        <span className="text-[9px] font-light text-white">
          {t("roundOf16")}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-[#FFC000] shrink-0" />
        <span className="text-[9px] font-light text-white">
          {t("roundOf16Best3rd")}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-[#C93434] shrink-0" />
        <span className="text-[9px] font-light text-white">
          {t("eliminated")}
        </span>
      </div>
    </div>
  );

  return (
    <div className="w-full space-y-1">
      {/* Legend above groups on mobile/tablet only */}
      <div className="lg:hidden">{legend}</div>

      {/* Mobile / tablet: all groups, original layout */}
      <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-1 w-full">
        {sortedGroups.map(renderGroup)}
      </div>

      {/* Desktop: paginated 2×2 grid with arrows */}
      {totalPages > 0 && (
        <div className="hidden lg:block w-full space-y-3">
          {/* Full-width 2×2 group grid */}
          <div className="grid grid-cols-2 gap-1 w-full">
            {desktopGroups.map(renderGroup)}
          </div>

          {/* Legend below groups on desktop */}
          {legend}

          {/* Bottom bar: prev arrow — dots — next arrow */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <button
                onClick={() => setPage((p) => p - 1)}
                disabled={safePage === 0}
                aria-label="Previous groups"
                className="w-8 h-8 flex items-center justify-center text-gray-500 bg-custom-gray hover:bg-custom-gray/50 rounded-full hover:text-white disabled:opacity-20 transition-colors cursor-pointer"
              >
                <img
                  src="/images/specs/arrow.svg"
                  alt=""
                  className="w-3.5 h-3.5 object-contain -rotate-270"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = "/images/specs/arrow.jpg";
                  }}
                />
              </button>

              <div className="flex items-center gap-2">
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setPage(i)}
                    aria-label={`Page ${i + 1}`}
                    className={`rounded-full transition-all duration-200 ${
                      i === safePage
                        ? "w-2 h-2 bg-white"
                        : "w-1.5 h-1.5 bg-white/30 hover:bg-white/50"
                    }`}
                  />
                ))}
              </div>

              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={safePage === totalPages - 1}
                aria-label="Next groups"
                className="w-8 h-8 flex items-center justify-center text-gray-500 bg-custom-gray hover:bg-custom-gray/50 rounded-full hover:text-white disabled:opacity-20 transition-colors cursor-pointer"
              >
                <img
                  src="/images/specs/arrow.svg"
                  alt=""
                  className="w-3.5 h-3.5 object-contain rotate-270"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = "/images/specs/arrow.jpg";
                  }}
                />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
