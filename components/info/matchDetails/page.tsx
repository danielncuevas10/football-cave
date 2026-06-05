"use client";

import { useTranslations } from "next-intl";
import type { DbMatchDetails } from "@/types/sports";

interface DetailsProps {
  details: DbMatchDetails | null;
}

const DISPLAY_STATS_ORDER = [
  "Ball Possession",
  "Shots on Goal",
  "Total Shots",
  "Corner Kicks",
  "Fouls",
  "Total passes",
  "Passes %",
  "Goalkeeper Saves",
];

const STAT_KEY_MAP: Record<string, string> = {
  "Ball Possession": "ballPossession",
  "Shots on Goal": "shotsOnGoal",
  "Total Shots": "totalShots",
  "Corner Kicks": "cornerKicks",
  "Fouls": "fouls",
  "Total passes": "totalPasses",
  "Passes %": "passesPercent",
  "Goalkeeper Saves": "goalkeeperSaves",
};

export default function MatchCenterDetails({ details }: DetailsProps) {
  const t = useTranslations("matchDetails");
  const tStat = useTranslations("statLabels");

  if (!details) {
    return (
      <div className="p-8 text-center text-gray-200 border border-custom-gray rounded-lg">
        {t("comingSoon")}
        <img
          src="/images/specs/clock.svg"
          alt=""
          className="w-8 h-8 object-contain mx-auto mt-4"
        />
      </div>
    );
  }

  if (!details.statistics || details.statistics.length < 2) {
    return (
      <div className="p-8 text-center text-gray-200 border border-custom-gray rounded-lg">
        {t("noInfoYet")}
        <img
          src="/images/specs/clock.svg"
          alt=""
          className="w-8 h-8 object-contain mx-auto mt-4"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full text-white">
      {details.statistics && details.statistics.length >= 2 && (
        <div className="bg-custom-gray-2 rounded-xl border border-custom-gray overflow-hidden">
          <div className="bg-custom-gray flex items-center justify-center gap-2 py-4">
            <h3 className="text-xs font-light text-white tracking-wider">
              {t("matchOverview")}
            </h3>
          </div>

          <div className="space-y-3 p-4">
            {DISPLAY_STATS_ORDER.map((statType: string, statIdx: number) => {
              const homeStat = details.statistics[0]?.statistics.find(
                (s: { type: string; value: string | number | null }) =>
                  s.type === statType
              );
              const awayStat = details.statistics[1]?.statistics.find(
                (s: { type: string; value: string | number | null }) =>
                  s.type === statType
              );

              if (!homeStat && !awayStat) return null;

              const homeValue = homeStat?.value ?? 0;
              const awayValue = awayStat?.value ?? 0;

              const homeNum =
                typeof homeValue === "string"
                  ? parseInt(homeValue) || 0
                  : homeValue;
              const awayNum =
                typeof awayValue === "string"
                  ? parseInt(awayValue) || 0
                  : awayValue;

              const total = homeNum + awayNum;
              const homeWidth = total > 0 ? (homeNum / total) * 100 : 50;
              const awayWidth = total > 0 ? (awayNum / total) * 100 : 50;

              const statKey = STAT_KEY_MAP[statType];
              const label = statKey ? tStat(statKey) : statType;

              return (
                <div key={statIdx} className="space-y-1 py-1">
                  <div className="flex justify-between text-xs font-medium text-gray-400 px-1">
                    <span className="font-mono text-gray-200">{homeValue}</span>
                    <span className="text-gray-500 tracking-wide text-[10px]">
                      {label}
                    </span>
                    <span className="font-mono text-gray-200">{awayValue}</span>
                  </div>

                  <div className="h-2 w-full bg-custom-gray rounded-full flex overflow-hidden">
                    <div
                      className="h-full bg-[#B76E79] transition-all duration-300"
                      style={{ width: `${homeWidth}%` }}
                    />
                    <div
                      className="h-full bg-white/80 transition-all duration-300"
                      style={{ width: `${awayWidth}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
