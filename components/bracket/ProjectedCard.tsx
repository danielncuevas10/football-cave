"use client";

// Bracket slot card for R32_T matches where the third-place away team is
// projected (group stage not complete). Home team is a confirmed group winner.

import { useTranslations } from "next-intl";

interface ProjectedCardProps {
  homeLabel: string;
  awayLabel: string;
  homeLogo: string | null;
  awayLogo: string | null;
}

function Flag({ src, muted }: { src: string; muted?: boolean }) {
  return (
    <div
      className={`w-12 h-8 overflow-hidden shrink-0 relative border border-gray-300 rounded-tr-md rounded-bl-md ${
        muted ? "opacity-50" : ""
      }`}
    >
      <img
        src={src}
        alt=""
        className="w-full h-full object-cover scale-[1.15] will-change-transform"
      />
    </div>
  );
}

function FlagPlaceholder({ muted }: { muted?: boolean }) {
  return (
    <div
      className={`w-12 h-8 shrink-0 border border-gray-300/30 rounded-tr-md rounded-bl-md bg-custom-gray ${
        muted ? "opacity-50" : ""
      }`}
    />
  );
}

export default function ProjectedCard({
  homeLabel,
  awayLabel,
  homeLogo,
  awayLogo,
}: ProjectedCardProps) {
  const t = useTranslations("matchTabs");

  return (
    <div className="bg-custom-gray-2 py-4 px-3 my-2 grid grid-cols-[1rem_1fr_auto_1fr] gap-2 items-center border border-custom-gray-2/20 opacity-90 select-none rounded-md">
      {/* badge column */}
      <div />

      {/* home — confirmed group winner */}
      <div className="flex flex-col items-center justify-end gap-2 min-w-0 w-full">
        {homeLogo ? <Flag src={homeLogo} /> : <FlagPlaceholder />}
        {/* Added 'block w-full text-center' */}
        <span className="block w-full text-center text-sm font-medium text-gray-200 truncate">
          {homeLabel}
        </span>
      </div>

      {/* center */}
      <div className="flex flex-col items-center justify-center gap-0.5 px-2 min-w-14">
        <span className="text-gray-200 text-sm font-light">vs</span>
      </div>

      {/* away — projected third-place team */}
      <div className="flex flex-col items-center justify-start gap-2 min-w-0 w-full">
        {awayLogo ? <Flag src={awayLogo} muted /> : <FlagPlaceholder muted />}

        {/* FIXED: Added 'min-w-0 w-full' to this wrapper div */}
        <div className="flex flex-col items-center gap-0.5 min-w-0 w-full">
          {/* Added 'block w-full text-center' */}
          <span className="block w-full text-center text-sm font-medium text-gray-200 truncate">
            {awayLabel}
          </span>
          <span className="text-[9px] font-xs tracking-wider text-[#FFC000]">
            {t("projected")}
          </span>
        </div>
      </div>
    </div>
  );
}
