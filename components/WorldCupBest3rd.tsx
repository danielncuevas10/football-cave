"use client";

import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import type { DbStanding } from "@/types/sports";
import { getLocalizedTeamName } from "@/lib/teamName";

interface WorldCupBest3rdProps {
  standings: DbStanding[];
}

export default function WorldCupBest3rd({ standings }: WorldCupBest3rdProps) {
  const t = useTranslations("matchTabs");
  const locale = useLocale();

  const thirds = standings
    .filter((s) => s.rank === 3)
    .sort((a, b) => {
      const pts = b.points - a.points;
      if (pts !== 0) return pts;
      const gd =
        b.goals_for - b.goals_against - (a.goals_for - a.goals_against);
      if (gd !== 0) return gd;
      return b.goals_for - a.goals_for;
    });

  const advancingIds = new Set(thirds.slice(0, 8).map((s) => s.team_id));

  return (
    <div className="col-span-full mt-4">
      <div className="bg-custom-gray border border-custom-gray-2 rounded-md overflow-hidden">
        <table className="w-full text-xs text-gray-200 bg-custom-gray-2">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider bg-custom-gray">
              <th className="px-3 py-2 text-center w-7 text-gray-300">#</th>
              <th className="px-2 py-3 text-left text-white font-black tracking-widest">
                {t("bestThirdPlace")}
              </th>
              <th
                className="px-2 py-2 text-center w-8"
                title="Goals For"
              >
                GF
              </th>
              <th
                className="px-2 py-2 text-center w-8"
                title="Goals Against"
              >
                GA
              </th>
              <th
                className="px-2 py-2 text-center w-8"
                title="Goal Difference"
              >
                GD
              </th>
              <th className="px-3 py-2 text-center w-8 text-white font-black">
                Pts
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/30">
            {thirds.map((team, i) => {
              const advancing = advancingIds.has(team.team_id);
              const gd = (team.goals_for ?? 0) - (team.goals_against ?? 0);
              const groupLetter = (team.group_name ?? "")
                .replace(/^Group\s*/i, "")
                .trim();
              return (
                <tr
                  key={team.team_id}
                  className={`hover:bg-gray-800/20 transition-colors ${
                    advancing
                      ? "[&>td:first-child]:border-l-2 [&>td:first-child]:border-[#FFC000]"
                      : "[&>td:first-child]:border-l-2 [&>td:first-child]:border-[#C93434]"
                  }`}
                >
                  <td className="px-3 py-2.5 text-center font-bold text-gray-300">
                    {i + 1}
                  </td>
                  <td className="px-2 py-2.5">
                    <Link
                      href={`/team/${team.team_id}`}
                      className="flex items-center gap-2 hover:opacity-75 transition-opacity"
                    >
                      {team.team_logo && (
                        <div className="w-10 h-6 overflow-hidden shrink-0 relative border border-gray-300 rounded-tr rounded-bl">
                          <img
                            src={team.team_logo}
                            alt=""
                            className="w-full h-full object-cover scale-[1.15] will-change-transform"
                          />
                        </div>
                      )}
                      <div className="flex flex-col min-w-0">
                        <span className="truncate font-medium">
                          {getLocalizedTeamName(team.team_name, locale)}
                        </span>
                        <span className="text-[9px] text-gray-500 uppercase tracking-wider">
                          {t("group")} {groupLetter}
                        </span>
                      </div>
                    </Link>
                  </td>
                  <td className="px-2 py-2.5 text-center text-gray-200 font-mono">
                    {team.goals_for ?? 0}
                  </td>
                  <td className="px-2 py-2.5 text-center text-gray-200 font-mono">
                    {team.goals_against ?? 0}
                  </td>
                  <td className="px-2 py-2.5 text-center text-gray-200 font-mono">
                    {gd > 0 ? `+${gd}` : gd}
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
    </div>
  );
}