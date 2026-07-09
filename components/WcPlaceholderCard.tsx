"use client";

import { useTranslations } from "next-intl";

type WcPlaceholderKey =
  | "sf1Home"
  | "sf1Away"
  | "sf2Home"
  | "sf2Away"
  | "loserSF1"
  | "loserSF2"
  | "winnerSF1"
  | "winnerSF2";

interface Props {
  homeKey: WcPlaceholderKey;
  awayKey: WcPlaceholderKey;
  time: string;
  isLast: boolean;
}

export default function WcPlaceholderCard({
  homeKey,
  awayKey,
  time,
  isLast,
}: Props) {
  const t = useTranslations("wcPlaceholder");

  return (
    <div className={isLast ? "rounded-b-lg" : "border-b border-white/4"}>
      <div className="bg-custom-gray-2 h-16 px-3 grid grid-cols-[2rem_1fr_auto_1fr] gap-2 items-center opacity-60">
        {/* Badge placeholder */}
        <div className="w-8 h-8" />

        {/* Home team */}
        <div className="flex items-center justify-end min-w-0">
          <span className="text-[9px] lg:text-md font-medium text-right leading-tight line-clamp-2 text-gray-300">
            {t(homeKey)}
          </span>
        </div>

        {/* Center: time */}
        <div className="flex items-center justify-center px-2 min-w-14">
          <span className="text-gray-400 text-xs font-medium tabular-nums whitespace-nowrap">
            {time}
          </span>
        </div>

        {/* Away team */}
        <div className="flex items-center justify-start min-w-0">
          <span className="text-[9px] lg:text-md font-medium text-left leading-tight line-clamp-2 text-gray-300">
            {t(awayKey)}
          </span>
        </div>
      </div>
    </div>
  );
}
