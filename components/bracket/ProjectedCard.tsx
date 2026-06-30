"use client";

// Bracket slot card for R32_T matches where the third-place away team is
// projected (group stage not complete). Home team is a confirmed group winner.

import { useTranslations } from "next-intl";

interface ProjectedCardProps {
  homeLabel: string;
  awayLabel: string;
  homeLogo: string | null;
  awayLogo: string | null;
  fixtureDate: string | null;
}

function Flag({ src, muted }: { src: string; muted?: boolean }) {
  return (
    <div
      className={`w-6 h-4 lg:w-10 lg:h-6 overflow-hidden shrink-0 relative border-2 rounded-tr-md rounded-bl-md ${
        muted ? "opacity-70 border-[#FFC000]" : "border-gray-200"
      }`}
    >
      <img
        src={src}
        alt=""
        className="w-full h-full object-cover will-change-transform scale-[1.15]"
      />
    </div>
  );
}

function FlagPlaceholder({ muted }: { muted?: boolean }) {
  return (
    <div
      className={`w-6 h-4 lg:w-10 lg:h-6 shrink-0 border border-gray-300/30 rounded-tr-md rounded-bl-md bg-custom-gray ${
        muted ? "opacity-50" : ""
      }`}
    />
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

export default function ProjectedCard({
  homeLabel,
  awayLabel,
  homeLogo,
  awayLogo,
  fixtureDate,
}: ProjectedCardProps) {
  const t = useTranslations("matchTabs");
  const displayHome = homeLabel === "TBD" ? t("teamTBC") : homeLabel;
  const displayAway = awayLabel === "TBD" ? t("teamTBC") : awayLabel;

  return (
    <div className="bg-custom-gray-2 h-14 lg:h-20 px-1 grid grid-cols-[1fr_auto_1fr] gap-1 items-center border border-custom-gray-2/20 opacity-90 select-none rounded-xl">
      {/* home — confirmed group winner */}
      <div className="flex flex-col items-center justify-center gap-1.5 min-w-0 w-full">
        {homeLogo ? <Flag src={homeLogo} /> : <FlagPlaceholder />}
        <span className="hidden md:block w-full text-center text-sm font-medium text-gray-200 truncate">
          {displayHome}
        </span>
      </div>

      {/* center — date/time or "not confirmed" */}
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

      {/* away — projected third-place team */}
      <div className="flex flex-col items-center justify-center gap-1.5 min-w-0 w-full">
        {awayLogo ? <Flag src={awayLogo} muted /> : <FlagPlaceholder muted />}
        <div className="flex flex-row items-center gap-0.5 min-w-0 w-full">
          <span className="hidden md:block w-full text-center text-sm font-medium text-gray-200 truncate">
            {displayAway}
          </span>
        </div>
      </div>
    </div>
  );
}
