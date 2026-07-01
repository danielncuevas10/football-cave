"use client";

import { useTranslations } from "next-intl";

interface TBDCardProps {
  homeLabel: string;
  awayLabel: string;
  homeLogo: string | null;
  awayLogo: string | null;
  fixtureDate: string | null;
  isFinal?: boolean;
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
  isFinal = false,
}: TBDCardProps) {
  const t = useTranslations("matchTabs");
  const displayHome = homeLabel === "TBD" ? t("teamTBC") : homeLabel;
  const displayAway = awayLabel === "TBD" ? t("teamTBC") : awayLabel;

  // Both teams fully unknown (R16+ slot awaiting confirmed fixture) → compact flag-border pill
  if (homeLabel === "TBD" && awayLabel === "TBD" && !fixtureDate) {
    return (
      <div className="bg-custom-gray-2/40 rounded-xl flex items-center justify-center gap-2.5 h-14 lg:h-20 px-3 border border-custom-gray-2/20 select-none opacity-70">
        <div className="w-7 h-5 shrink-0 border border-gray-300/30 rounded-tr-sm rounded-bl-sm" />
        <span className="text-gray-600 text-[9px] font-light">vs</span>
        <div className="w-7 h-5 shrink-0 border border-gray-300/30 rounded-tr-sm rounded-bl-sm" />
      </div>
    );
  }

  return (
    <div
      className={`${
        isFinal ? "bg-[#C5A059]/50" : "bg-custom-gray-2"
      } h-14 lg:h-20 px-1 grid grid-cols-[1fr_auto_1fr] gap-1 items-center border border-custom-gray-2/20 opacity-90 select-none rounded-xl`}
    >
      {/* home */}
      <div className="flex flex-col items-center justify-center gap-1.5 min-w-0">
        {homeLogo ? <Flag src={homeLogo} /> : <FlagPlaceholder />}
        <span className={`hidden md:block w-full text-xs text-center truncate${isFinal ? " font-bold text-white" : " font-light text-gray-200"}`}>
          {displayHome}
        </span>
      </div>

      {/* center — date/time */}
      <div className="flex flex-col items-center justify-center gap-0.5 px-1 min-w-10">
        {fixtureDate ? (
          <>
            <span className={`text-[10px] whitespace-nowrap${isFinal ? " text-white font-bold" : " text-gray-400"}`}>
              {formatDate(fixtureDate)}
            </span>
            <span className={`text-[8px] lg:text-[10px] tabular-nums whitespace-nowrap${isFinal ? " text-white font-bold" : " text-gray-200 font-medium"}`}>
              {formatTime(fixtureDate)}
            </span>
          </>
        ) : null}
      </div>

      {/* away */}
      <div className="flex flex-col items-center justify-center gap-1.5 min-w-0">
        {awayLogo ? <Flag src={awayLogo} /> : <FlagPlaceholder />}
        <span className={`hidden md:block w-full text-xs text-center truncate${isFinal ? " font-bold text-white" : " font-light text-gray-200"}`}>
          {displayAway}
        </span>
      </div>
    </div>
  );
}
