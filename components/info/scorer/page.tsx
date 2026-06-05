"use client";
import { useState } from "react";
import type { DbTopScorer } from "@/types/sports";
import Image from "next/image";

interface Props {
  scorers: DbTopScorer[];
}

export default function TopScorers({ scorers }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!scorers || scorers.length === 0) {
    return (
      <div className="p-8 text-center text-gray-200 border border-custom-gray rounded-lg">
        Coming soon...
        <img
          src="/images/specs/clock.svg"
          alt=""
          className="w-8 h-8 object-contain mx-auto mt-4"
        />
      </div>
    );
  }

  const displayedScorers = isExpanded ? scorers : scorers.slice(0, 10);

  return (
    <div className="w-full overflow-x-auto bg-custom-gray-2 border border-custom-gray-2 rounded-md">
      <table className="w-full text-sm text-left text-gray-200 table-fixed sm:table-auto">
        <thead className="text-xs text-gray-500 uppercase bg-custom-gray border-b border-custom-gray">
          <tr>
            <th className="px-4 py-3 font-medium w-12 text-center">#</th>
            <th className="px-4 py-3 font-medium">Player</th>
            {/* Added fixed w-16 classes below */}
            <th
              className="px-3 py-3 font-medium text-center w-16"
              title="Matches Played"
            >
              MP
            </th>
            <th
              className="px-3 py-3 font-medium text-center w-16"
              title="Assists"
            >
              A
            </th>
            <th
              className="px-4 py-3 font-bold text-white text-center w-16"
              title="Goals"
            >
              G
            </th>
          </tr>
        </thead>
        <tbody>
          {displayedScorers.map((player, index) => (
            <tr
              key={player.player_id}
              className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
            >
              <td className="px-4 py-3 text-center font-medium text-gray-400 w-12">
                {index + 1}
              </td>
              <td className="px-4 py-3 truncate">
                <div className="flex items-center gap-3">
                  <Image
                    src={player.player_photo ?? "/placeholder.png"}
                    alt={player.player_name}
                    width={28}
                    height={28}
                    className="object-contain rounded-full bg-gray-800"
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="font-semibold text-sm text-gray-100 truncate">
                      {player.player_name}
                    </span>
                    <span className="text-xs text-gray-500 font-light truncate">
                      {player.team_name}
                    </span>
                  </div>
                </div>
              </td>
              <td className="px-3 py-3 text-center text-gray-400 w-16">
                {player.appearances}
              </td>
              <td className="px-3 py-3 text-center text-gray-400 w-16">
                {player.assists ?? 0}
              </td>
              <td className="px-4 py-3 text-center font-bold text-white w-16">
                {player.goals}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {scorers.length > 10 && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full py-3 bg-custom-gray hover:bg-gray-800/60 text-xs font-semibold text-gray-400 hover:text-white flex items-center justify-center gap-2 border-t border-custom-gray transition-colors will-change-transform"
        >
          {isExpanded ? (
            <>
              See Less
              <img
                src="/images/specs/arrow.svg"
                alt=""
                className="w-3.5 h-3.5 object-contain rotate-180"
              />
            </>
          ) : (
            <>
              See More
              <img
                src="/images/specs/arrow.svg"
                alt=""
                className="w-3.5 h-3.5 object-contain"
              />
            </>
          )}
        </button>
      )}
    </div>
  );
}
