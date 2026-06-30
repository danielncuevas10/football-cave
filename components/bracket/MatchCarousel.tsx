"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import type { DbMatch } from "@/types/sports";
import { LIVE_STATUSES } from "@/types/sports";
import { supabase } from "@/lib/supabase";
import { getLocalizedTeamName } from "@/lib/teamName";
import type { GoalsMap } from "./BracketPanelServer";

const FINISHED = ["FT", "AET", "PEN", "AWD", "WO"];

interface VenueMap {
  [matchId: number]: { name: string | null; city: string | null };
}

interface Props {
  matches: DbMatch[];
  venues: VenueMap;
  goals: GoalsMap;
}

const lastName = (name: string) => {
  const parts = name.trim().split(" ");
  return parts.length > 1 ? parts[parts.length - 1] : name;
};

export default function MatchCarousel({ matches, venues, goals }: Props) {
  const t = useTranslations("matchTabs");
  const tEv = useTranslations("matchEvents");
  const locale = useLocale();

  const [localMatches, setLocalMatches] = useState<DbMatch[]>(matches);

  useEffect(() => {
    setLocalMatches(matches);
  }, [matches]);

  useEffect(() => {
    const channel = supabase
      .channel("carousel-wc-live")
      .on<DbMatch>(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "matches" },
        (payload) => {
          const updated = payload.new as DbMatch;
          if (updated.league_id !== 1) return;
          setLocalMatches((prev) => {
            const i = prev.findIndex((m) => m.id === updated.id);
            if (i === -1) return prev;
            const next = [...prev];
            next[i] = updated;
            return next;
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const today = new Date();
  const isSameDay = (d: Date) =>
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();

  const todayMatches = localMatches.filter((m) =>
    isSameDay(new Date(m.fixture_date))
  );
  const displayMatches =
    todayMatches.length > 0
      ? todayMatches
      : [...localMatches]
          .sort(
            (a, b) =>
              new Date(b.fixture_date).getTime() -
              new Date(a.fixture_date).getTime()
          )
          .slice(0, 4);

  const [idx, setIdx] = useState(0);
  const [direction, setDirection] = useState<"left" | "right">("left");
  const [animKey, setAnimKey] = useState(0);

  const go = (newIdx: number, dir: "left" | "right") => {
    if (newIdx < 0 || newIdx >= displayMatches.length || newIdx === idx) return;
    setDirection(dir);
    setAnimKey((k) => k + 1);
    setIdx(newIdx);
  };

  useEffect(() => {
    if (displayMatches.length <= 1) return;
    const id = setInterval(() => {
      setDirection("left");
      setAnimKey((k) => k + 1);
      setIdx((i) => (i + 1) % displayMatches.length);
    }, 4000);
    return () => clearInterval(id);
  }, [displayMatches.length]);

  if (!displayMatches.length) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
        {t("noMatches")}
      </div>
    );
  }

  const safeIdx = Math.min(idx, displayMatches.length - 1);
  const match = displayMatches[safeIdx];
  const venue = venues[match.id];
  const matchGoals = goals[match.id];
  const isFinished = FINISHED.includes(match.status);
  const isNotStarted = match.status === "NS" || match.status === "TBD";
  const isLive = LIVE_STATUSES.includes(match.status);
  const hasScore = match.home_score !== null && match.away_score !== null;

  const isPen = match.status === "PEN";
  const hasPenWinner =
    isPen &&
    match.penalty_home != null &&
    match.penalty_away != null &&
    match.penalty_home !== match.penalty_away;
  const showPenScore =
    isPen && match.penalty_home != null && match.penalty_away != null;
  const canDetermineWinner =
    isFinished &&
    match.home_score !== null &&
    match.away_score !== null &&
    (match.home_score !== match.away_score || hasPenWinner);
  const homeIsLoser =
    canDetermineWinner &&
    (match.home_score! < match.away_score! ||
      (hasPenWinner && match.penalty_home! < match.penalty_away!));
  const awayIsLoser =
    canDetermineWinner &&
    (match.away_score! < match.home_score! ||
      (hasPenWinner && match.penalty_away! < match.penalty_home!));

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

  const formatKickoff = (d: string) =>
    new Date(d).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

  const statusNode = (() => {
    const s = match.status;
    if (FINISHED.includes(s))
      return (
        <span className="text-gray-200 text-[10px]  tracking-wide">
          {tEv("matchFinished")}
        </span>
      );
    if (s === "HT")
      return (
        <span className="text-[#00A800] text-[10px]  tracking-wide">
          {tEv("halfTime")}
        </span>
      );
    if (s === "1H" || s === "2H" || s === "ET")
      return (
        <span className="text-[#00A800] text-[10px] font-mono">
          {match.elapsed}′
        </span>
      );
    return null;
  })();

  const showDots = displayMatches.length <= 12;

  return (
    <div className="flex-1 flex flex-col min-h-0 gap-3">
      {/* Card row + side arrows */}
      <div className="flex items-stretch gap-1.5 flex-1 min-h-0">
        {/* Prev — small round button centered vertically */}
        <div className="flex items-center shrink-0">
          <button
            onClick={() => go(idx - 1, "right")}
            disabled={idx === 0}
            aria-label="Previous match"
            className="w-8 h-8 flex items-center justify-center text-gray-500 bg-custom-gray hover:bg-custom-gray/50 rounded-full hover:text-white disabled:opacity-20 transition-colors cursor-pointer"
          >
            <img
              src="/images/specs/arrow.svg"
              alt=""
              className="w-3.5 h-3.5 object-contain -rotate-270"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = "/images/specs/arrow.jpg";
              }}
            />
          </button>
        </div>

        {/* Card container — clips the slide */}
        <div className="flex-1 overflow-hidden rounded-xl relative bg-custom-gray-2 min-h-0">
          {isLive && (
            <div className="hidden md:block h-0.5 overflow-hidden relative">
              <div
                className="absolute h-full w-50 bg-[#00A800]/50"
                style={{
                  animation: "live-scan 5s ease-in-out infinite",
                  boxShadow: "0 0 10px rgba(255,255,255,0.5)",
                }}
              />
            </div>
          )}
          <Link
            key={animKey}
            href={`/match/${match.id}`}
            className="block h-full"
            style={{
              animation: `card-slide-${direction} 0.6s ease-out`,
            }}
          >
            <div className="flex flex-col h-full px-4 pt-4 pb-8">
              {/* Top: date + status */}
              <div className="flex items-center justify-between shrink-0 mb-2">
                <span className="text-[10px] text-gray-200 font-light">
                  {formatDate(match.fixture_date)}
                </span>
                {statusNode}
              </div>

              {/* Middle: teams + score, vertically centered */}
              <div className="flex-1 flex items-center">
                <div className="grid grid-cols-3 items-start gap-2 w-full">
                  {/* Home */}
                  <div className={`flex flex-col items-center gap-1.5 transition-opacity${homeIsLoser ? " opacity-50" : ""}`}>
                    <div className="w-15 h-10 overflow-hidden relative border border-gray-300 rounded-tr-md rounded-bl-md shrink-0">
                      <Image
                        src={match.home_logo || "/images/specs/placeholder.svg"}
                        alt=""
                        fill
                        className="object-cover scale-[1.18] will-change-transform"
                        sizes="60px"
                      />
                    </div>
                    <span className={`text-[11px] text-center leading-tight line-clamp-2 text-white font-medium${homeIsLoser ? " line-through" : ""}`}>
                      {getLocalizedTeamName(match.home_team, locale)}
                    </span>
                    <div className="min-h-10.5">
                      {isFinished &&
                        matchGoals?.home
                          .filter((g) => !isPen || g.minute < 120)
                          .slice(0, 3)
                          .map((g, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-start gap-0.5 w-full px-1 leading-tight"
                          >
                            <img
                              src={
                                g.isOwnGoal
                                  ? "/images/specs/own-goal.svg"
                                  : "/images/specs/ball.svg"
                              }
                              alt=""
                              className="w-2.5 h-2.5 object-contain shrink-0 opacity-70"
                            />
                            <span className="text-[9px] text-gray-400 truncate">
                              {lastName(g.name)} {g.minute}′
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Score / kickoff time */}
                  <div className="flex flex-col items-center justify-center gap-0.5 pt-1">
                    <span className="text-2xl font-bold text-white tabular-nums tracking-tight">
                      {hasScore
                        ? `${match.home_score}–${match.away_score}`
                        : isNotStarted
                        ? formatKickoff(match.fixture_date)
                        : "–"}
                    </span>
                    {isLive && (
                      <span className="text-[#00A800] text-[10px] font-mono leading-none">
                        {match.status === "HT"
                          ? "HT"
                          : match.elapsed
                          ? `${match.elapsed}′`
                          : "LIVE"}
                      </span>
                    )}
                    {isFinished && (
                      <span className="text-gray-200 text-[10px] uppercase tracking-wider leading-none">
                        {tEv("ftLabel")}
                      </span>
                    )}
                    {showPenScore && (
                      <span className="text-gray-300 text-[10px] font-mono tabular-nums leading-none">
                        {tEv("penLabel")} {match.penalty_home}–{match.penalty_away}
                      </span>
                    )}
                  </div>

                  {/* Away */}
                  <div className={`flex flex-col items-center gap-1.5 transition-opacity${awayIsLoser ? " opacity-50" : ""}`}>
                    <div className="w-15 h-10 overflow-hidden relative border border-gray-300 rounded-tr-md rounded-bl-md shrink-0">
                      <Image
                        src={match.away_logo || "/images/specs/placeholder.svg"}
                        alt=""
                        fill
                        className="object-cover scale-[1.18] will-change-transform"
                        sizes="60px"
                      />
                    </div>
                    <span className={`text-[11px] text-center leading-tight line-clamp-2 text-white font-medium${awayIsLoser ? " line-through" : ""}`}>
                      {getLocalizedTeamName(match.away_team, locale)}
                    </span>
                    <div className="min-h-10.5">
                      {isFinished &&
                        matchGoals?.away
                          .filter((g) => !isPen || g.minute < 120)
                          .slice(0, 3)
                          .map((g, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-start gap-0.5 w-full px-1 leading-tight"
                          >
                            <img
                              src={
                                g.isOwnGoal
                                  ? "/images/specs/own-goal.svg"
                                  : "/images/specs/ball.svg"
                              }
                              alt=""
                              className="w-2.5 h-2.5 object-contain shrink-0 opacity-70"
                            />
                            <span className="text-[9px] text-gray-400 truncate">
                              {lastName(g.name)} {g.minute}′
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom: venue — always rendered to keep card height stable */}
              <div
                className={`shrink-0 flex items-center gap-1.5 border-t border-custom-gray pt-2 mt-2 ${
                  !(venue?.name || venue?.city) ? "invisible" : ""
                }`}
              >
                <img
                  src="/images/stadium.svg"
                  alt=""
                  className="w-3.5 h-3.5 object-contain opacity-40 shrink-0"
                />
                <span className="text-[10px] text-gray-400 truncate">
                  {[venue?.name, venue?.city].filter(Boolean).join(", ")}
                </span>
              </div>
            </div>
          </Link>

          {/* Dots or counter — inside the card, above the Link content */}
          {showDots ? (
            <div className="absolute bottom-2 left-0 right-0 flex items-center justify-center gap-2 flex-wrap z-10">
              {displayMatches.map((_, i) => (
                <button
                  key={i}
                  onClick={() => go(i, i > safeIdx ? "left" : "right")}
                  aria-label={`Match ${i + 1}`}
                  className={`rounded-full transition-all duration-200 ${
                    i === safeIdx
                      ? "w-2 h-2 bg-white"
                      : "w-1.5 h-1.5 bg-white/30 hover:bg-white/50"
                  }`}
                />
              ))}
            </div>
          ) : (
            <p className="absolute bottom-2 left-0 right-0 text-center text-[10px] text-gray-500 tabular-nums z-10">
              {safeIdx + 1} / {displayMatches.length}
            </p>
          )}
        </div>

        {/* Next — small round button centered vertically */}
        <div className="flex items-center shrink-0">
          <button
            onClick={() => go(idx + 1, "left")}
            disabled={idx === displayMatches.length - 1}
            aria-label="Next match"
            className="w-8 h-8 flex items-center justify-center text-gray-500 bg-custom-gray hover:bg-custom-gray/50 rounded-full hover:text-white disabled:opacity-20 transition-colors cursor-pointer"
          >
            <img
              src="/images/specs/arrow.svg"
              alt=""
              className="w-3.5 h-3.5 object-contain rotate-270"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = "/images/specs/arrow.jpg";
              }}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
