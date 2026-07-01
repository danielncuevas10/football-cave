"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import StandingsTable from "@/components/info/standings/page";
import TopScorers from "@/components/info/scorer/page";
import TournamentMatchesByDay from "@/components/info/TournamentMatchesByDay";
import WorldCupGroups from "@/components/WorldCupGroups";
import WorldCupBest3rd from "@/components/WorldCupBest3rd";
import { League } from "@/types/sports";
import type { DbStanding, DbTopScorer, DbMatch } from "@/types/sports";
import BackButton from "@/components/ui/BackButton";

type TabType = "table" | "best3rd" | "scorers" | "matches";

interface LeagueTabsProps {
  standings: DbStanding[];
  scorers: DbTopScorer[];
  matches?: DbMatch[];
  leagueName: string;
  leagueLogo: string | null;
  leagueId: number;
  isTournament?: boolean;
  /** When provided (even null), replaces the default BackButton + banner header. */
  renderHeader?: React.ReactNode;
}

export default function LeagueTabs({
  standings,
  scorers,
  matches = [],
  leagueName,
  leagueLogo,
  leagueId,
  isTournament = false,
  renderHeader,
}: LeagueTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>("table");
  const tTabs = useTranslations("matchTabs");
  const tBadge = useTranslations("liveBadge");

  const tabs: { id: TabType; label: string }[] = [
    {
      id: "table",
      label:
        leagueId === League.WorldCup ? tTabs("groupStage") : tTabs("standings"),
    },
    ...(leagueId === League.WorldCup
      ? [{ id: "best3rd" as const, label: tTabs("bestThirdPlace") }]
      : []),
    { id: "scorers", label: tTabs("topScorers") },
    ...(isTournament
      ? [{ id: "matches" as const, label: tTabs("matches") }]
      : []),
  ];

  const defaultHeader =
    leagueId === League.WorldCup ? (
      <>
        <div className="lg:hidden">
          <BackButton />
        </div>
        <div className="-mx-6 mt-.5 overflow-hidden relative lg:mx-0 lg:rounded-xl lg:mt-0!">
          <img
            src="/images/WC26.svg"
            alt="FIFA World Cup 2026"
            className="w-full h-auto object-cover"
          />
          <span className="absolute inset-0 flex items-center justify-center text-black text-[11px] lg:text-[18px] font-sans font-medium tracking-[0.5em] uppercase pointer-events-none">
            {tBadge("worldCup")}
          </span>
        </div>
      </>
    ) : (
      <>
        <BackButton />
        <div className="flex items-center gap-4 p-4 bg-custom-gray rounded-xl border border-custom-gray-2">
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
      </>
    );

  return (
    <div className="space-y-6 w-full text-white">
      {renderHeader !== undefined ? renderHeader : defaultHeader}

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
                  : "border-transparent text-gray-200 hover:text-white hover:bg-custom-gray/50"
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
            <WorldCupGroups standings={standings} showDropdown />
          ) : (
            <StandingsTable standings={standings ?? []} />
          )}
        </div>

        {leagueId === League.WorldCup && (
          <div
            className={`col-start-1 row-start-1 w-full ${
              activeTab === "best3rd" ? "" : "h-0 overflow-hidden"
            }`}
          >
            <WorldCupBest3rd standings={standings} />
          </div>
        )}

        <div
          className={`col-start-1 row-start-1 w-full ${
            activeTab === "scorers" ? "" : "h-0 overflow-hidden"
          }`}
        >
          <TopScorers
            scorers={scorers ?? []}
            isWorldCup={leagueId === League.WorldCup}
            leagueId={leagueId}
          />
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
