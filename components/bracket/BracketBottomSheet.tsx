"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

export default function BracketBottomSheet() {
  const tBadge = useTranslations("liveBadge");
  const tTabs = useTranslations("matchTabs");

  return (
    <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-custom-gray-2 shadow-lg">
      <div className="flex items-stretch">
        <Link
          href="/league/1"
          className="flex-1 flex items-center justify-center gap-2 px-4 py-8 text-sm font-light text-white tracking-wide border-r border-gray-700/60 hover:bg-gray-900/20 transition-colors"
        >
          <img
            src="/images/WC26Badge.svg"
            alt=""
            className="w-5 h-5 object-contain"
          />
          <span>{tBadge("worldCup")}</span>
        </Link>
        <Link
          href="/bracket"
          className="flex-1 flex items-center justify-center gap-2 px-4 py-5 text-sm font-light text-white tracking-wide hover:bg-gray-900/20 transition-colors"
        >
          <img
            src="/images/specs/final.svg"
            alt=""
            className="w-5 h-5 object-contain"
          />
          <span>{tTabs("knockoutStage")}</span>
        </Link>
      </div>
    </div>
  );
}
