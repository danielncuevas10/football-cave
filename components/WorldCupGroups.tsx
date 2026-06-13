"use client";

import Image from "next/image";
import Link from "next/link";
import { DbStanding } from "@/types/sports";

interface WorldCupGroupsProps {
  standings: DbStanding[];
}

export default function WorldCupGroups({ standings }: WorldCupGroupsProps) {
  const grouped = standings.reduce<Record<string, DbStanding[]>>((acc, row) => {
    const key = row.group_name || "Unknown";
    if (!acc[key]) acc[key] = [];
    acc[key].push(row);
    return acc;
  }, {});

  const sortedGroups = Object.keys(grouped).sort((a, b) => a.localeCompare(b));

  const multiGroup = sortedGroups.length > 1;

  return (
    <div
      className={`grid gap-4 w-full ${
        multiGroup ? "sm:grid-cols-2" : "grid-cols-1"
      }`}
    >
      {sortedGroups.map((groupName) => {
        const teams = grouped[groupName].sort((a, b) => a.rank - b.rank);
        // Extract just the letter: "Group A" → "A", or use as-is
        const letter = groupName.replace(/^Group\s*/i, "").trim() || groupName;

        return (
          <div
            key={groupName}
            className="bg-custom-gray border border-custom-gray-2 rounded-md overflow-hidden"
          >
            <table className="w-full text-xs text-gray-200 bg-custom-gray-2">
              {/* Column headers */}
              <thead>
                <tr className="text-[10px] uppercase tracking-wider bg-custom-gray">
                  <th className="px-3 py-2 text-center w-7 text-gray-500">#</th>
                  <th className="px-2 py-3 text-left text-white font-black tracking-widest">
                    Group {letter}
                  </th>
                  <th
                    className="px-2 py-2 text-center w-8"
                    title="Goal Difference"
                  >
                    GD
                  </th>
                  <th
                    className="px-2 py-2 text-center w-8"
                    title="Matches Played"
                  >
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
                  return (
                    <tr
                      key={team.team_id}
                      className={`hover:bg-gray-800/20 transition-colors ${
                        advances ? "shadow-[inset_1.5px_0_0_#4ade80]" : ""
                      }`}
                    >
                      <td className="px-3 py-2.5 text-center font-bold text-gray-500">
                        {team.rank}
                      </td>
                      <td className="px-2 py-2.5">
                        <Link href={`/team/${team.team_id}`} className="flex items-center gap-2 hover:opacity-75 transition-opacity">
                          {team.team_logo && (
                            <Image
                              src={team.team_logo}
                              alt={team.team_name}
                              width={18}
                              height={18}
                              className="object-contain shrink-0"
                            />
                          )}
                          <span className="truncate max-w-27.5 font-medium">
                            {team.team_name}
                          </span>
                        </Link>
                      </td>
                      <td className="px-2 py-2.5 text-center text-gray-400 font-mono">
                        {(() => {
                          const gd =
                            (team.goals_for ?? 0) - (team.goals_against ?? 0);
                          return gd > 0 ? `+${gd}` : gd;
                        })()}
                      </td>
                      <td className="px-2 py-2.5 text-center text-gray-400 font-mono">
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
      })}
    </div>
  );
}
