"use client";

import { useMemo, useState, useEffect } from "react";
import type { DbMatch, DbStanding } from "@/types/sports";
import type { ResolvedSlot } from "@/types/bracket";
import { resolveBracket } from "@/lib/bracket/resolveBracket";
import BracketSlot from "./BracketSlot";

// ─── Layout constants ─────────────────────────────────────────────────────────
const SLOT_H_MOBILE = 68; // px per R32 slot on phones
const SLOT_H_DESKTOP = 82; // px per R32 slot on desktop
const N_R32 = 8; // R32 matches per side
const COL_W = "var(--bracket-col-w)"; // responsive: 120px mobile / 260px desktop
const CONN_W = 32; // SVG connector strip width (px)
const STROKE = "#4B5563"; // Tailwind gray-600

// Vertical center (px from top) of slot i out of n, within totalH.
// This matches justify-around's placement exactly, regardless of card height.
function cy(i: number, n: number, totalH: number): number {
  return (totalH * (2 * i + 1)) / (2 * n);
}

// ─── Connector: left-half elbow (many slots → fewer, flowing rightward) ───────
function LeftConn({
  leftN,
  rightN,
  totalH,
}: {
  leftN: number;
  rightN: number;
  totalH: number;
}) {
  const mx = CONN_W * 0.6;
  const els: React.ReactNode[] = [];

  for (let i = 0; i < rightN; i++) {
    const y1 = cy(i * 2, leftN, totalH);
    const y2 = cy(i * 2 + 1, leftN, totalH);
    const yp = cy(i, rightN, totalH);
    els.push(
      <g
        key={i}
        stroke={STROKE}
        strokeWidth={1.5}
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
      height={totalH}
      style={{ display: "block", flexShrink: 0 }}
    >
      {els}
    </svg>
  );
}

// ─── Connector: right-half elbow (fewer slots → more, flowing rightward) ──────
function RightConn({
  leftN,
  rightN,
  totalH,
}: {
  leftN: number;
  rightN: number;
  totalH: number;
}) {
  const mx = CONN_W * 0.4;
  const els: React.ReactNode[] = [];

  for (let i = 0; i < leftN; i++) {
    const y1 = cy(i * 2, rightN, totalH);
    const y2 = cy(i * 2 + 1, rightN, totalH);
    const yp = cy(i, leftN, totalH);
    els.push(
      <g
        key={i}
        stroke={STROKE}
        strokeWidth={1.5}
        fill="none"
        strokeLinecap="round"
      >
        <line x1={0} y1={yp} x2={mx} y2={yp} />
        <line x1={mx} y1={y1} x2={mx} y2={y2} />
        <line x1={mx} y1={y1} x2={CONN_W} y2={y1} />
        <line x1={mx} y1={y2} x2={CONN_W} y2={y2} />
      </g>
    );
  }

  return (
    <svg
      width={CONN_W}
      height={totalH}
      style={{ display: "block", flexShrink: 0 }}
    >
      {els}
    </svg>
  );
}

// ─── Connector: SF → FINAL (horizontal line at vertical center) ───────────────
function CenterConn({
  side,
  totalH,
}: {
  side: "left" | "right";
  totalH: number;
}) {
  const yc = totalH / 2;
  const x1 = side === "left" ? 0 : CONN_W;
  const x2 = side === "left" ? CONN_W : 0;
  return (
    <svg
      width={CONN_W}
      height={totalH}
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
function SlotCol({ slots, totalH }: { slots: ResolvedSlot[]; totalH: number }) {
  return (
    <div
      style={{
        width: COL_W,
        height: totalH,
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
  totalH,
}: {
  finalSlot: ResolvedSlot | null;
  thirdSlot: ResolvedSlot | null;
  totalH: number;
}) {
  return (
    <div
      style={{
        width: COL_W,
        height: totalH,
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
const HEADERS: { label: string; isConn: boolean }[] = [
  { label: "Round of 32", isConn: false },
  { label: "", isConn: true },
  { label: "Round of 16", isConn: false },
  { label: "", isConn: true },
  { label: "Quarter-Finals", isConn: false },
  { label: "", isConn: true },
  { label: "Semi-Finals", isConn: false },
  { label: "", isConn: true },
  { label: "Final", isConn: false },
  { label: "", isConn: true },
  { label: "Semi-Finals", isConn: false },
  { label: "", isConn: true },
  { label: "Quarter-Finals", isConn: false },
  { label: "", isConn: true },
  { label: "Round of 16", isConn: false },
  { label: "", isConn: true },
  { label: "Round of 32", isConn: false },
];

function HeaderRow() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        minWidth: "max-content",
      }}
      className="mb-4"
    >
      {HEADERS.map(({ label, isConn }, i) => {
        return (
          <div
            key={i}
            style={{ width: isConn ? CONN_W : COL_W, flexShrink: 0 }}
          >
            <div className="text-center text-[9px] font-light uppercase tracking-widest text-gray-200 mb-8">
              {label}
            </div>
          </div>
        );
      })}
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
  // Responsive slot height — smaller gaps on mobile
  const [slotH, setSlotH] = useState(SLOT_H_DESKTOP);
  useEffect(() => {
    const update = () =>
      setSlotH(window.innerWidth < 768 ? SLOT_H_MOBILE : SLOT_H_DESKTOP);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  const totalH = slotH * N_R32;

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

  // ── Left half (outermost-left → center) ─────────────────────────────────────
  const leftR32 = gs(
    "R32_T4",
    "R32_T6",
    "R32_F1",
    "R32_F2",
    "R32_F5",
    "R32_F6",
    "R32_T3",
    "R32_T5"
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
    "R32_F3",
    "R32_F4",
    "R32_T1",
    "R32_T8",
    "R32_F7",
    "R32_F8",
    "R32_T2",
    "R32_T7"
  );

  return (
    <div className="overflow-x-auto pb-6">
      <HeaderRow />

      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          minWidth: "max-content",
        }}
      >
        {/* ── Left half: R32 → R16 → QF → SF ── */}
        <SlotCol slots={leftR32} totalH={totalH} />
        <LeftConn leftN={8} rightN={4} totalH={totalH} />
        <SlotCol slots={leftR16} totalH={totalH} />
        <LeftConn leftN={4} rightN={2} totalH={totalH} />
        <SlotCol slots={leftQF} totalH={totalH} />
        <LeftConn leftN={2} rightN={1} totalH={totalH} />
        <SlotCol slots={leftSF} totalH={totalH} />
        <CenterConn side="left" totalH={totalH} />

        {/* ── Center: Final + 3rd-place ── */}
        <CenterCol
          finalSlot={finalSlot}
          thirdSlot={thirdSlot}
          totalH={totalH}
        />

        {/* ── Right half: SF → QF → R16 → R32 ── */}
        <CenterConn side="right" totalH={totalH} />
        <SlotCol slots={rightSF} totalH={totalH} />
        <RightConn leftN={1} rightN={2} totalH={totalH} />
        <SlotCol slots={rightQF} totalH={totalH} />
        <RightConn leftN={2} rightN={4} totalH={totalH} />
        <SlotCol slots={rightR16} totalH={totalH} />
        <RightConn leftN={4} rightN={8} totalH={totalH} />
        <SlotCol slots={rightR32} totalH={totalH} />
      </div>
    </div>
  );
}
