"use client";

import { useState, useEffect } from "react";
import { useLiveScores } from "@/hooks/useLiveScores";
import { useTranslations, useLocale } from "next-intl";
import { supabase } from "@/lib/supabase";
import MatchCard from "./MatchCard";
import WcPlaceholderCard from "./WcPlaceholderCard";
import type { DbMatch } from "@/types/sports";
import { LIVE_STATUSES } from "@/types/sports";
import Link from "next/link";
import { getWcRoundKey } from "@/lib/wcRoundLabel";
import { cleanLeagueName } from "@/lib/teamName";

// Ordered list: World Cup → UCL → La Liga → Premier League → MLS → Liga MX
const DISPLAY_LEAGUE_IDS = [1, 2, 140, 39, 253, 262];

type WcPlaceholderKey =
  | "sf1Home" | "sf1Away"
  | "sf2Home" | "sf2Away"
  | "loserSF1" | "loserSF2"
  | "winnerSF1" | "winnerSF2";

interface WcPlaceholderMatch {
  homeKey: WcPlaceholderKey;
  awayKey: WcPlaceholderKey;
  time: string;
  roundKey: "wcroundSF" | "wcroundThird" | "wcroundFinal";
}

const WC_PLACEHOLDER_BY_DATE: Record<string, WcPlaceholderMatch[]> = {
  "2026-07-14": [{ homeKey: "sf1Home", awayKey: "sf1Away", time: "21:00", roundKey: "wcroundSF" }],
  "2026-07-15": [{ homeKey: "sf2Home", awayKey: "sf2Away", time: "21:00", roundKey: "wcroundSF" }],
  "2026-07-18": [{ homeKey: "loserSF1", awayKey: "loserSF2", time: "23:00", roundKey: "wcroundThird" }],
  "2026-07-19": [{ homeKey: "winnerSF1", awayKey: "winnerSF2", time: "21:00", roundKey: "wcroundFinal" }],
};

const LEAGUE_NAME_OVERRIDES: Record<number, string> = {
  2: "Champions League",
};

function getDisplayLeagueName(leagueId: number | undefined, apiName: string): string {
  if (leagueId === undefined) return apiName;
  return LEAGUE_NAME_OVERRIDES[leagueId] ?? apiName;
}

function getMatchdayLabel(round: string | null | undefined): string | null {
  if (!round) return null;
  const numMatch = round.match(/[-–]\s*(\d+)$/);
  if (numMatch) return `Matchday ${numMatch[1]}`;
  const dashIdx = round.indexOf(" - ");
  if (dashIdx !== -1) return round.slice(dashIdx + 3);
  return round;
}

function getLeagueIcon(leagueId: number | undefined): { src: string; isWc: boolean } | null {
  switch (leagueId) {
    case 1:   return { src: "/images/WC26Badge.svg", isWc: true };
    case 39:  return { src: "/images/flags/gb-eng.svg", isWc: false };
    case 140: return { src: "/images/flags/es.svg", isWc: false };
    case 253: return { src: "/images/flags/us.svg", isWc: false };
    case 262: return { src: "/images/flags/mx.svg", isWc: false };
    default:  return null;
  }
}

interface Props {
  initialMatches: DbMatch[];
}

const LOCALE_MAP: Record<string, string> = {
  en: "en-GB",
  es: "es-ES",
  fr: "fr-FR",
  pt: "pt-PT",
  bs: "bs-BA",
  sr: "sr-Latn",
  ch: "zh-CN",
  gr: "el-GR",
  jp: "ja-JP",
  kr: "ko-KR",
  tr: "tr-TR",
};

function getCustomDisplayDate(
  targetDate: Date,
  labels: { today: string; yesterday: string; tomorrow: string },
  locale: string
): string {
  const today = new Date();
  const normalize = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const target = normalize(targetDate);
  const current = normalize(today);
  const diffDays = Math.round(
    (target.getTime() - current.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays === 0) return labels.today;
  if (diffDays === -1) return labels.yesterday;
  if (diffDays === 1) return labels.tomorrow;
  const isSameYear = target.getFullYear() === current.getFullYear();
  return target.toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(isSameYear ? {} : { year: "numeric" }),
  });
}

