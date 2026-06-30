"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { DbMatch, DbStanding } from "@/types/sports";
import type { ResolvedSlot } from "@/types/bracket";
import { resolveBracket } from "@/lib/bracket/resolveBracket";

// ─── Layout constants ─────────────────────────────────────────────────────────
const SLOT_H = 72; // px allocated per R32 slot
const N_R32 = 16; // total R32 matches (all 16, single direction)
const TOTAL_H = SLOT_H * N_R32; // 1152px — shared height across all columns
const COL_W = 148; // slot column width
const CONN_W = 32; // connector strip width

const STROKE = "#4B5563";

function cy(i: number, n: number) {
  return (TOTAL_H * (2 * i + 1)) / (2 * n);
}

// SVG connector: pair of leftN slots collapse to one rightN slot ("]" shape)
function Conn({ leftN, rightN }: { leftN: number; rightN: number }) {
  const mx = CONN_W * 0.55;
  const els: React.ReactNode[] = [];
  for (let i = 0; i < rightN; i++) {
    const y1 = cy(i * 2, leftN);
    const y2 = cy(i * 2 + 1, leftN);
    const yp = cy(i, rightN);
    els.push(
      <g
        key={i}
        stroke={STROKE}
        strokeWidth={1}
        fill="none"
        strokeLinecap="round"
      >
        <line x1={0} y1={y1} x2={mx} y2={y1} />
        <line x1={mx} y1={y1} x2={mx} y2={y2} />
        <line x1={0} y1={y2} x2={mx} y2={y2} />
        <line x1={mx} y1={yp} x2={CONN_W} y2={yp} />
      </g>
    );
  }
  return (
    <svg
      width={CONN_W}
      height={TOTAL_H}
      style={{ display: "block", flexShrink: 0 }}
    >
      {els}
    </svg>
  );
}

// ─── Compact slot card ────────────────────────────────────────────────────────

function FlagImg({ src, muted }: { src: string; muted?: boolean }) {
  return (
    <div
      className={`w-8 h-5.5 overflow-hidden shrink-0 border border-gray-300 rounded-tr-sm rounded-bl-sm ${
        muted ? "opacity-50" : ""
      }`}
    >
      <img src={src} alt="" className="w-full h-full object-cover " />
    </div>
  );
}

function FlagPlaceholder() {
  return (
    <div className="w-8 h-5.5 shrink-0 border border-gray-300 rounded-tr-sm rounded-bl-sm" />
  );
}

