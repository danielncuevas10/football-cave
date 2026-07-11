"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { supabase } from "@/lib/supabase";
import { resolveFlag } from "@/lib/flagUrl";
import { getFormStats } from "@/lib/server/getFormStats";
import type { DbMatch, FixtureStatus } from "@/types/sports";
import type { TeamFormStats } from "@/lib/server/getFormStats";

type TeamStats = TeamFormStats;

function isFlag(src: string): boolean {
  return src.includes("/flags/");
}

function isNationalTeamMatch(leagueId: number): boolean {
  const NATIONAL_TEAM_LEAGUES = [1, 4, 5, 6, 9, 10, 17, 25, 29, 30, 32, 34];
  return NATIONAL_TEAM_LEAGUES.includes(leagueId);
}

const FINISHED: FixtureStatus[] = ["FT", "AET", "PEN", "AWD", "WO"];

async function fetchH2H(
  homeLogo: string,
  awayLogo: string
): Promise<DbMatch[]> {
  const [a, b] = await Promise.all([
    supabase
      .from("matches")
      .select("*")
      .eq("home_logo", homeLogo)
      .eq("away_logo", awayLogo)
      .in("status", FINISHED)
      .order("fixture_date", { ascending: false })
      .limit(3),
    supabase
      .from("matches")
      .select("*")
      .eq("home_logo", awayLogo)
      .eq("away_logo", homeLogo)
      .in("status", FINISHED)
      .order("fixture_date", { ascending: false })
      .limit(3),
  ]);
  const all = [...(a.data ?? []), ...(b.data ?? [])];
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

function FlagImg({ src, isNational }: { src: string; isNational: boolean }) {
  if (!isNational) {
    return (
      <Image
        src={src}
        alt=""
        width={48}
        height={48}
        className="w-6 h-6 object-contain rounded-sm shrink-0"
      />
    );
  }
  if (isFlag(src)) {
    return (
      <div
        className="w-6 h-4 shrink-0 bg-cover bg-center bg-no-repeat border border-gray-300/30 rounded-tr-md rounded-bl-md"
        style={{ backgroundImage: `url(${resolveFlag(src)})` }}
      />
    );
  }
  return (
    <div className="w-6 h-4 overflow-hidden shrink-0 relative border border-gray-300/30 rounded-tr-md rounded-bl-md">
      <Image
        src={src}
        alt=""
        fill
        className="object-cover scale-[1.15]"
        sizes="24px"
      />
    </div>
  );
}

function TeamBadge({
  src,
  alt,
  isNational,
}: {
  src: string;
  alt: string;
  isNational: boolean;
}) {
  if (isFlag(src)) {
    const resolved = resolveFlag(src) ?? src;
    return (
      <div className="w-18 h-12 overflow-hidden shrink-0 relative border border-gray-300 rounded-tr-lg rounded-bl-lg">
        <Image
          src={resolved}
          alt={alt}
          fill
          className="object-cover scale-[1.15] will-change-transform"
          sizes="72px"
        />
      </div>
    );
  }
  if (!isNational) {
    return (
      <Image
        src={src}
        alt={alt}
        width={64}
        height={64}
        className="w-8 h-8 object-contain rounded-sm shrink-0"
      />
    );
  }
  return (
    <div className="w-8 h-5 overflow-hidden shrink-0 relative border border-gray-300 rounded-tr-sm rounded-bl-sm shadow-[0_1px_4px_rgba(0,0,0,0.4)]">
      <Image
        src={src}
        alt={alt}
        fill
        className="object-cover scale-[1.15] will-change-transform"
        sizes="24px"
      />
    </div>
  );
}

type TFunc = ReturnType<typeof useTranslations<"matchDetails">>;

function parseRound(round: string | null | undefined, t: TFunc): string | null {
  if (!round) return null;
  const r = round.toLowerCase();

  const matchdayMatch = r.match(/regular season\s*[-–]\s*(\d+)/);
  if (matchdayMatch)
    return t("roundMatchday", { n: parseInt(matchdayMatch[1]) });

  if (
    r.includes("reclasificacion") ||
    r.includes("wild card") ||
    r.includes("play-off") ||
    r.includes("playoff")
  )
    return t("roundPlayoff");
  if (
    r.includes("round of 32") ||
    r.includes("1/16-finals") ||
    r.includes("last 32")
  )
    return t("roundR32");
  if (r.includes("round of 16") || r.includes("last 16")) return t("roundR16");
  if (r.includes("quarter")) return t("roundQF");
  if (r.includes("semi")) return t("roundSF");
  if (r.includes("final") && !r.includes("semi") && !r.includes("quarter"))
    return t("roundFinal");
  if (r.includes("group")) return t("roundGroup");

  const roundNumMatch = r.match(
    /(?:(\d+)(?:st|nd|rd|th)?\s+round|round\s+(\d+))/
  );
  if (roundNumMatch) {
    const n = parseInt(roundNumMatch[1] ?? roundNumMatch[2]);
    return t("roundNumber", { n });
  }

  return null;
}

function H2HRow({
  match,
  homeLogoUrl,
  t,
}: {
  match: DbMatch;
  homeLogoUrl: string;
  t: TFunc;
}) {
  const isHomeAsHome = match.home_logo === homeLogoUrl;
  const homeScore = isHomeAsHome ? match.home_score : match.away_score;
  const awayScore = isHomeAsHome ? match.away_score : match.home_score;
  const homeLogo = isHomeAsHome ? match.home_logo : match.away_logo;
  const awayLogo = isHomeAsHome ? match.away_logo : match.home_logo;

  let chipBg = "#6B7280";
  if (homeScore != null && awayScore != null) {
    if (homeScore > awayScore) chipBg = "#34C759";
    else if (homeScore < awayScore) chipBg = "#C93434";
  }

  const dateStr = new Date(match.fixture_date).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const isNational = isNationalTeamMatch(match.league_id);
  const roundLabel = parseRound(match.round, t);

  return (
    <Link
      href={`/match/${match.id}`}
      className="relative flex items-center justify-center min-h-13 px-4 pt-3 pb-3.5 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors"
    >
      {/* league — top left */}
      <span className="absolute top-2 left-4 text-[10px] text-gray-500 truncate max-w-[42%] leading-tight">
        {(match.league_name ?? "").replace(/\bUEFA\b\s*/g, "")}
      </span>

      {/* round + date — top right */}
      <div className="absolute top-2 right-4 flex flex-col items-end">
        {roundLabel && (
          <span className="text-[10px] text-gray-400 font-medium leading-tight">
            {roundLabel}
          </span>
        )}
        <span className="text-[10px] text-gray-500 leading-tight">
          {dateStr}
        </span>
      </div>

      {/* badge · score · badge — centered */}
      <div className="flex items-center justify-center gap-4">
        {homeLogo ? (
          <FlagImg src={homeLogo} isNational={isNational} />
        ) : (
          <div className="w-6 h-6 shrink-0" />
        )}
        <span
          className="font-mono text-[13px] text-white tabular-nums shrink-0 rounded-lg border border-white/8 px-2.5 py-0.5"
          style={{ backgroundColor: chipBg }}
        >
          {homeScore}–{awayScore}
        </span>
        {awayLogo ? (
          <FlagImg src={awayLogo} isNational={isNational} />
        ) : (
          <div className="w-6 h-6 shrink-0" />
        )}
      </div>
    </Link>
  );
}

function StatRow({
  homeVal,
  label,
  awayVal,
}: {
  homeVal: string;
  label: string;
  awayVal: string;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-2 border-b border-white/5 last:border-0">
      <span className="text-[15px] font-semibold text-white tabular-nums text-right">
        {homeVal}
      </span>
      <span className="text-[10px] text-gray-200 tracking-wide text-center w-28 shrink-0">
        {label}
      </span>
      <span className="text-[15px] font-semibold text-white tabular-nums text-left">
        {awayVal}
      </span>
    </div>
  );
}

function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="bg-[#1C1C1E] rounded-[14px] border border-white/8 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] overflow-hidden animate-pulse">
      <div className="px-4 py-3 border-b border-white/5">
        <div className="h-3 w-28 bg-white/10 rounded mx-auto" />
      </div>
      <div className="divide-y divide-white/5">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-2 px-4 py-3">
            <div className="w-6 h-4 bg-white/10 rounded-sm" />
            <div className="flex-1 h-4 bg-white/10 rounded-lg mx-4" />
            <div className="w-6 h-4 bg-white/10 rounded-sm" />
          </div>
        ))}
      </div>
    </div>
  );
}

