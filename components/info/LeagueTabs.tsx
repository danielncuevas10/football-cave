"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import StandingsTable from "@/components/info/standings/page";
import TopScorers from "@/components/info/scorer/page";
import TournamentMatchesByDay from "@/components/info/TournamentMatchesByDay";
import WorldCupGroups from "@/components/WorldCupGroups"; // 1. Added import
import { League } from "@/types/sports"; // 2. Added import to identify World Cup
import type { DbStanding, DbTopScorer, DbMatch } from "@/types/sports";

type TabType = "table" | "scorers" | "matches";

interface LeagueTabsProps {
  standings: DbStanding[];
  scorers: DbTopScorer[];
  matches?: DbMatch[];
  leagueName: string;
  leagueLogo: string | null;
  leagueId: number;
  isTournament?: boolean;
}

export default function LeagueTabs({
  standings,
  scorers,
  matches = [],
  leagueName,
  leagueLogo,
  leagueId, // 3. Destructured leagueId so it can be used below
  isTournament = false,
}: LeagueTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>("table");
  const tTabs = useTranslations("matchTabs");

  const tabs: { id: TabType; label: string }[] = [
    // 4. Dynamically change tab title for World Cup
    {
      id: "table",
      label:
        leagueId === League.WorldCup ? tTabs("groupStage") : tTabs("standings"),
    },
    { id: "scorers", label: tTabs("topScorers") },
    ...(isTournament
      ? [{ id: "matches" as const, label: tTabs("matches") }]
      : []),
  ];

  return (
    <div className="space-y-6 w-full text-white">
      {/* Header */}
      {leagueId === League.WorldCup ? (
        <div className="-mx-6 mt-1 overflow-hidden">
          <img
            src="/images/WC26.svg"
            alt="FIFA World Cup 2026"
            className="w-full h-auto object-cover"
          />
        </div>
      ) : (
        <div className="flex items-center gap-4 p-4 bg-custom-gray rrounded-md border border-custom-gray-2">
          {leagueLogo && (
            <Image
              src={leagueLogo}
              alt={leagueName}
              width={50}
              height={50}
              className="object-contain w-15 h-12"
            />
          )}
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">
              {leagueName}
            </h1>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex overflow-hidden">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 text-center py-3 text-xs font-light tracking-wider border-b transition-all duration-200 ${
                isActive
                  ? "border-white text-white"
                  : "border-transparent text-gray-200 hover:text-white hover:bg-gray-900/30"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Panels — stacked in the same grid cell so width never changes on tab switch */}
      <div className="grid w-full">
        <div
          className={`col-start-1 row-start-1 w-full ${
            activeTab === "table" ? "" : "h-0 overflow-hidden"
          }`}
        >
          {leagueId === League.WorldCup ? (
            <WorldCupGroups standings={standings} />
          ) : (
            <StandingsTable standings={standings ?? []} />
          )}
        </div>

        <div
          className={`col-start-1 row-start-1 w-full ${
            activeTab === "scorers" ? "" : "h-0 overflow-hidden"
          }`}
        >
          <TopScorers scorers={scorers ?? []} />
        </div>

        {isTournament && (
          <div
            className={`col-start-1 row-start-1 w-full ${
              activeTab === "matches" ? "" : "h-0 overflow-hidden"
            }`}
          >
            <TournamentMatchesByDay matches={matches} />
          </div>
        )}
      </div>
    </div>
  );
}