function CompactSlot({ slot }: { slot: ResolvedSlot }) {
  const t = useTranslations("matchTabs");
  const { homeLabel, awayLabel, homeLogo, awayLogo, match, thirdsResolution } =
    slot;
  const isProjected = !match && thirdsResolution?.slotStatus === "projected";

  const homeScore = match?.home_score ?? null;
  const awayScore = match?.away_score ?? null;
  const hasScore = homeScore !== null && awayScore !== null;
  const hasPenWinner =
    match?.status === "PEN" &&
    match.penalty_home != null &&
    match.penalty_away != null &&
    match.penalty_home !== match.penalty_away;
  const homeWon = hasScore &&
    (homeScore! > awayScore! || (hasPenWinner && match!.penalty_home! > match!.penalty_away!));
  const awayWon = hasScore &&
    (awayScore! > homeScore! || (hasPenWinner && match!.penalty_away! > match!.penalty_home!));

  return (
    <div className="bg-custom-gray-2 border border-gray-700/40 rounded overflow-hidden w-full my-1">
      {/* Home */}
      <div
        className={`flex items-center gap-2.5 px-2 py-1 ${
          homeWon ? "bg-white/5" : ""
        }`}
      >
        {homeLogo ? <FlagImg src={homeLogo} /> : <FlagPlaceholder />}
        <span className="flex-1 text-[9px] font-medium text-gray-200 truncate leading-none">
          {homeLabel || t("teamTBC")}
        </span>
        {hasScore && (
          <span
            className={`text-[10px] font-bold tabular-nums ${
              homeWon ? "text-white" : "text-gray-400"
            }`}
          >
            {homeScore}
          </span>
        )}
      </div>
      <div className="border-t border-gray-700/30" />
      {/* Away */}
      <div
        className={`flex items-center gap-2.5 px-2 py-1 ${
          awayWon ? "bg-white/5" : ""
        }`}
      >
        {awayLogo ? (
          <FlagImg src={awayLogo} muted={isProjected} />
        ) : (
          <FlagPlaceholder />
        )}
        <span className="flex-1 text-[9px] font-medium text-gray-200 truncate leading-none">
          {awayLabel || t("teamTBC")}
        </span>
        {hasScore && (
          <span
            className={`text-[10px] font-bold tabular-nums ${
              awayWon ? "text-white" : "text-gray-400"
            }`}
          >
            {awayScore}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Column of evenly-spaced slots ───────────────────────────────────────────
// justify-content: space-around places each card center exactly at cy(i, n)
// regardless of card height — the math holds for any uniform card height.
function SlotCol({ slots }: { slots: ResolvedSlot[]; n: number }) {
  return (
    <div
      style={{
        width: COL_W,
        height: TOTAL_H,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-around",
      }}
    >
      {slots.map((slot) => (
        <CompactSlot key={slot.def.id} slot={slot} />
      ))}
    </div>
  );
}

// ─── Column headers ───────────────────────────────────────────────────────────
const HEADER_COLS = [
  { label: "R32", w: COL_W },
  { label: "", w: CONN_W },
  { label: "R16", w: COL_W },
  { label: "", w: CONN_W },
  { label: "QF", w: COL_W },
  { label: "", w: CONN_W },
  { label: "SF", w: COL_W },
  { label: "", w: CONN_W },
  { label: "Final", w: COL_W },
] as const;

// ─── Root component ───────────────────────────────────────────────────────────

interface MobileBracketTreeProps {
  matches: DbMatch[];
  standings: DbStanding[];
}

export default function MobileBracketTree({
  matches,
  standings,
}: MobileBracketTreeProps) {
  const t = useTranslations("matchTabs");

  const resolved = useMemo(
    () => resolveBracket(matches, standings),
    [matches, standings]
  );

  const slotMap = useMemo(() => {
    const m = new Map<string, ResolvedSlot>();
    for (const s of resolved) m.set(s.def.id, s);
    return m;
  }, [resolved]);

  const g = (id: string) => slotMap.get(id) ?? null;
  const gs = (...ids: string[]) =>
    ids.map(g).filter((s): s is ResolvedSlot => s !== null);

  // Single-direction order: all 16 R32 matches in one column
  const r32 = gs(
    "R32_F1",
    "R32_T1",
    "R32_F2",
    "R32_T2",
    "R32_F3",
    "R32_T3",
    "R32_F4",
    "R32_T4",
    "R32_F5",
    "R32_T5",
    "R32_F6",
    "R32_T6",
    "R32_F7",
    "R32_T7",
    "R32_F8",
    "R32_T8"
  );
  const r16 = gs(
    "R16_1",
    "R16_2",
    "R16_3",
    "R16_4",
    "R16_5",
    "R16_6",
    "R16_7",
    "R16_8"
  );
  const qf = gs("QF_1", "QF_2", "QF_3", "QF_4");
  const sf = gs("SF_1", "SF_2");
  const fin = gs("FINAL");

  return (
    <div className="pb-4">
      {/* View full bracket link */}
      <div className="flex justify-end mb-3 pr-1">
        <Link
          href="/bracket"
          className="text-xs text-gray-200 hover:text-white transition-colors flex items-center gap-1.5"
        >
          {t("viewBracket")}
          <img
            src="/images/specs/arrow.svg"
            alt=""
            className="w-3 h-3 object-contain rotate-270"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = "/images/specs/arrow.jpg";
            }}
          />
        </Link>
      </div>

      {/* Round headers */}
      <div className="flex mb-2" style={{ minWidth: "max-content" }}>
        {HEADER_COLS.map(({ label, w }, i) => (
          <div
            key={i}
            style={{ width: w, flexShrink: 0, textAlign: "center" }}
            className="text-[8px] font-light uppercase tracking-widest text-gray-500"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Bracket tree */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          minWidth: "max-content",
        }}
      >
        <SlotCol slots={r32} n={16} />
        <Conn leftN={16} rightN={8} />
        <SlotCol slots={r16} n={8} />
        <Conn leftN={8} rightN={4} />
        <SlotCol slots={qf} n={4} />
        <Conn leftN={4} rightN={2} />
        <SlotCol slots={sf} n={2} />
        <Conn leftN={2} rightN={1} />
        <SlotCol slots={fin} n={1} />
      </div>
    </div>
  );
}
