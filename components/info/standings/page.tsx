"use client";

import { useTranslations } from "next-intl";
import { League } from "@/types/sports";
import type { DbStanding } from "@/types/sports";
import Image from "next/image";
import Link from "next/link";

interface Props {
  standings: DbStanding[];
}

export default function StandingsTable({ standings }: Props) {
  const t = useTranslations("matchTabs");
  return (
    <div className="w-full overflow-x-auto bg-custom-gray-2 border border-custom-gray-2 rrounded-md">
      <table className="w-full text-sm text-left text-gray-200 border-collapse">
        <thead className="text-xs text-gray-300 uppercase bg-custom-gray border-b border-custom-gray">
          <tr>
            <th className="px-4 py-3 font-medium w-12 text-center">#</th>
            <th className="px-4 py-3 font-medium">{t("club")}</th>
            <th className="px-3 py-3 font-medium text-center" title="Played">
              MP
            </th>
            <th className="px-3 py-3 font-medium text-center" title="Won">
              W
            </th>
            <th className="px-3 py-3 font-medium text-center" title="Drawn">
              D
            </th>
            <th className="px-3 py-3 font-medium text-center" title="Lost">
              L
            </th>
            <th
              className="px-4 py-3 font-bold text-white text-center"
              title="Points"
            >
              Pts
            </th>
          </tr>
        </thead>
        <tbody>
          {standings.map((team) => {
            const rank = team.rank ?? 0;

            // 1. Verify if this row belongs to the Champions League league_id
            const isChampionsLeague = team.league_id === League.ChampionsLeague;

            // 2. Determine the qualification zone border accent color
            let zoneBorderClass = "";
            if (isChampionsLeague && rank > 0) {
              if (rank >= 1 && rank <= 8) {
                zoneBorderClass =
                  "border-l-3 border-l-emerald-500 bg-emerald-950/5"; // Direct Qualification (Green)
              } else if (rank >= 9 && rank <= 24) {
                zoneBorderClass =
                  "border-l-3 border-l-amber-500 bg-amber-950/5"; // Play-offs (Orange)
              } else if (rank >= 25) {
                zoneBorderClass = "border-l-3 border-l-rose-500 bg-rose-950/5"; // Eliminated (Red)
              }
            }

            const isLaLiga = team.league_id === League.LaLiga;

            // Determine the qualification zone border accent color for LaLiga
            let zoneBorderClass1 = "";
            if (isLaLiga && rank > 0) {
              if (rank >= 1 && rank <= 5) {
                zoneBorderClass1 = "border-l-3 border-l-[#00088E]"; //Champions
              } else if (rank >= 6 && rank <= 7) {
                zoneBorderClass1 = "border-l-3 border-l-[#EB6A0A]"; // Europa
              } else if (rank === 8) {
                zoneBorderClass1 = "border-l-3 border-l-[#228B22]"; // Conference
              } else if (rank >= standings.length - 2) {
                zoneBorderClass1 = "border-l-3 border-l-[#FF0000]"; // Eliminated
              }
            }

            const finalZoneClass = isLaLiga
              ? zoneBorderClass1
              : zoneBorderClass;

            return (
              <tr
                key={team.team_id}
                className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
              >
                {/* Apply the zone border class exclusively to the first column cell */}
                <td
                  className={`px-4 py-3 text-center font-mono font-bold text-gray-200 ${finalZoneClass}`}
                >
                  {team.rank}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/team/${team.team_id}`}
                    className="flex items-center gap-3 hover:opacity-75 transition-opacity"
                  >
                    {team.team_logo && (
                      <Image
                        src={team.team_logo}
                        alt={team.team_name}
                        width={24}
                        height={24}
                        className="object-contain w-6 h-6"
                      />
                    )}
                    <span className="font-light text-sm text-gray-100">
                      {team.team_name}
                    </span>
                  </Link>
                </td>
                <td className="px-3 py-3 text-center font-mono">
                  {team.played}
                </td>
                <td className="px-3 py-3 text-center font-mono">{team.won}</td>
                <td className="px-3 py-3 text-center font-mono ">
                  {team.drawn}
                </td>
                <td className="px-3 py-3 text-center font-mono">{team.lost}</td>
                <td className="px-4 py-3 text-center font-mono font-bold text-white bg-custom-gray/30">
                  {team.points}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
