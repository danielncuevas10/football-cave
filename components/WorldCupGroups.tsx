"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useTranslations, useLocale } from "next-intl";
import { DbStanding } from "@/types/sports";
import { getLocalizedTeamName } from "@/lib/teamName";

interface WorldCupGroupsProps {
  standings: DbStanding[];
  allStandings?: DbStanding[];
  showDropdown?: boolean;
  hideLegends?: boolean;
}

const PAGE_SIZE = 4;

export function WorldCupLegend() {
  const t = useTranslations("matchTabs");
  return (
    <div>
      <div className="flex items-center gap-3 px-1 py-2 text-[9px] text-gray-300 font-light">
        <span>
          <span className="text-gray-200 font-bold">
            {t("standingsGdAbbr")}
          </span>
          : {t("standingsGdFull")}
        </span>
        <span className="text-gray-400">·</span>
        <span>
          <span className="text-gray-200 font-bold">{t("scorerMpAbbr")}</span>:{" "}
          {t("scorerMpFull")}
        </span>
        <span className="text-gray-400">·</span>
        <span>
          <span className="text-gray-200 font-bold">
            {t("standingsPtsAbbr")}
          </span>
          : {t("standingsPtsFull")}
        </span>
      </div>
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
    </div>
  );
}

export default function WorldCupGroups({
  standings,
  allStandings,
  showDropdown = false,
  hideLegends = false,
}: WorldCupGroupsProps) {
  const t = useTranslations("matchTabs");
  const locale = useLocale();
  const [page, setPage] = useState(0);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

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
        className={
          hideLegends
            ? "overflow-hidden"
            : "bg-custom-gray rounded-xl overflow-hidden"
        }
      >
        <table className="w-full text-xs text-gray-200 bg-custom-gray-2">
          <thead>
            <tr className="text-[10px] tracking-wider bg-custom-gray">
              <th className="px-3 py-2 text-center w-7 text-gray-300">#</th>
              <th className="px-2 py-5 text-left text-white font-light tracking-widest">
                {t("group")} {letter}
              </th>
              <th
                className="px-2 py-2 text-center w-8"
                title={t("standingsGdFull")}
              >
                {t("standingsGdAbbr")}
              </th>
              <th
                className="px-2 py-2 text-center w-8"
                title={t("scorerMpFull")}
              >
                {t("scorerMpAbbr")}
              </th>
              <th
                className="px-3 py-2 text-center w-8 text-white font-black"
                title={t("standingsPtsFull")}
              >
                {t("standingsPtsAbbr")}
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
                        <div className="w-8 h-5 overflow-hidden shrink-0 block relative border border-gray-300 rounded-tr-lg rounded-bl-lg">
                          <Image
                            src={team.team_logo}
                            alt=""
                            width={48}
                            height={32}
                            className="w-full h-full object-cover  will-change-transform scale-[1.15]"
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

  const statsLegend = (
    <div className="flex items-center gap-3 px-1 py-2 text-[9px] lg:text-[12px] text-gray-300 font-light">
      <span>
        <span className="text-gray-200 font-bold">{t("standingsGdAbbr")}</span>:{" "}
        {t("standingsGdFull")}
      </span>
      <span className="text-gray-400">·</span>
      <span>
        <span className="text-gray-200 font-bold">{t("scorerMpAbbr")}</span>:{" "}
        {t("scorerMpFull")}
      </span>
      <span className="text-gray-400">·</span>
      <span>
        <span className="text-gray-200 font-bold">{t("standingsPtsAbbr")}</span>
        : {t("standingsPtsFull")}
      </span>
    </div>
  );

  // legend placement logic:
  // showDropdown + no selected group (See All) → above, no bg
  // showDropdown + group selected           → below
  // no dropdown + not hidden (team context) → below
  // hideLegends (match context)        → none (caller renders outside)
  const showLegendsAbove = showDropdown && !selectedGroup && !hideLegends;
  const showLegendsBelow = !hideLegends && (!showDropdown || !!selectedGroup);

  const mobileGroups =
    showDropdown && selectedGroup
      ? sortedGroups.filter((g) => g === selectedGroup)
      : sortedGroups;

  return (
    <div className="w-full space-y-1">
      {/* Mobile / tablet */}
      <div className="lg:hidden space-y-1">
        {/* Group filter dropdown */}
        {showDropdown && (
          <div className="relative mb-1">
            <select
              value={selectedGroup ?? ""}
              onChange={(e) => setSelectedGroup(e.target.value || null)}
              className="w-full bg-custom-gray text-white text-xs px-3 py-2.5 rounded-xl border border-gray-700/50 appearance-none cursor-pointer focus:outline-none focus:border-gray-500"
            >
              <option value="">{t("seeAll")}</option>
              {sortedGroups.map((g) => {
                const letter = g.replace(/^Group\s*/i, "").trim() || g;
                return (
                  <option key={g} value={g}>
                    {t("group")} {letter}
                  </option>
                );
              })}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
              <svg
                className="w-3 h-3 text-gray-400"
                viewBox="0 0 12 12"
                fill="none"
              >
                <path
                  d="M2 4l4 4 4-4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        )}

        {/* Legends above — only when showing all groups (See All) */}
        {showLegendsAbove && (
          <>
            {statsLegend}
            {legend}
          </>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-1 w-full">
          {mobileGroups.map(renderGroup)}
        </div>

        {/* Legends below — one group selected, or team-page context */}
        {showLegendsBelow && (
          <>
            {statsLegend}
            {legend}
          </>
        )}
      </div>

      {/* Desktop: paginated 2×2 grid with arrows */}
      {totalPages > 0 && (
        <div className="hidden lg:block w-full space-y-3">
          {/* Full-width 2×2 group grid */}
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-1 w-full">
            {desktopGroups.map(renderGroup)}
          </div>

          {/* Legend below groups on desktop */}
          {!hideLegends && legend}
          {!hideLegends && statsLegend}

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
