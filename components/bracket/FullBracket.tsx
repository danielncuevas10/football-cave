"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { DbMatch, DbStanding } from "@/types/sports";
import type { BracketRound, ResolvedSlot } from "@/types/bracket";
import { resolveBracket } from "@/lib/bracket/resolveBracket";
import BracketRoundColumn from "./BracketRound";

type NavigableRound = "R32" | "R16" | "QF" | "SF" | "FINAL";

const ROUND_ORDER: NavigableRound[] = ["R32", "R16", "QF", "SF", "FINAL"];

const ROUND_SHORT: Record<NavigableRound, string> = {
  R32: "R32",
  R16: "R16",
  QF: "QF",
  SF: "SF",
  FINAL: "Final",
};

const ROUND_LABEL: Record<NavigableRound | "THIRD", string> = {
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarter-Finals",
  SF: "Semi-Finals",
  FINAL: "Final",
  THIRD: "3rd Place",
};

interface FullBracketProps {
  matches: DbMatch[];
  standings: DbStanding[];
  showFullBracketLink?: boolean;
}

export default function FullBracket({
  matches,
  standings,
  showFullBracketLink = false,
}: FullBracketProps) {
  const t = useTranslations("matchTabs");
  const [activeRound, setActiveRound] = useState<NavigableRound>("R32");
  const scrollRef = useRef<HTMLDivElement>(null);
  const roundRefs = useRef<Partial<Record<NavigableRound, HTMLDivElement>>>({});

  const resolved = useMemo(
    () => resolveBracket(matches, standings),
    [matches, standings]
  );

  const byRound = useMemo(() => {
    const map = new Map<BracketRound, ResolvedSlot[]>();
    for (const slot of resolved) {
      const r = slot.def.round;
      if (!map.has(r)) map.set(r, []);
      map.get(r)!.push(slot);
    }
    return map;
  }, [resolved]);

  const thirdSlots = byRound.get("THIRD") ?? [];

  const currentIdx = ROUND_ORDER.indexOf(activeRound);
  const canGoPrev = currentIdx > 0;
  const canGoNext = currentIdx < ROUND_ORDER.length - 1;

  // Scroll container to a round and update active tab
  function goToRound(r: NavigableRound) {
    setActiveRound(r);
    roundRefs.current[r]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "start",
    });
  }

  // Keep active tab in sync when the user scrolls manually
  const syncActiveOnScroll = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    const center = container.scrollLeft + container.clientWidth / 2;
    let closestRound: NavigableRound = "R32";
    let closestDist = Infinity;
    for (const r of ROUND_ORDER) {
      const el = roundRefs.current[r];
      if (!el) continue;
      const dist = Math.abs(el.offsetLeft + el.offsetWidth / 2 - center);
      if (dist < closestDist) {
        closestDist = dist;
        closestRound = r;
      }
    }
    setActiveRound(closestRound);
  }, []);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    container.addEventListener("scroll", syncActiveOnScroll, { passive: true });
    return () => container.removeEventListener("scroll", syncActiveOnScroll);
  }, [syncActiveOnScroll]);

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Round navigation bar */}
      {showFullBracketLink && (
        <div className="flex justify-end">
          <Link
            href="/bracket"
            className="inline-flex items-center text-xs text-gray-200 hover:text-white transition-colors  lg:bg-custom-gray lg:p-3 lg:rounded-md lg:text-white lg:hover:bg-white lg:hover:text-black"
          >
            <span>{t("viewBracket")}</span>
            <img
              src="/images/specs/arrow.svg"
              alt=""
              className="w-3 h-3 object-contain -rotate-90 ml-3"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = "/images/specs/arrow.jpg";
              }}
            />
          </Link>
        </div>
      )}
      <div className="flex items-center gap-1">
        <button
          onClick={() => canGoPrev && goToRound(ROUND_ORDER[currentIdx - 1])}
          disabled={!canGoPrev}
          aria-label="Previous round"
          className="shrink-0 p-1.5 rounded text-gray-200 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>

        <div className="flex flex-1 gap-1">
          {ROUND_ORDER.map((r) => (
            <button
              key={r}
              onClick={() => goToRound(r)}
              className={`flex-1 py-1.5 text-[10px] font-light uppercase tracking-wider rounded transition-colors ${
                r === activeRound
                  ? "bg-custom-gray-2 text-white"
                  : "text-gray-200 hover:text-gray-300"
              }`}
            >
              {ROUND_SHORT[r]}
            </button>
          ))}
        </div>

        <button
          onClick={() => canGoNext && goToRound(ROUND_ORDER[currentIdx + 1])}
          disabled={!canGoNext}
          aria-label="Next round"
          className="shrink-0 p-1.5 rounded text-gray-200 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>

      {/* All rounds — horizontal scroll + arrow/tab navigation both work */}
      <div ref={scrollRef} className="overflow-x-auto pb-3">
        <div className="flex flex-row gap-6 min-w-max items-start">
          {ROUND_ORDER.map((round) => {
            const slots = byRound.get(round) ?? [];
            const roundSlots =
              round === "FINAL" ? [...slots, ...thirdSlots] : slots;

            return (
              <div
                key={round}
                ref={(el) => {
                  if (el) roundRefs.current[round] = el;
                }}
              >
                <BracketRoundColumn
                  label={ROUND_LABEL[round]}
                  slots={roundSlots}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