interface Props {
  homeLogoUrl: string | null;
  awayLogoUrl: string | null;
  homeTeamName: string;
  awayTeamName: string;
  leagueId: number;
}

export default function PreMatchStats({
  homeLogoUrl,
  awayLogoUrl,
  homeTeamName,
  awayTeamName,
  leagueId,
}: Props) {
  const t = useTranslations("matchDetails");

  const [loading, setLoading] = useState(true);
  const [h2h, setH2h] = useState<DbMatch[]>([]);
  const [homeStats, setHomeStats] = useState<TeamStats | null>(null);
  const [awayStats, setAwayStats] = useState<TeamStats | null>(null);

  useEffect(() => {
    if (!homeLogoUrl || !awayLogoUrl) {
      setLoading(false);
      return;
    }

    async function load() {
      const [h2hData, formStats] = await Promise.all([
        fetchH2H(homeLogoUrl!, awayLogoUrl!),
        getFormStats(homeLogoUrl!, awayLogoUrl!),
      ]);

      setH2h(h2hData);
      setHomeStats(formStats.home);
      setAwayStats(formStats.away);
      setLoading(false);
    }

    load();
  }, [homeLogoUrl, awayLogoUrl]);

  if (loading) {
    return (
      <div className="space-y-3">
        <SkeletonCard rows={3} />
        <SkeletonCard rows={4} />
      </div>
    );
  }

  const h2hSubtitle =
    h2h.length === 1
      ? t("h2hLast1")
      : h2h.length === 2
      ? t("h2hLast2")
      : t("h2hLast3");

  return (
    <div className="space-y-3">
      {/* H2H card — hidden if no meetings */}
      {h2h.length > 0 && (
        <div className="bg-[#1C1C1E] rounded-[14px] border border-white/8 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5 text-center">
            <p className="text-[11px] font-medium text-white tracking-wider">
              {t("h2hTitle")}
            </p>
            <p className="text-[10px] text-gray-500 mt-0.5">{h2hSubtitle}</p>
          </div>
          <div>
            {h2h.map((m) => (
              <H2HRow key={m.id} match={m} homeLogoUrl={homeLogoUrl!} t={t} />
            ))}
          </div>
        </div>
      )}

      {/* Form stats card */}
      {(homeStats || awayStats) && (
        <div className="bg-[#1C1C1E] rounded-[14px] border border-white/8 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] overflow-hidden">
          {/* Badge headers */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-3 border-b border-white/5">
            <div className="flex justify-end">
              {homeLogoUrl && (
                <TeamBadge
                  src={homeLogoUrl}
                  alt={homeTeamName}
                  isNational={isNationalTeamMatch(leagueId)}
                />
              )}
            </div>
            <span className="text-[10px] text-gray-200 tracking-wide text-center w-28 shrink-0">
              {t("formLast5")}
            </span>
            <div className="flex justify-start">
              {awayLogoUrl && (
                <TeamBadge
                  src={awayLogoUrl}
                  alt={awayTeamName}
                  isNational={isNationalTeamMatch(leagueId)}
                />
              )}
            </div>
          </div>

          <div className="px-4">
            <StatRow
              homeVal={homeStats ? homeStats.goalsScored.toFixed(1) : "–"}
              label={t("goalsScored")}
              awayVal={awayStats ? awayStats.goalsScored.toFixed(1) : "–"}
            />
            <StatRow
              homeVal={homeStats ? homeStats.goalsConceded.toFixed(1) : "–"}
              label={t("goalsConceded")}
              awayVal={awayStats ? awayStats.goalsConceded.toFixed(1) : "–"}
            />
            <StatRow
              homeVal={
                homeStats?.passAccuracy != null
                  ? `${homeStats.passAccuracy}%`
                  : "–"
              }
              label={t("passAccuracy")}
              awayVal={
                awayStats?.passAccuracy != null
                  ? `${awayStats.passAccuracy}%`
                  : "–"
              }
            />
            <StatRow
              homeVal={
                homeStats?.possession != null ? `${homeStats.possession}%` : "–"
              }
              label={t("avgPossession")}
              awayVal={
                awayStats?.possession != null ? `${awayStats.possession}%` : "–"
              }
            />
            <StatRow
              homeVal={homeStats ? String(homeStats.cleanSheets) : "–"}
              label={t("cleanSheets")}
              awayVal={awayStats ? String(awayStats.cleanSheets) : "–"}
            />
          </div>
        </div>
      )}
    </div>
  );
}
