"use client";

import { useState, useEffect } from "react";
import { useLiveScores } from "@/hooks/useLiveScores";
import { useTranslations, useLocale } from "next-intl";
import { supabase } from "@/lib/supabase";
import MatchCard from "./MatchCard";
import type { DbMatch } from "@/types/sports";
import { LIVE_STATUSES } from "@/types/sports";
import Link from "next/link";
import { getWcRoundKey } from "@/lib/wcRoundLabel";

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

  useEffect(() => {
    const channel = supabase
      .channel("scorelist-updates")
      .on<DbMatch>(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "matches" },
        (payload) => {
          const updated = payload.new as DbMatch;
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
  ].sort((a, b) => {
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
    const league = match.league_name || "Unknown League";
    if (!acc[league]) acc[league] = [];
    acc[league].push(match);
    return acc;
  }, {} as Record<string, DbMatch[]>);

  // Group live matches by league dynamically to match design container structure
  const liveMatchesByLeague = live.reduce((acc, match) => {
    const league = match.league_name || "Unknown League";
    if (!acc[league]) acc[league] = [];
    acc[league].push(match);
    return acc;
  }, {} as Record<string, DbMatch[]>);

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
            {Object.entries(liveMatchesByLeague).map(
              ([leagueName, matches]) => {
                const leagueId = matches[0]?.league_id;
                const leagueLogo =
                  leagueId === 1
                    ? "/images/WC26Badge.svg"
                    : matches.find((m) => m.league_logo)?.league_logo ||
                      "/images/specs/placeholder.svg";

                return (
                  <div
                    key={`live-${leagueName}`}
                    className="bg-custom-gray rounded-xl overflow-hidden border border-white/8 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                  >
                    {leagueId ? (
                      <Link
                        href={`/league/${leagueId}`}
                        className={`relative flex items-center gap-3 py-4 border-b border-[#38383A] hover:bg-gray-900/20 transition-colors ${
                          leagueId === 1
                            ? "justify-start px-4"
                            : "justify-center"
                        }`}
                      >
                        <img
                          src={leagueLogo}
                          alt=""
                          className="w-6 h-6 object-contain"
                        />
                        <h3 className="text-[15px] font-bold text-white tracking-wider">
                          {leagueName}
                        </h3>
                        {leagueId === 1 &&
                          (() => {
                            const key = getWcRoundKey(matches[0]?.round);
                            return key ? (
                              <span className="absolute right-3 text-[12px] text-gray-200 font-bold tracking-wide">
                                {tTabs(key)}
                              </span>
                            ) : null;
                          })()}
                      </Link>
                    ) : (
                      <div className="flex items-center justify-center gap-3 py-4 border-b border-gray-800/40">
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

      {/* FIX: Render Scheduled/Finished Matches section only if they exist */}
      {Object.keys(matchesByLeague).length > 0 && (
        <section>
          <div className="space-y-6">
            {Object.entries(matchesByLeague).map(([leagueName, matches]) => {
              const leagueId = matches[0]?.league_id;
              const leagueLogo =
                leagueId === 1
                  ? "/images/WC26Badge.svg"
                  : matches.find((m) => m.league_logo)?.league_logo ||
                    "/images/specs/placeholder.svg";

              return (
                <div
                  key={leagueName}
                  className="bg-custom-gray rounded-xl overflow-hidden border border-white/8 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                >
                  {leagueId ? (
                    <Link
                      href={`/league/${leagueId}`}
                      className={`relative flex items-center gap-3 py-4 hover:bg-gray-900/20 transition-colors ${
                        leagueId === 1 ? "justify-start px-4" : "justify-center"
                      }`}
                    >
                      <img
                        src={leagueLogo}
                        alt=""
                        className="w-6 h-6 object-contain"
                      />
                      <h3 className="text-[15px] font-bold text-white tracking-wider">
                        {leagueName}
                      </h3>
                      {leagueId === 1 &&
                        (() => {
                          const key = getWcRoundKey(matches[0]?.round);
                          return key ? (
                            <span className="absolute right-3 text-[12px] text-gray-200 font-bold tracking-wide">
                              {tTabs(key)}
                            </span>
                          ) : null;
                        })()}
                    </Link>
                  ) : (
                    <div className="flex items-center justify-center gap-3 py-4 border-b border-gray-800/40">
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

      {/* FIX: Absolute clean fallback empty state container. Shows ONLY if total count is zero */}
      {matchesForDate.length === 0 && (
        <div className="p-8 text-center text-gray-200 border border-custom-gray rounded-xl">
          {tTabs("noMatches")}
          <img
            src="/images/specs/clock.svg"
            alt=""
            className="w-8 h-8 object-contain mx-auto mt-4"
          />
        </div>
      )}
    </div>
  );
}
