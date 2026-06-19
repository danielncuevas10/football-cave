"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { DbMatch, DbStanding } from "@/types/sports";
import WorldCupBest3rd from "@/components/WorldCupBest3rd";
import FullBracket from "./FullBracket";

type Tab = "bracket" | "best3rd";

interface BracketPanelProps {
  wcMatches: DbMatch[];
  wcStandings: DbStanding[];
}

export default function BracketPanel({ wcMatches, wcStandings }: BracketPanelProps) {
  const t = useTranslations("matchTabs");
  const [activeTab, setActiveTab] = useState<Tab>("bracket");

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b border-custom-gray shrink-0">
        {(["bracket", "best3rd"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 text-[11px] font-semibold uppercase tracking-widest transition-colors ${
              activeTab === tab
                ? "text-white border-b-2 border-white -mb-px"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {tab === "bracket" ? t("bracketTab") : t("bestThirdPlace")}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pt-3">
        {activeTab === "bracket" ? (
          <FullBracket
            matches={wcMatches}
            standings={wcStandings}
            showFullBracketLink
          />
        ) : (
          <WorldCupBest3rd standings={wcStandings} />
        )}
      </div>
    </div>
  );
}
