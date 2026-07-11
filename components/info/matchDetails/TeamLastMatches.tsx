"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { supabase } from "@/lib/supabase";
import { getLocalizedTeamName } from "@/lib/teamName";
import type { DbMatch, FixtureStatus } from "@/types/sports";

const FINISHED_STATUSES: FixtureStatus[] = ["FT", "AET", "PEN", "AWD", "WO"];

function isNationalTeamMatch(leagueId: number): boolean {
  const NATIONAL_TEAM_LEAGUES = [1, 4, 5, 6, 9, 10, 17, 25, 29, 30, 32, 34];
  return NATIONAL_TEAM_LEAGUES.includes(leagueId);
}

function getResult(
  match: DbMatch,
  teamLogoUrl: string
): "W" | "D" | "L" | null {
  if (match.home_score === null || match.away_score === null) return null;
  const isHome = match.home_logo === teamLogoUrl;
  const myScore = isHome ? match.home_score : match.away_score;
  const theirScore = isHome ? match.away_score : match.home_score;
  if (myScore > theirScore) return "W";
  if (myScore < theirScore) return "L";
  return "D";
}

function resultColor(result: "W" | "D" | "L" | null): string {
  if (result === "W") return "#34C759";
  if (result === "L") return "#C93434";
  return "#6B7280";
}

async function fetchLastMatches(logoUrl: string): Promise<DbMatch[]> {
  const [homeRes, awayRes] = await Promise.all([
    supabase
      .from("matches")
      .select("*")
      .eq("home_logo", logoUrl)
      .in("status", FINISHED_STATUSES)
      .order("fixture_date", { ascending: false })
      .limit(3),
    supabase
      .from("matches")
      .select("*")
      .eq("away_logo", logoUrl)
      .in("status", FINISHED_STATUSES)
      .order("fixture_date", { ascending: false })
      .limit(3),
  ]);

  const all = [...(homeRes.data ?? []), ...(awayRes.data ?? [])];
  const seen = new Set<number>();
  return all
    .filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    })
    .sort(
      (a, b) =>
        new Date(b.fixture_date).getTime() - new Date(a.fixture_date).getTime()
    )
    .slice(0, 3);
}

function FlagImg({ src, alt, isNational }: { src: string; alt: string; isNational: boolean }) {
  if (isNational) {
    return (
      <div className="w-6 h-4 overflow-hidden shrink-0 relative border border-gray-300 rounded-tr-md rounded-bl-md shadow-[0_1px_4px_rgba(0,0,0,0.4)]">
        <Image
          src={src}
          alt={alt}
          fill
          className="object-cover will-change-transform scale-[1.15]"
          sizes="24px"
        />
      </div>
    );
  }
  return <Image src={src} alt={alt} width={48} height={48} className="w-6 h-6 object-contain rounded-sm shrink-0" />;
}

function MatchRow({
  match,
  teamLogoUrl,
}: {
  match: DbMatch;
  teamLogoUrl: string;
}) {
  const result = getResult(match, teamLogoUrl);

  const color = resultColor(result);

  return (
    <Link
      href={`/match/${match.id}`}
      className="flex items-center justify-between gap-1.5 py-2 px-5 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
    >
      {match.home_logo ? (
        <FlagImg src={match.home_logo} alt="" isNational={isNationalTeamMatch(match.league_id)} />
      ) : (
        <div className="w-6 h-4 shrink-0" />
      )}
      <span
        className="font-mono text-[11px] text-white tabular-nums shrink-0 rounded-lg border border-white/8 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] px-2 py-0.5"
        style={{ backgroundColor: color }}
      >
        {match.home_score}–{match.away_score}
      </span>
      {match.away_logo ? (
        <FlagImg src={match.away_logo} alt="" isNational={isNationalTeamMatch(match.league_id)} />
      ) : (
        <div className="w-6 h-4 shrink-0" />
      )}
    </Link>
  );
}

interface Props {
  homeLogoUrl: string | null;
  awayLogoUrl: string | null;
  homeTeamName: string;
  awayTeamName: string;
}

export default function TeamLastMatches({
  homeLogoUrl,
  awayLogoUrl,
  homeTeamName,
  awayTeamName,
}: Props) {
  const tTeam = useTranslations("teamPage");
  const locale = useLocale();
  const [homeMatches, setHomeMatches] = useState<DbMatch[] | null>(null);
  const [awayMatches, setAwayMatches] = useState<DbMatch[] | null>(null);

  useEffect(() => {
    Promise.all([
      homeLogoUrl ? fetchLastMatches(homeLogoUrl) : Promise.resolve([]),
      awayLogoUrl ? fetchLastMatches(awayLogoUrl) : Promise.resolve([]),
    ]).then(([home, away]) => {
      setHomeMatches(home);
      setAwayMatches(away);
    });
  }, [homeLogoUrl, awayLogoUrl]);

  const loading = homeMatches === null || awayMatches === null;

  return (
    <div className="bg-[#1C1C1E] rounded-[14px] border border-white/8 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] p-4 space-y-3">
      <p className="text-[11px] text-gray-200 tracking-wider font-semibold text-center pb-5">
        {tTeam("lastMatches")}
      </p>

      <div className="grid grid-cols-2 gap-5">
        {/* Home team column */}
        <div className="space-y-1">
          {loading ? (
            <div className=" space-y-1">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-1.5 px-2 py-2">
                  <div className="w-6 h-4 bg-white/10 rounded-sm" />
                  <div className="w-10 h-5 bg-white/10 rounded-[14px] mx-auto" />
                  <div className="w-6 h-4 bg-white/10 rounded-sm" />
                </div>
              ))}
            </div>
          ) : homeMatches && homeMatches.length > 0 ? (
            homeMatches.map((m) => (
              <MatchRow key={m.id} match={m} teamLogoUrl={homeLogoUrl!} />
            ))
          ) : (
            <p className="px-2 py-3 text-[11px] text-gray-600 text-center">–</p>
          )}
        </div>

        {/* Away team column */}
        <div className="space-y-1">
          {loading ? (
            <div className="animate-pulse space-y-1">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-1.5 px-2 py-2">
                  <div className="w-6 h-4 bg-white/10 rounded-sm" />
                  <div className="w-10 h-5 bg-white/10 rounded-[14px] mx-auto" />
                  <div className="w-6 h-4 bg-white/10 rounded-sm" />
                </div>
              ))}
            </div>
          ) : awayMatches && awayMatches.length > 0 ? (
            awayMatches.map((m) => (
              <MatchRow key={m.id} match={m} teamLogoUrl={awayLogoUrl!} />
            ))
          ) : (
            <p className="px-2 py-3 text-[11px] text-gray-600 text-center">–</p>
          )}
        </div>
      </div>
    </div>
  );
}
