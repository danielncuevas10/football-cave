"use client";
import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import type { DbTopScorer } from "@/types/sports";
import Image from "next/image";
import { supabase } from "@/lib/supabase";

// ─── Country localisation ─────────────────────────────────────────────────────

const APP_TO_BCP47: Record<string, string> = {
  ch: "zh",
  gr: "el",
  jp: "ja",
  kr: "ko",
};

const COUNTRY_ISO: Record<string, string> = {
  Germany: "DE",
  Brazil: "BR",
  France: "FR",
  Argentina: "AR",
  Hungary: "HU",
  Portugal: "PT",
  Netherlands: "NL",
  Italy: "IT",
  Uruguay: "UY",
  Spain: "ES",
  Mexico: "MX",
  "United States": "US",
  USA: "US",
  Canada: "CA",
  Belgium: "BE",
  Croatia: "HR",
  Serbia: "RS",
  Switzerland: "CH",
  Denmark: "DK",
  Morocco: "MA",
  Senegal: "SN",
  Ghana: "GH",
  Cameroon: "CM",
  Nigeria: "NG",
  "South Korea": "KR",
  Korea: "KR",
  Japan: "JP",
  Australia: "AU",
  "Saudi Arabia": "SA",
  Iran: "IR",
  Ecuador: "EC",
  Colombia: "CO",
  Chile: "CL",
  Peru: "PE",
  Venezuela: "VE",
  Bolivia: "BO",
  Paraguay: "PY",
  Turkey: "TR",
  Poland: "PL",
  "Czech Republic": "CZ",
  Czechia: "CZ",
  Austria: "AT",
  Ukraine: "UA",
  Romania: "RO",
  "Costa Rica": "CR",
  Panama: "PA",
  Honduras: "HN",
  Jamaica: "JM",
  "New Zealand": "NZ",
  Algeria: "DZ",
  Egypt: "EG",
  Tunisia: "TN",
  "Côte d'Ivoire": "CI",
  Mali: "ML",
  Qatar: "QA",
  "United Arab Emirates": "AE",
  Iraq: "IQ",
  Slovakia: "SK",
  Greece: "GR",
  Sweden: "SE",
  Norway: "NO",
  Russia: "RU",
  Indonesia: "ID",
  Thailand: "TH",
  China: "CN",
  Scotland: "GB",
  Wales: "GB",
  "United Kingdom": "GB",
};

const COUNTRY_OVERRIDES: Record<string, Partial<Record<string, string>>> = {
  England: {
    en: "England",
    es: "Inglaterra",
    fr: "Angleterre",
    pt: "Inglaterra",
    tr: "İngiltere",
    bs: "Engleska",
    sr: "Engleska",
    ch: "英格兰",
    gr: "Αγγλία",
    jp: "イングランド",
    kr: "잉글랜드",
  },
  "West Germany": {
    en: "West Germany",
    es: "Alemania Occidental",
    fr: "Allemagne de l'Ouest",
    pt: "Alemanha Ocidental",
    tr: "Batı Almanya",
    bs: "Zapadna Njemačka",
    sr: "Zapadna Nemačka",
    ch: "西德",
    gr: "Δυτική Γερμανία",
    jp: "西ドイツ",
    kr: "서독",
  },
};

function localizeCountryName(name: string, locale: string): string {
  const override = COUNTRY_OVERRIDES[name];
  if (override?.[locale]) return override[locale] as string;
  const iso = COUNTRY_ISO[name];
  if (!iso) return name;
  try {
    const bcp47 = APP_TO_BCP47[locale] ?? locale;
    return new Intl.DisplayNames([bcp47], { type: "region" }).of(iso) ?? name;
  } catch {
    return name;
  }
}

interface Props {
  scorers: DbTopScorer[];
  isWorldCup?: boolean;
  defaultView?: "current" | "allTime";
  channelId?: string;
  leagueId?: number;
  season?: number;
  teamLogos?: Record<string, string>;
}

// ─── All-time WC data ────────────────────────────────────────────────────────

