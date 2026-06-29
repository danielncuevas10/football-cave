"use client";

import { useTranslations } from "next-intl";

interface TBDCardProps {
  homeLabel: string;
  awayLabel: string;
  homeLogo: string | null;
  awayLogo: string | null;
  fixtureDate: string | null;
}

function Flag({ src }: { src: string }) {
  return (
    <div className="w-6 h-4 lg:w-10 lg:h-6 overflow-hidden shrink-0 relative border border-gray-300 rounded-tr-md rounded-bl-md">
      <img
        src={src}
        alt=""
        className="w-full h-full object-cover will-change-transform scale-[1.15]"
      />
    </div>
  );
}

function FlagPlaceholder() {
  return (
    <div className="w-6 h-4 lg:w-10 lg:h-6 shrink-0 border border-gray-300/30 rounded-tr-md rounded-bl-md bg-custom-gray" />
  );
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function TBDCard({
  homeLabel,
  awayLabel,
  homeLogo,
  awayLogo,
  fixtureDate,
}: TBDCardProps) {
  const t = useTranslations("matchTabs");
  const displayHome = homeLabel === "TBD" ? t("teamTBC") : homeLabel;
  const displayAway = awayLabel === "TBD" ? t("teamTBC") : awayLabel;

  // Both teams fully unknown (R16+ slot awaiting confirmed fixture) → compact flag-border pill
  if (homeLabel === "TBD" && awayLabel === "TBD" && !fixtureDate) {
    return (
      <div className="bg-custom-gray-2/40 rounded-xl flex items-center justify-center gap-2.5 my-1 px-3 py-2 border border-custom-gray-2/20 select-none opacity-70">
        <div className="w-7 h-5 shrink-0 border border-gray-300/30 rounded-tr-sm rounded-bl-sm" />
        <span className="text-gray-600 text-[9px] font-light">vs</span>
        <div className="w-7 h-5 shrink-0 border border-gray-300/30 rounded-tr-sm rounded-bl-sm" />
      </div>
    );
  }

  return (
    <div className="bg-custom-gray-2 py-2 px-1 grid grid-cols-[1fr_auto_1fr] gap-1 items-center border border-custom-gray-2/20 opacity-90 select-none rounded-xl">
      {/* home */}
      <div className="flex flex-col items-center justify-center gap-1.5 min-w-0">
        {homeLogo ? <Flag src={homeLogo} /> : <FlagPlaceholder />}
        <span className="hidden md:block w-full text-xs font-light text-center text-gray-200 truncate">
          {displayHome}
        </span>
      </div>

      {/* center — date/time */}
      <div className="flex flex-col items-center justify-center gap-0.5 px-1 min-w-10">
        <span className="text-gray-200 text-sm font-light">vs</span>
        {fixtureDate ? (
          <>
            <span className="text-gray-400 text-[10px] whitespace-nowrap">
              {formatDate(fixtureDate)}
            </span>
            <span className="text-gray-200 text-xs font-medium tabular-nums whitespace-nowrap">
              {formatTime(fixtureDate)}
            </span>
          </>
        ) : null}
      </div>

      {/* away */}
      <div className="flex flex-col items-center justify-center gap-1.5 min-w-0">
        {awayLogo ? <Flag src={awayLogo} /> : <FlagPlaceholder />}
        <span className="hidden md:block w-full text-xs font-light text-center text-gray-200 truncate">
          {displayAway}
        </span>
      </div>
    </div>
  );
}
