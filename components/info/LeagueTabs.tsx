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
  season?: number;
  /** When provided (even null), replaces the default BackButton + banner header. */
  renderHeader?: React.ReactNode;
}

function getLeagueCountry(leagueId: number): { flag: string | null; country: string | null } {
  switch (leagueId) {
    case League.PremierLeague:
      return { flag: "/images/flags/gb-eng.svg", country: "England" };
    case League.LaLiga:
      return { flag: "/images/flags/es.svg", country: "Spain" };
    case League.SerieA:
      return { flag: "/images/flags/it.svg", country: "Italy" };
    case League.Bundesliga:
      return { flag: "/images/flags/de.svg", country: "Germany" };
    case League.Ligue1:
      return { flag: "/images/flags/fr.svg", country: "France" };
    case League.MLS:
      return { flag: "/images/flags/us.svg", country: "United States" };
    case League.LigaMX:
      return { flag: "/images/flags/mx.svg", country: "Mexico" };
    default:
      return { flag: null, country: null };
  }
}

export default function LeagueTabs({
  standings,
  scorers,
  matches = [],
  leagueName,
  leagueLogo,
  leagueId,
  isTournament = false,
  season,
  renderHeader,
}: LeagueTabsProps) {
  const isUCL = leagueId === League.ChampionsLeague;
  const uclHasStandings = isUCL && standings.length > 0;

  const [activeTab, setActiveTab] = useState<TabType>(
    leagueId === League.WorldCup
      ? "scorers"
      : isUCL && !uclHasStandings
      ? "matches"
      : "table"
  );
  const tTabs = useTranslations("matchTabs");
  const tBadge = useTranslations("liveBadge");
  const tNav = useTranslations("quickNav");
  const { flag, country } = getLeagueCountry(leagueId);

  const tabs: { id: TabType; label: string }[] = leagueId === League.WorldCup
    ? [
        { id: "scorers", label: tTabs("topScorers") },
        ...(isTournament ? [{ id: "matches" as const, label: tTabs("matches") }] : []),
        { id: "table", label: tTabs("groupStage") },
        { id: "best3rd" as const, label: tTabs("bestThirdPlace") },
      ]
    : [
        ...(isUCL && !uclHasStandings ? [] : [{ id: "table" as const, label: tTabs("standings") }]),
        ...(scorers.length === 0 ? [] : [{ id: "scorers" as const, label: tTabs("topScorers") }]),
        ...(isTournament ? [{ id: "matches" as const, label: tTabs("matches") }] : []),
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
        <div className="flex items-center gap-3 p-4 bg-custom-gray rounded-xl border border-custom-gray-2">
          {isUCL ? (
            <Image
              src="/images/champions.svg"
              alt="Champions League"
              width={32}
              height={32}
              className="object-contain shrink-0"
            />
          ) : flag ? (
            <Image
              src={flag}
              alt={country ?? leagueName}
              width={28}
              height={20}
              className="rounded-sm object-cover shrink-0"
            />
          ) : null}
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">
              {leagueName}
            </h1>
            {isUCL ? (
              <p className="text-xs text-gray-400 mt-0.5">{tNav("leagueEurope")}</p>
            ) : country ? (
              <p className="text-xs text-gray-400 mt-0.5">{country}</p>
            ) : null}
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
            season={season}
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
