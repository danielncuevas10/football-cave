"use client";

import { useState, useMemo, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import MatchCard from "@/components/MatchCard";
import type { DbMatch } from "@/types/sports";

interface Props {
  matches: DbMatch[];
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

function getDisplayDate(
  target: Date,
  labels: { today: string; yesterday: string; tomorrow: string },
  locale: string
): string {
  const normalize = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const t = normalize(target);
  const today = normalize(new Date());
  const diff = Math.round(
    (t.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diff === 0) return labels.today;
  if (diff === -1) return labels.yesterday;
  if (diff === 1) return labels.tomorrow;
  return t.toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(t.getFullYear() !== today.getFullYear() ? { year: "numeric" } : {}),
  });
}

export default function TournamentMatchesByDay({ matches }: Props) {
  const tDate = useTranslations("dateLabels");
  const tTabs = useTranslations("matchTabs");
  const appLocale = useLocale();
  const bcp47 = LOCALE_MAP[appLocale] ?? "en-GB";

  // Unique calendar days that have at least one match, sorted ascending
  const matchDays = useMemo(() => {
    const seen = new Set<number>();
    matches.forEach((m) => {
      const d = new Date(m.fixture_date);
      seen.add(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime());
    });
    return Array.from(seen)
      .sort((a, b) => a - b)
      .map((t) => new Date(t));
  }, [matches]);

  const [dayIndex, setDayIndex] = useState(0);

  // On mount jump to today or the nearest upcoming match day
  useEffect(() => {
    if (!matchDays.length) return;
    const todayMs = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      new Date().getDate()
    ).getTime();
    const idx = matchDays.findIndex((d) => d.getTime() >= todayMs);
    setDayIndex(idx === -1 ? matchDays.length - 1 : idx);
  }, [matchDays]);

  // Matches for the currently selected day, sorted by kickoff time
  const dayMatches = useMemo(() => {
    const day = matchDays[dayIndex];
    if (!day) return [];
    return matches
      .filter((m) => {
        const d = new Date(m.fixture_date);
        return (
          d.getFullYear() === day.getFullYear() &&
          d.getMonth() === day.getMonth() &&
          d.getDate() === day.getDate()
        );
      })
      .sort(
        (a, b) =>
          new Date(a.fixture_date).getTime() -
          new Date(b.fixture_date).getTime()
      );
  }, [matches, matchDays, dayIndex]);

  if (!matchDays.length) {
    return (
      <div className="p-8 text-center text-gray-300 text-sm border border-custom-gray rounded-md">
        {tTabs("noMatches")}
        <img
          src="/images/specs/clock.svg"
          alt=""
          className="w-8 h-8 object-contain mx-auto mt-4 opacity-40"
        />
      </div>
    );
  }

  const currentDay = matchDays[dayIndex];

  return (
    <div className="space-y-4">
      {/* Day navigation — same style as ScoreList */}
      <div className="flex items-center justify-between bg-custom-gray p-3 rounded-md">
        <button
          onClick={() => setDayIndex((i) => Math.max(0, i - 1))}
          disabled={dayIndex === 0}
          className="p-2 text-gray-200 hover:text-white disabled:opacity-30 transition-colors"
        >
          <img
            src="/images/specs/Arrow.svg"
            alt="Previous day"
            className="w-4.5 h-4.5 object-contain rotate-90"
          />
        </button>

        <span className="text-sm font-bold text-white select-none">
          {getDisplayDate(
            currentDay,
            {
              today: tDate("today"),
              yesterday: tDate("yesterday"),
              tomorrow: tDate("tomorrow"),
            },
            bcp47
          )}
        </span>

        <button
          onClick={() =>
            setDayIndex((i) => Math.min(matchDays.length - 1, i + 1))
          }
          disabled={dayIndex === matchDays.length - 1}
          className="p-2 text-gray-200 hover:text-white disabled:opacity-30 transition-colors"
        >
          <img
            src="/images/specs/Arrow.svg"
            alt="Next day"
            className="w-4.5 h-4.5 object-contain rotate-270"
          />
        </button>
      </div>

      {/* Match list for the selected day */}
      <div className="bg-custom-gray rounded-md overflow-hidden divide-y divide-custom-gray/50">
        {dayMatches.map((match) => (
          <MatchCard key={match.id} match={match} />
        ))}
      </div>
    </div>
  );
}