export default function ScoreList({ initialMatches }: Props) {
  const tDate = useTranslations("dateLabels");
  const tTabs = useTranslations("matchTabs");
  const appLocale = useLocale();
  const bcp47 = LOCALE_MAP[appLocale] ?? "en-GB";
  const { matches: liveMatches } = useLiveScores();
  const [allMatches, setAllMatches] = useState(initialMatches);
  const [dateLoading, setDateLoading] = useState(false);

  // Realtime: update existing rows in state as cron writes come in
  useEffect(() => {
    const channel = supabase
      .channel("scorelist-updates")
      .on<DbMatch>(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "matches" },
        (payload) => {
          const updated = payload.new as DbMatch;
          if (!DISPLAY_LEAGUE_IDS.includes(updated.league_id)) return;
          setAllMatches((prev) => {
            const idx = prev.findIndex((m) => m.id === updated.id);
            if (idx !== -1) {
              const next = [...prev];
              next[idx] = updated;
              return next;
            }
            return [...prev, updated];
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const [currentDate, setCurrentDate] = useState(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });

  // Fetch matches for the selected date whenever the user navigates
  useEffect(() => {
    const todayStr = new Date().toDateString();
    if (currentDate.toDateString() === todayStr) return; // server already provided today

    const start = new Date(currentDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(currentDate);
    end.setHours(23, 59, 59, 999);

    setDateLoading(true);
    supabase
      .from("matches")
      .select("*")
      .in("league_id", DISPLAY_LEAGUE_IDS)
      .gte("fixture_date", start.toISOString())
      .lte("fixture_date", end.toISOString())
      .order("fixture_date", { ascending: true })
      .then(({ data }) => {
        if (data) {
          setAllMatches((prev) => {
            const dateStr = currentDate.toDateString();
            const other = prev.filter(
              (m) => new Date(m.fixture_date).toDateString() !== dateStr
            );
            return [...other, ...data];
          });
        }
        setDateLoading(false);
      });
  }, [currentDate]);

  const prevDay = () => {
    const prev = new Date(currentDate);
    prev.setDate(prev.getDate() - 1);
    setCurrentDate(prev);
  };

  const nextDay = () => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + 1);
    setCurrentDate(next);
  };

  const liveIds = new Set(liveMatches.map((m) => m.id));
  const merged = [
    ...liveMatches,
    ...allMatches.filter((m) => !liveIds.has(m.id)),
  ]
    .sort((a, b) => {
      const d =
        new Date(a.fixture_date).getTime() - new Date(b.fixture_date).getTime();
      return d !== 0 ? d : a.id - b.id;
    });

  // A match is live if the DB says so OR if its status is an active live status.
  // This catches matches where is_live was not written correctly by the cron.
  const isMatchLive = (m: DbMatch) =>
    m.is_live || LIVE_STATUSES.includes(m.status);

  // Filter ALL matches down to the selected calendar day.
  // Exception: live matches that kicked off before midnight always surface on
  // today's view so users don't have to navigate to "yesterday" to find them.
  const isViewingToday =
    currentDate.toDateString() === new Date().toDateString();

  const matchesForDate = merged.filter((m) => {
    if (isViewingToday && isMatchLive(m)) return true;
    const matchDate = new Date(m.fixture_date);
    return (
      matchDate.getDate() === currentDate.getDate() &&
      matchDate.getMonth() === currentDate.getMonth() &&
      matchDate.getFullYear() === currentDate.getFullYear()
    );
  });

  const live = matchesForDate.filter(isMatchLive);
  const scheduledOrFinished = matchesForDate.filter((m) => !isMatchLive(m));

  const displayDate = getCustomDisplayDate(
    currentDate,
    {
      today: tDate("today"),
      yesterday: tDate("yesterday"),
      tomorrow: tDate("tomorrow"),
    },
    bcp47
  );

  // Group scheduled and finished matches by league
  const matchesByLeague = scheduledOrFinished.reduce((acc, match) => {
    const league = cleanLeagueName(match.league_name) || "Unknown League";
    if (!acc[league]) acc[league] = [];
    acc[league].push(match);
    return acc;
  }, {} as Record<string, DbMatch[]>);

  // WC knockout placeholder logic
  const dateKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}-${String(currentDate.getDate()).padStart(2, "0")}`;
  const wcPlaceholders = WC_PLACEHOLDER_BY_DATE[dateKey] ?? [];
  const hasRealWcMatch = matchesForDate.some(
    (m) =>
      m.league_id === 1 &&
      !m.home_team.toLowerCase().includes("winner") &&
      !m.home_team.toLowerCase().includes("loser") &&
      m.home_team !== "TBD"
  );
  const showWcPlaceholder = wcPlaceholders.length > 0 && !hasRealWcMatch;

  // Group live matches by league dynamically to match design container structure
  const liveMatchesByLeague = live.reduce((acc, match) => {
    const league = cleanLeagueName(match.league_name) || "Unknown League";
    if (!acc[league]) acc[league] = [];
    acc[league].push(match);
    return acc;
  }, {} as Record<string, DbMatch[]>);

  const sortLeagueEntries = (entries: [string, DbMatch[]][]) =>
    entries.sort((a, b) => {
      const idA = a[1][0]?.league_id ?? 999;
      const idB = b[1][0]?.league_id ?? 999;
      const rankA = DISPLAY_LEAGUE_IDS.indexOf(idA);
      const rankB = DISPLAY_LEAGUE_IDS.indexOf(idB);
      return (rankA === -1 ? 999 : rankA) - (rankB === -1 ? 999 : rankB);
    });

  return (
    <div className="space-y-6">
      {/* Date Navigation Bar */}
      <div className="flex flex-col gap-0 items-center justify-between bg-custom-gray p-3 rounded-xl border-b border-white/7 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
        <div className="flex items-center justify-between w-full gap-4">
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={prevDay}
              className="flex flex-col items-center gap-0.5 p-2 text-sm bg-custom-gray hover:bg-custom-gray/50 rounded-2xl text-gray-200 hover:text-white transition-colors cursor-pointer"
            >
              <img
                src="/images/specs/arrow.svg"
                alt="Previous Day"
                className="w-4.5 h-4.5 object-contain -rotate-270"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = "/images/specs/arrow.jpg";
                }}
              />
            </button>
          </div>

          <div className="flex items-center gap-2 text-sm font-bold text-white select-none">
            <span>{displayDate}</span>

            <button
              type="button"
              onClick={() =>
                (
                  document.getElementById("date-input") as HTMLInputElement
                )?.showPicker?.()
              }
              className="text-white"
            >
              <img
                src="/images/specs/calendar.svg"
                alt="Select Date"
                className="w-2 h-2 object-contain"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = "/images/specs/arrow.jpg";
                }}
              />
            </button>

            <input
              id="date-input"
              type="date"
              value={currentDate.toISOString().split("T")[0]}
              onChange={(e) => {
                const [y, m, d] = e.target.value.split("-").map(Number);
                setCurrentDate(new Date(y, m - 1, d));
              }}
              className="absolute opacity-0 w-0 h-0"
            />
          </div>
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={nextDay}
              className="flex flex-col items-center gap-0.5 p-2 text-sm bg-custom-gray hover:bg-custom-gray/50 rounded-2xl text-gray-200 hover:text-white transition-colors cursor-pointer"
            >
              <img
                src="/images/specs/arrow.svg"
                alt="Next Day"
                className="w-4.5 h-4.5 object-contain rotate-270"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = "/images/specs/arrow.jpg";
                }}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Live Matches Section Wrapped in League Design Blocks */}
      {live.length > 0 && (
        <section className="space-y-4">
          <div className="space-y-6">
            {sortLeagueEntries(Object.entries(liveMatchesByLeague)).map(
              ([leagueName, matches]) => {
                const leagueId = matches[0]?.league_id;

                return (
                  <div
                    key={`live-${leagueName}`}
                    className="bg-custom-gray rounded-xl overflow-hidden border border-white/8 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                  >
                    {leagueId ? (
                      <Link
                        href={`/league/${leagueId}`}
                        className="relative flex items-center justify-start px-4 gap-3 py-4 border-b border-[#38383A] hover:bg-gray-900/20 transition-colors"
                      >
                        {(() => {
                          const icon = getLeagueIcon(leagueId);
                          if (!icon) return null;
                          return icon.isWc
                            ? <img src={icon.src} alt="FIFA World Cup 2026" className="w-5 h-5 object-contain shrink-0" />
                            : <img src={icon.src} alt="" className="w-5 h-3.5 object-cover rounded-xs shrink-0" />;
                        })()}
                        <h3 className="text-[15px] font-bold text-white tracking-wider">
                          {getDisplayLeagueName(leagueId, leagueName)}
                        </h3>
                        {(() => {
                          if (leagueId === 1) {
                            const key = getWcRoundKey(matches[0]?.round);
                            return key ? (
                              <span className="absolute right-3 text-[12px] text-gray-200 font-bold tracking-wide">
                                {tTabs(key)}
                              </span>
                            ) : null;
                          }
                          const label = getMatchdayLabel(matches[0]?.round);
                          return label ? (
                            <span className="absolute right-3 text-[12px] text-gray-200 font-bold tracking-wide">
                              {label}
                            </span>
                          ) : null;
                        })()}
                      </Link>
                    ) : (
                      <div className="flex items-center justify-start px-4 gap-3 py-4 border-b border-gray-800/40">
                        <h3 className="text-[15px] font-bold text-gray-200 tracking-wider">
                          {leagueName}
                        </h3>
                      </div>
                    )}

                    <div>
                      {matches.map((m: DbMatch, index: number) => (
                        <div
                          key={m.id}
                          className={`${
                            index === matches.length - 1
                              ? "rounded-b-lg"
                              : "border-b border-white/4"
                          }`}
                        >
                          <MatchCard match={m} />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }
            )}
          </div>
        </section>
      )}

      {/* WC knockout placeholder section */}
      {showWcPlaceholder && (
        <section>
          <div className="space-y-6">
            <div className="bg-custom-gray rounded-xl overflow-hidden border border-white/8 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <div className="relative flex items-center justify-start px-4 gap-3 py-4 border-b border-[#38383A]">
                <img src="/images/WC26Badge.svg" alt="FIFA World Cup 2026" className="w-5 h-5 object-contain shrink-0" />
                <h3 className="text-[15px] font-bold text-white tracking-wider">
                  {tTabs("wc26")}
                </h3>
                <span className="absolute right-3 text-[12px] text-gray-200 font-bold tracking-wide">
                  {tTabs(wcPlaceholders[0].roundKey)}
                </span>
              </div>
              <div>
                {wcPlaceholders.map((p, index) => (
                  <WcPlaceholderCard
                    key={`${p.homeKey}-${p.awayKey}`}
                    homeKey={p.homeKey}
                    awayKey={p.awayKey}
                    time={p.time}
                    isLast={index === wcPlaceholders.length - 1}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* FIX: Render Scheduled/Finished Matches section only if they exist */}
      {Object.keys(matchesByLeague).length > 0 && (
        <section>
          <div className="space-y-6">
            {sortLeagueEntries(Object.entries(matchesByLeague)).map(([leagueName, matches]) => {
              const leagueId = matches[0]?.league_id;

              return (
                <div
                  key={leagueName}
                  className="bg-custom-gray rounded-xl overflow-hidden border border-white/8 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                >
                  {leagueId ? (
                    <Link
                      href={`/league/${leagueId}`}
                      className="relative flex items-center justify-start px-4 gap-3 py-4 hover:bg-gray-900/20 transition-colors"
                    >
                      {(() => {
                        const icon = getLeagueIcon(leagueId);
                        if (!icon) return null;
                        return icon.isWc
                          ? <img src={icon.src} alt="FIFA World Cup 2026" className="w-5 h-5 object-contain shrink-0" />
                          : <img src={icon.src} alt="" className="w-5 h-3.5 object-cover rounded-xs shrink-0" />;
                      })()}
                      <h3 className="text-[15px] font-bold text-white tracking-wider">
                        {getDisplayLeagueName(leagueId, leagueName)}
                      </h3>
                      {(() => {
                        if (leagueId === 1) {
                          const key = getWcRoundKey(matches[0]?.round);
                          return key ? (
                            <span className="absolute right-3 text-[12px] text-gray-200 font-bold tracking-wide">
                              {tTabs(key)}
                            </span>
                          ) : null;
                        }
                        const label = getMatchdayLabel(matches[0]?.round);
                        return label ? (
                          <span className="absolute right-3 text-[12px] text-gray-200 font-bold tracking-wide">
                            {label}
                          </span>
                        ) : null;
                      })()}
                    </Link>
                  ) : (
                    <div className="flex items-center justify-start px-4 gap-3 py-4 border-b border-gray-800/40">
                      <h3 className="text-[15px] font-bold text-gray-200 tracking-wider">
                        {leagueName}
                      </h3>
                    </div>
                  )}

                  <div>
                    {matches.map((m: DbMatch, index: number) => (
                      <div
                        key={m.id}
                        className={`${
                          index === matches.length - 1
                            ? "rounded-b-lg"
                            : "border-b border-white/4"
                        }`}
                      >
                        <MatchCard match={m} />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* FIX: Absolute clean fallback empty state container. Shows ONLY if total count is zero and no placeholder is visible */}
      {matchesForDate.length === 0 && !showWcPlaceholder && (
        <div className="p-8 text-center text-gray-200 border border-custom-gray rounded-xl">
          {dateLoading ? (
            <div className="w-8 h-8 border-2 border-gray-600 border-t-white rounded-full animate-spin mx-auto" />
          ) : (
            <>
              {tTabs("noMatches")}
              <img
                src="/images/specs/clock.svg"
                alt=""
                className="w-8 h-8 object-contain mx-auto mt-4"
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
