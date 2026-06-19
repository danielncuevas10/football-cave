"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { DbTopScorer } from "@/types/sports";
import Image from "next/image";

interface Props {
  scorers: DbTopScorer[];
}

export default function TopScorers({ scorers }: Props) {
  const t = useTranslations("matchTabs");
  const tDetails = useTranslations("matchDetails");
  const [isExpanded, setIsExpanded] = useState(false);

  if (!scorers || scorers.length === 0) {
    return (
      <div className="p-8 text-center text-gray-200 border border-custom-gray rounded-md">
        {tDetails("comingSoon")}
        <img
          src="/images/specs/clock.svg"
          alt=""
          className="w-8 h-8 object-contain mx-auto mt-4"
        />
      </div>
    );
  }

  const withGoals = scorers.filter((s) => s.goals > 0);
  const displayedScorers = isExpanded ? withGoals : withGoals.slice(0, 10);

  return (
    <div className="w-full bg-custom-gray-2 rounded-md overflow-hidden">
      <table className="w-full text-sm text-left text-gray-200 table-fixed">
        <thead className="text-xs text-gray-200 bg-custom-gray border-b border-custom-gray">
          <tr>
            <th className="px-2 py-3 font-medium w-12 text-center">#</th>
            <th className="px-2 py-3 font-medium">Player</th>
            <th
              className="px-1 py-3 font-medium text-center w-8 sm:w-12"
              title="Matches Played"
            >
              MP
            </th>
            <th
              className="px-1 py-3 font-medium text-center w-8 sm:w-12"
              title="Assists"
            >
              A
            </th>
            <th
              className="px-1 py-3 font-bold text-white text-center w-8 sm:w-12"
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
              <td className="px-2 py-3 text-center font-medium text-gray-200 w-8">
                {index + 1}
              </td>
              <td className="px-2 py-3">
                <div className="flex items-center gap-2">
                  <Image
                    src={player.player_photo ?? "/images/placeholderPlayer.svg"}
                    alt={player.player_name}
                    width={22}
                    height={22}
                    className="object-contain rounded-full bg-gray-800 shrink-0"
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="font-light text-xs text-gray-100 leading-tight wrap-break-word">
                      {player.player_name}
                    </span>
                    <span className="text-xs text-gray-200/40 font-light truncate mt-0.5">
                      {player.team_name}
                    </span>
                  </div>
                </div>
              </td>
              <td className="px-1 py-3 text-center text-gray-200 w-8 sm:w-12 text-xs">
                {player.appearances}
              </td>
              <td className="px-1 py-3 text-center text-gray-200 w-8 sm:w-12 text-xs">
                {player.assists ?? 0}
              </td>
              <td className="px-1 py-3 text-center font-bold text-white w-8 sm:w-12 text-xs sm:text-sm">
                {player.goals}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {withGoals.length > 10 && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full py-3 bg-custom-gray hover:bg-gray-800/60 text-xs font-semibold text-gray-200 hover:text-white flex items-center justify-center gap-2 border-t border-custom-gray transition-colors will-change-transform"
        >
          {isExpanded ? (
            <>
              {t("seeLess")}
              <img
                src="/images/specs/Arrow.svg"
                alt=""
                className="w-3.5 h-3.5 object-contain rotate-180"
              />
            </>
          ) : (
            <>
              {t("seeMore")}
              <img
                src="/images/specs/Arrow.svg"
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
