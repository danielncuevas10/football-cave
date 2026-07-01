"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { DbMatch, DbStanding, DbTopScorer } from "@/types/sports";
import WorldCupBest3rd from "@/components/WorldCupBest3rd";
import WorldCupGroups from "@/components/WorldCupGroups";
import TopScorers from "@/components/info/scorer/page";
import MatchCarousel from "./MatchCarousel";
import type { GoalsMap } from "./BracketPanelServer";

type Tab = "wc26" | "matches" | "scorers" | "best3rd";

interface BracketPanelProps {
  wcMatches: DbMatch[];
  wcStandings: DbStanding[];
  wcScorers: DbTopScorer[];
  venues: Record<number, { name: string | null; city: string | null }>;
  goals: GoalsMap;
}

export default function BracketPanel({
  wcMatches,
  wcStandings,
  wcScorers,
  venues,
  goals,
}: BracketPanelProps) {
  const t = useTranslations("matchTabs");
  const [activeTab, setActiveTab] = useState<Tab>("matches");

  const tabs: { id: Tab; label: string }[] = [
    { id: "matches", label: t("matches") },
    { id: "wc26", label: t("wc26") },
    { id: "scorers", label: t("allTime") },
    { id: "best3rd", label: t("bestThirdPlace") },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Tab bar */}
      <div className="flex border-b border-custom-gray shrink-0 pt-5 mb-5 mt-1 px-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-3.5 text-[10px] font-light tracking-widest transition-colors cursor-pointer ${
              activeTab === tab.id
                ? "text-white border-b border-white -mb-px"
                : "text-gray-500 hover:text-gray-300 hover:bg-custom-gray/50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content — Matches tab fills height; other tabs scroll independently */}
      <div className="flex-1 min-h-0 flex flex-col pt-3">
        {activeTab === "matches" && (
          <MatchCarousel matches={wcMatches} venues={venues} goals={goals} />
        )}
        {activeTab === "wc26" && (
          <div className="flex-1 overflow-y-auto">
            <WorldCupGroups standings={wcStandings} />
          </div>
        )}
        {activeTab === "scorers" && (
          <div className="flex-1 overflow-y-auto">
            <TopScorers scorers={wcScorers} isWorldCup defaultView="allTime" leagueId={1} />
          </div>
        )}
        {activeTab === "best3rd" && (
          <div className="flex-1 overflow-y-auto">
            <WorldCupBest3rd standings={wcStandings} />
          </div>
        )}
      </div>
    </div>
  );
}
