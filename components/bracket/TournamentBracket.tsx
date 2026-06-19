"use client";

import { useMemo } from "react";
import type { DbMatch, DbStanding } from "@/types/sports";
import type { ResolvedSlot } from "@/types/bracket";
import { resolveBracket } from "@/lib/bracket/resolveBracket";
import BracketSlot from "./BracketSlot";

// ─── Layout constants ─────────────────────────────────────────────────────────
const SLOT_H = 100; // vertical space allocated per R32 slot (px)
const N_R32 = 8; // R32 matches per side
const TOTAL_H = SLOT_H * N_R32; // 800px — shared height of every column
const COL_W = 260; // slot column width (px)
const CONN_W = 40; // SVG connector strip width (px)
const STROKE = "#4B5563"; // Tailwind gray-600

// Vertical center (px from top) of slot i out of n, within TOTAL_H.
// This matches justify-around's placement exactly, regardless of card height.
function cy(i: number, n: number): number {
  return (TOTAL_H * (2 * i + 1)) / (2 * n);
}

// ─── Connector: left-half elbow (many slots → fewer, flowing rightward) ───────
// Each pair of leftN slots collapses to one rightN slot via a "]" shape.
function LeftConn({ leftN, rightN }: { leftN: number; rightN: number }) {
  const mx = CONN_W * 0.6; // junction x-position
  const els: React.ReactNode[] = [];

  for (let i = 0; i < rightN; i++) {
    const y1 = cy(i * 2, leftN);
    const y2 = cy(i * 2 + 1, leftN);
    const yp = cy(i, rightN);
    els.push(
      <g
        key={i}
        stroke={STROKE}
        strokeWidth={1.5}
        fill="none"
        strokeLinecap="round"
      >
        {/* Stub from top slot's right edge to junction */}
        <line x1={0} y1={y1} x2={mx} y2={y1} />
        {/* Vertical bar between top and bottom stubs */}
        <line x1={mx} y1={y1} x2={mx} y2={y2} />
        {/* Stub from bottom slot's right edge to junction */}
        <line x1={0} y1={y2} x2={mx} y2={y2} />
        {/* Single line from junction toward parent slot */}
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

// ─── Connector: right-half elbow (fewer slots → more, flowing rightward) ──────
// Mirror of LeftConn: parent slot on the left fans out to children on the right.
function RightConn({ leftN, rightN }: { leftN: number; rightN: number }) {
  const mx = CONN_W * 0.4; // junction x-position (mirrored)
  const els: React.ReactNode[] = [];

  for (let i = 0; i < leftN; i++) {
    const y1 = cy(i * 2, rightN);
    const y2 = cy(i * 2 + 1, rightN);
    const yp = cy(i, leftN);
    els.push(
      <g
        key={i}
        stroke={STROKE}
        strokeWidth={1.5}
        fill="none"
        strokeLinecap="round"
      >
        {/* Single line from parent's right edge to junction */}
        <line x1={0} y1={yp} x2={mx} y2={yp} />
        {/* Vertical bar fanning to top and bottom children */}
        <line x1={mx} y1={y1} x2={mx} y2={y2} />
        {/* Stub to top child slot's left edge */}
        <line x1={mx} y1={y1} x2={CONN_W} y2={y1} />
        {/* Stub to bottom child slot's left edge */}
        <line x1={mx} y1={y2} x2={CONN_W} y2={y2} />
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

// ─── Connector: SF → FINAL (horizontal line at vertical center) ───────────────
function CenterConn({ side }: { side: "left" | "right" }) {
  const yc = TOTAL_H / 2;
  const x1 = side === "left" ? 0 : CONN_W;
  const x2 = side === "left" ? CONN_W : 0;
  return (
    <svg
      width={CONN_W}
      height={TOTAL_H}
      style={{ display: "block", flexShrink: 0 }}
    >
      <line
        x1={x1}
        y1={yc}
        x2={x2}
        y2={yc}
        stroke={STROKE}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </svg>
  );
}

// ─── Slot column: n slots distributed vertically via justify-around ───────────
function SlotCol({ slots, n }: { slots: ResolvedSlot[]; n: number }) {
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
        <BracketSlot key={slot.def.id} slot={slot} />
      ))}
    </div>
  );
}

// ─── Center column: Final vertically centered, 3rd place just below ───────────
function CenterCol({
  finalSlot,
  thirdSlot,
}: {
  finalSlot: ResolvedSlot | null;
  thirdSlot: ResolvedSlot | null;
}) {
  return (
    <div
      style={{
        width: COL_W,
        height: TOTAL_H,
        flexShrink: 0,
        position: "relative",
      }}
    >
      {finalSlot && (
        <div
          style={{
            position: "absolute",
            inset: "auto 0",
            top: "50%",
            transform: "translateY(-50%)",
          }}
        >
          <BracketSlot slot={finalSlot} />
        </div>
      )}
      {thirdSlot && (
        <div
          style={{
            position: "absolute",
            inset: "auto 0",
            top: "calc(50% + 88px)",
          }}
          className="border-t border-gray-700/40 pt-3"
        >
          <BracketSlot slot={thirdSlot} />
        </div>
      )}
    </div>
  );
}

// ─── Column header row ────────────────────────────────────────────────────────
const HEADERS = [
  { label: "Round of 32", w: COL_W },
  { label: "", w: CONN_W },
  { label: "Round of 16", w: COL_W },
  { label: "", w: CONN_W },
  { label: "Quarter-Finals", w: COL_W },
  { label: "", w: CONN_W },
  { label: "Semi-Finals", w: COL_W },
  { label: "", w: CONN_W },
  { label: "Final", w: COL_W },
  { label: "", w: CONN_W },
  { label: "Semi-Finals", w: COL_W },
  { label: "", w: CONN_W },
  { label: "Quarter-Finals", w: COL_W },
  { label: "", w: CONN_W },
  { label: "Round of 16", w: COL_W },
  { label: "", w: CONN_W },
  { label: "Round of 32", w: COL_W },
] as const;

function HeaderRow() {
  return (
    <div
      style={{ display: "flex", alignItems: "center", minWidth: "max-content" }}
      className="mb-4"
    >
      {HEADERS.map(({ label, w }, i) => (
        <div
          key={i}
          style={{ width: w, flexShrink: 0, textAlign: "center" }}
          className="text-[9px] font-light uppercase tracking-widest text-gray-200"
        >
          {label}
        </div>
      ))}
    </div>
  );
}

// ─── Root component ───────────────────────────────────────────────────────────

interface TournamentBracketProps {
  matches: DbMatch[];
  standings: DbStanding[];
}

export default function TournamentBracket({
  matches,
  standings,
}: TournamentBracketProps) {
  const resolved = useMemo(
    () => resolveBracket(matches, standings),
    [matches, standings]
  );

  const slotMap = useMemo(() => {
    const m = new Map<string, ResolvedSlot>();
    for (const s of resolved) m.set(s.def.id, s);
    return m;
  }, [resolved]);

  // Helpers: get one slot or a filtered list
  const g = (id: string) => slotMap.get(id) ?? null;
  const gs = (...ids: string[]) =>
    ids.map(g).filter((s): s is ResolvedSlot => s !== null);

  // ── Left half (outermost-left → center) ─────────────────────────────────────
  // R32 order: pairs that each feed one R16 match (F and T share the same index)
  const leftR32 = gs(
    "R32_F1",
    "R32_T1",
    "R32_F2",
    "R32_T2",
    "R32_F3",
    "R32_T3",
    "R32_F4",
    "R32_T4"
  );
  const leftR16 = gs("R16_1", "R16_2", "R16_3", "R16_4");
  const leftQF = gs("QF_1", "QF_2");
  const leftSF = gs("SF_1");

  // ── Center ───────────────────────────────────────────────────────────────────
  const finalSlot = g("FINAL");
  const thirdSlot = g("THIRD");

  // ── Right half (center → outermost-right) ────────────────────────────────────
  const rightSF = gs("SF_2");
  const rightQF = gs("QF_3", "QF_4");
  const rightR16 = gs("R16_5", "R16_6", "R16_7", "R16_8");
  const rightR32 = gs(
    "R32_F5",
    "R32_T5",
    "R32_F6",
    "R32_T6",
    "R32_F7",
    "R32_T7",
    "R32_F8",
    "R32_T8"
  );

  return (
    <div className="overflow-x-auto pb-6">
      <HeaderRow />

      {/* Bracket tree */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          minWidth: "max-content",
        }}
      >
        {/* ── Left half: R32 → R16 → QF → SF ── */}
        <SlotCol slots={leftR32} n={8} />
        <LeftConn leftN={8} rightN={4} />
        <SlotCol slots={leftR16} n={4} />
        <LeftConn leftN={4} rightN={2} />
        <SlotCol slots={leftQF} n={2} />
        <LeftConn leftN={2} rightN={1} />
        <SlotCol slots={leftSF} n={1} />
        <CenterConn side="left" />

        {/* ── Center: Final + 3rd-place ── */}
        <CenterCol finalSlot={finalSlot} thirdSlot={thirdSlot} />

        {/* ── Right half: SF → QF → R16 → R32 ── */}
        <CenterConn side="right" />
        <SlotCol slots={rightSF} n={1} />
        <RightConn leftN={1} rightN={2} />
        <SlotCol slots={rightQF} n={2} />
        <RightConn leftN={2} rightN={4} />
        <SlotCol slots={rightR16} n={4} />
        <RightConn leftN={4} rightN={8} />
        <SlotCol slots={rightR32} n={8} />
      </div>
    </div>
  );
}