// Historical goals scored BEFORE WC 2026.
// Players with a matchKey are still active and will have their WC 2026 goals
// added dynamically from the live `scorers` prop.
const BASE_ALL_TIME = [
  { name: "Miroslav Klose", country: "Germany", flag: "de", baseGoals: 16 },
  { name: "Ronaldo", country: "Brazil", flag: "br", baseGoals: 15 },
  { name: "Gerd Müller", country: "West Germany", flag: "de", baseGoals: 14 },
  {
    name: "Lionel Messi",
    country: "Argentina",
    flag: "ar",
    baseGoals: 13,
    matchKey: "messi",
  },
  { name: "Just Fontaine", country: "France", flag: "fr", baseGoals: 13 },
  {
    name: "Kylian Mbappé",
    country: "France",
    flag: "fr",
    baseGoals: 12,
    matchKey: "mbapp",
  },
  { name: "Pelé", country: "Brazil", flag: "br", baseGoals: 12 },
  { name: "Sándor Kocsis", country: "Hungary", flag: "hu", baseGoals: 11 },
  { name: "Jürgen Klinsmann", country: "Germany", flag: "de", baseGoals: 11 },
  { name: "Thomas Müller", country: "Germany", flag: "de", baseGoals: 10 },
  {
    name: "Cristiano Ronaldo",
    country: "Portugal",
    flag: "pt",
    baseGoals: 8,
    matchKey: "ronaldo",
    matchTeam: "portugal",
    knownWc2026Goals: 3,
  },
  {
    name: "Harry Kane",
    country: "England",
    flag: "gb-eng",
    baseGoals: 8,
    matchKey: "kane",
    knownWc2026Goals: 2,
  },
] as const;

type BasePlayer = (typeof BASE_ALL_TIME)[number];

// Find how many goals a player scored in WC 2026 from the live scorers list.
// knownWc2026Goals acts as a guaranteed floor for confirmed goals not yet in DB.
function findWc2026Goals(scorers: DbTopScorer[], player: BasePlayer): number {
  if (!("matchKey" in player)) return 0;
  const floor =
    "knownWc2026Goals" in player
      ? (player as { knownWc2026Goals: number }).knownWc2026Goals
      : 0;
  const key = (player as { matchKey: string }).matchKey.toLowerCase();
  const teamFilter =
    "matchTeam" in player
      ? (player as { matchTeam: string }).matchTeam.toLowerCase()
      : null;
  const found = scorers.find((s) => {
    const nameMatch = s.player_name.toLowerCase().includes(key);
    if (teamFilter)
      return (
        nameMatch && (s.team_name ?? "").toLowerCase().includes(teamFilter)
      );
    return nameMatch;
  });
  return Math.max(found?.goals ?? 0, floor);
}

// Assign ranks to a sorted-descending goals array (1, 2, 2, 4, …)
function assignRanks(goals: number[]): number[] {
  return goals
    .map((g, i) => {
      if (i === 0) return 1;
      return g === goals[i - 1] ? -1 : i + 1; // -1 = "same as previous"
    })
    .map((r, i, arr) => {
      if (r !== -1) return r;
      for (let j = i - 1; j >= 0; j--) if (arr[j] !== -1) return arr[j];
      return 1;
    });
}

function rankStr(rank: number, allRanks: number[]): string {
  return allRanks.filter((r) => r === rank).length > 1 ? `=${rank}` : `${rank}`;
}

// ─── Arrow SVG components ─────────────────────────────────────────────────────

function ArrowUp() {
  return (
    <svg width="14" height="10" viewBox="0 0 10 7" fill="none">
      <path
        d="M1 6L5 1.5L9 6"
        stroke="#4ade80"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowDown() {
  return (
    <svg width="14" height="10" viewBox="0 0 10 7" fill="none">
      <path
        d="M1 1.5L5 6L9 1.5"
        stroke="#ef4444"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowSame() {
  return (
    <span className="text-gray-200 font-bold text-[15px] leading-none">–</span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

function getPlayerPhoto(
  player: DbTopScorer,
  teamLogos: Record<string, string> = {}
): string {
  if (player.player_photo) return player.player_photo;
  if (
    player.player_name.toLowerCase().includes("ronaldo") &&
    (player.team_name ?? "").toLowerCase().includes("portugal")
  ) {
    return "/players/ronaldo.svg";
  }
  if (player.team_name && teamLogos[player.team_name]) {
    return teamLogos[player.team_name];
  }
  return "/images/placeholderPlayer.svg";
}

export default function TopScorers({
  scorers,
  isWorldCup = false,
  defaultView = "current",
  channelId = "top-scorers-live",
  leagueId: leagueIdProp,
  season,
  teamLogos = {},
}: Props) {
  const t = useTranslations("matchTabs");
  const tDetails = useTranslations("matchDetails");
  const locale = useLocale();
  const [isExpanded, setIsExpanded] = useState(false);
  const [view, setView] = useState<"current" | "allTime">(defaultView);
  const [liveScorers, setLiveScorers] = useState<DbTopScorer[]>(scorers);

  // Resolve league ID from prop or from the scorers data itself
  const effectiveLeagueId = leagueIdProp ?? scorers[0]?.league_id ?? null;

  useEffect(() => {
    setLiveScorers(scorers);
  }, [scorers]);

  // Fetch fresh scorers on mount so ISR-cached server data doesn't cause stale display.
  // When a season is provided, filter by it so off-season pages don't re-hydrate with stale data.
  useEffect(() => {
    if (!effectiveLeagueId) return;
    let query = supabase
      .from("top_scorers")
      .select("*")
      .eq("league_id", effectiveLeagueId)
      .gt("goals", 0)
      .order("goals", { ascending: false })
      .limit(20);
    if (season !== undefined) query = query.eq("season", season);
    query.then(({ data }) => {
      if (data && data.length > 0) setLiveScorers(data as DbTopScorer[]);
    });
  }, [effectiveLeagueId, season]);

  useEffect(() => {
    if (!effectiveLeagueId) return;
    // Each mount gets a UUID-suffixed channel name so simultaneous instances
    // (mobile + desktop LeagueTabs both in the DOM) and Strict Mode double-mounts
    // never share a Supabase channel — Date.now() isn't enough since both effects
    // fire within the same millisecond.
    const channel = supabase
      .channel(`${channelId}-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "top_scorers",
          filter: `league_id=eq.${effectiveLeagueId}`,
        },
        (payload) => {
          const updated = payload.new as DbTopScorer;
          if (!updated?.player_id) return;
          setLiveScorers((prev) => {
            const exists = prev.some((s) => s.player_id === updated.player_id);
            if (exists) {
              return [
                ...prev.map((s) =>
                  s.player_id === updated.player_id ? updated : s
                ),
              ].sort((a, b) => b.goals - a.goals);
            }
            if (updated.goals > 0) {
              return [...prev, updated].sort((a, b) => b.goals - a.goals);
            }
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [channelId, effectiveLeagueId]);

  if (!liveScorers || liveScorers.length === 0) {
    return (
      <div className="p-8 text-center text-gray-200 border border-custom-gray rounded-xl">
        {tDetails("comingSoon")}
        <img
          src="/images/specs/clock.svg"
          alt=""
          className="w-8 h-8 object-contain mx-auto mt-4"
        />
      </div>
    );
  }

  // ── All-time view ─────────────────────────────────────────────────────────

  // Build the combined list by adding live WC 2026 goals to each base player
  const withWc2026 = BASE_ALL_TIME.map((p) => ({
    ...p,
    wc2026Goals: findWc2026Goals(liveScorers, p),
    totalGoals: p.baseGoals + findWc2026Goals(liveScorers, p),
  }));

  // Base ranking (before WC 2026)
  const baseSorted = [...withWc2026].sort((a, b) => b.baseGoals - a.baseGoals);
  const baseRankNums = assignRanks(baseSorted.map((p) => p.baseGoals));
  const baseRankMap = new Map(
    baseSorted.map((p, i) => [p.name, baseRankNums[i]])
  );

  // New ranking (after WC 2026 goals added)
  const newSorted = [...withWc2026].sort((a, b) => b.totalGoals - a.totalGoals);
  const newRankNums = assignRanks(newSorted.map((p) => p.totalGoals));

  // ── Current scorers view ──────────────────────────────────────────────────

  const withGoals = liveScorers.filter((s) => s.goals > 0);
  const displayedScorers = isExpanded ? withGoals : withGoals.slice(0, 10);

  return (
    <>
      {/* View toggle — World Cup only */}
      {isWorldCup && (
        <div className="flex rounded-xl overflow-hidden bg-custom-gray mb-3">
          <button
            onClick={() => setView("current")}
            className={`flex-1 text-xs py-2.5 font-medium transition-colors ${
              view === "current"
                ? "bg-[#C5A059] text-black"
                : "text-white/60 hover:text-white"
            }`}
          >
            {t("wc26")}
          </button>
          <div className="w-px bg-gray-700/40 self-stretch" />
          <button
            onClick={() => setView("allTime")}
            className={`flex-1 text-xs py-2.5 font-medium transition-colors ${
              view === "allTime"
                ? "bg-[#C5A059] text-black"
                : "text-white/60 hover:text-white"
            }`}
          >
            {t("allTime")}
          </button>
        </div>
      )}

      {/* ── All-time list ── */}
      {view === "allTime" ? (
        <div className="w-full border-2 border-[#C5A059]/30 rounded-xl overflow-hidden bg-custom-gray-2">
          {/* Header */}
          <div className="flex items-center bg-custom-gray border-b border-gray-800/60 px-2 py-3 text-xs font-medium text-gray-200">
            <div className="w-8 text-center shrink-0">#</div>
            <div className="w-10 shrink-0 pl-1" />
            <div className="w-5 shrink-0" />
            <div className="flex-1 pl-1">Player</div>
            <div
              className="w-12 text-center font-bold text-white shrink-0"
              title={t("scorerGFull")}
            >
              {t("scorerGAbbr")}
            </div>
          </div>

          <div className="flex flex-col">
            {newSorted.map((player, i) => {
              const newRank = newRankNums[i];
              const isFirst = newRank === 1;
              const baseRank = baseRankMap.get(player.name) ?? newRank;
              const arrow =
                newRank < baseRank
                  ? "up"
                  : newRank > baseRank
                  ? "down"
                  : "same";

              return (
                <div
                  key={player.name}
                  className={`flex items-center transition-all relative ${
                    isFirst
                      ? "py-3.5 px-4 -mx-2 rounded-xl bg-zinc-900 shadow-xl shadow-[#C5A059]/10 border border-transparent bg-clip-padding before:absolute before:inset-0 before:rounded-xl before:border before:border-transparent before:bg-gradient-to-r before:from-[#C5A059] before:to-transparent before:[mask:linear-gradient(#fff_0_0)_padding-box,linear-gradient(#fff_0_0)] before:[mask-composite:exclude] before:pointer-events-none"
                      : "py-2.5 px-2 hover:bg-gray-800/30 border-b border-gray-800/50 z-0"
                  }`}
                >
                  <div
                    className={`w-8 text-center shrink-0 font-bold leading-none ${
                      isFirst
                        ? "text-gray-100 text-lg z-20"
                        : "text-gray-200 text-xs"
                    }`}
                  >
                    {rankStr(newRank, newRankNums)}
                  </div>
                  <div
                    className={`shrink-0 pl-1 transition-all ${
                      isFirst ? "w-12" : "w-10"
                    }`}
                  >
                    <div
                      className={`overflow-hidden shrink-0 block relative border border-gray-300 rounded-tr-lg rounded-bl-lg transition-all ${
                        isFirst ? "w-9 h-5" : "w-8 h-5"
                      }`}
                    >
                      <img
                        src={`/images/flags/${player.flag}.svg`}
                        alt={localizeCountryName(player.country, locale)}
                        className="w-full h-full object-cover scale-[1.15]"
                      />
                    </div>
                  </div>
                  <div className="w-8 shrink-0 flex items-center justify-center z-20">
                    {arrow === "up" ? (
                      <ArrowUp />
                    ) : arrow === "down" ? (
                      <ArrowDown />
                    ) : (
                      <ArrowSame />
                    )}
                  </div>
                  <div className="flex-1 pl-1 flex flex-col min-w-0">
                    <span
                      className={`leading-tight ${
                        isFirst
                          ? "text-md font-semibold text-black z-20"
                          : "text-xs font-light text-gray-100"
                      }`}
                    >
                      {player.name}
                    </span>
                    {player.wc2026Goals > 0 && (
                      <span
                        className={`text-[10px] text-[#4ade80]/70 font-light mt-0.5 z-20 ${
                          isFirst && "text-black"
                        }`}
                      >
                        +{player.wc2026Goals} WC26
                      </span>
                    )}
                  </div>
                  <div className="w-12 text-center shrink-0 z-30">
                    {isFirst ? (
                      <span className="inline-block text-[#C5A059] font-bold text-xl px-2.5 py-0.5 rounded-xl z-30">
                        {player.totalGoals}
                      </span>
                    ) : (
                      <span className="font-bold text-white text-xs sm:text-sm">
                        {player.totalGoals}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ── Current edition scorers ── */
        <>
          <div className="flex items-center gap-3 px-3 py-2 text-[9px] lg:text-[12px] text-gray-200">
            <span>
              <span className="text-gray-200 font-bold">
                {t("scorerMpAbbr")}
              </span>
              : {t("scorerMpFull")}
            </span>
            <span className="text-gray-800">·</span>
            <span>
              <span className="text-gray-200 font-bold">
                {t("scorerAAbbr")}
              </span>
              : {t("scorerAFull")}
            </span>
            <span className="text-gray-800">·</span>
            <span>
              <span className="text-gray-200 font-bold">
                {t("scorerGAbbr")}
              </span>
              : {t("scorerGFull")}
            </span>
          </div>

          <div className="w-full bg-custom-gray-2 rounded-xl overflow-hidden">
            <table className="w-full text-sm text-left text-gray-200 table-fixed">
              <thead className="text-xs text-gray-200 bg-custom-gray border-b border-custom-gray">
                <tr>
                  <th className="px-2 py-3 font-medium w-12 text-center">#</th>
                  <th className="px-2 py-3 font-medium">Player</th>
                  <th
                    className="px-1 py-3 font-medium text-center w-8 sm:w-12"
                    title={t("scorerMpFull")}
                  >
                    {t("scorerMpAbbr")}
                  </th>
                  <th
                    className="px-1 py-3 font-medium text-center w-8 sm:w-12"
                    title={t("scorerAFull")}
                  >
                    {t("scorerAAbbr")}
                  </th>
                  <th
                    className="px-1 py-3 font-bold text-white text-center w-8 sm:w-12"
                    title={t("scorerGFull")}
                  >
                    {t("scorerGAbbr")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayedScorers.map((player, index) => (
                  <tr
                    key={player.player_id}
                    className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
                  >
                    <td className="px-2 py-3 text-center font-medium text-gray-200 w-8">
                      {index + 1}
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-2">
                        <Image
                          src={getPlayerPhoto(player, teamLogos)}
                          alt={player.player_name}
                          width={25}
                          height={25}
                          className="object-contain rounded-full bg-gray-800 shrink-0"
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="font-light text-xs text-gray-100 leading-tight wrap-break-word">
                            {player.player_name}
                          </span>
                          <span className="text-xs text-gray-200/40 font-light truncate mt-0.5">
                            {localizeCountryName(
                              player.team_name ?? "",
                              locale
                            )}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-1 py-3 text-center text-gray-200 w-8 sm:w-12 text-xs">
                      {player.appearances}
                    </td>
                    <td className="px-1 py-3 text-center text-gray-200 w-8 sm:w-12 text-xs">
                      {player.assists ?? 0}
                    </td>
                    <td className="px-1 py-3 text-center font-bold text-white w-8 sm:w-12 text-xs sm:text-sm">
                      {player.goals}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {withGoals.length > 10 && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full py-3 bg-custom-gray hover:bg-gray-800/60 text-xs font-semibold text-gray-200 hover:text-white flex items-center justify-center gap-2 border-t border-custom-gray transition-colors will-change-transform"
              >
                {isExpanded ? (
                  <>
                    {t("seeLess")}
                    <img
                      src="/images/specs/arrow.svg"
                      alt=""
                      className="w-3.5 h-3.5 object-contain rotate-180"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = "/images/specs/arrow.jpg";
                      }}
                    />
                  </>
                ) : (
                  <>
                    {t("seeMore")}
                    <img
                      src="/images/specs/arrow.svg"
                      alt=""
                      className="w-3.5 h-3.5 object-contain"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = "/images/specs/arrow.jpg";
                      }}
                    />
                  </>
                )}
              </button>
            )}
          </div>
        </>
      )}
    </>
  );
}
