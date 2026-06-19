// Regression snapshot for the 8 confirmed R32_F slots.
// Run with: npx tsx lib/bracket/__tests__/r32Fixed.test.ts
//
// The test constructs minimal fixed standings (all 12 groups, rank 1-3, 3 played)
// and checks that the 8 R32_F slots resolve to exact expected values.
// These expected values must remain byte-identical after changes to R32_T logic.

import { test } from "node:test";
import assert from "node:assert/strict";

// ── Minimal type shims (avoid path alias resolution) ──────────────────────────

type DbStanding = {
  team_id: number;
  team_name: string;
  team_logo: string | null;
  rank: number;
  points: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  group_name: string;
  league_id: number;
  season: number;
  updated_at: string;
};

// ── Fixed standings fixture — all 12 groups (48 teams), 3 games each ──────────

function makeStanding(
  overrides: Partial<DbStanding> & {
    team_id: number;
    team_name: string;
    rank: number;
    group_name: string;
  }
): DbStanding {
  return {
    team_logo: null,
    points: 0,
    played: 3,
    won: 0,
    drawn: 0,
    lost: 3,
    goals_for: 0,
    goals_against: 0,
    league_id: 1,
    season: 2026,
    updated_at: "2026-06-01",
    ...overrides,
  };
}

const GROUPS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
let tid = 1;

// Build 48 teams: 4 per group, ranks 1-4, with distinct points to ensure
// stable sort (rank-1: 9pts, rank-2: 6pts, rank-3: 3pts, rank-4: 0pts)
const standings: DbStanding[] = GROUPS.flatMap((g) =>
  [1, 2, 3, 4].map((rank) =>
    makeStanding({
      team_id: tid++,
      team_name: `Team-${g}${rank}`,
      rank,
      group_name: `Group ${g}`,
      points: [9, 6, 3, 0][rank - 1],
    })
  )
);

// ── Import resolver (relative path, no alias) ─────────────────────────────────
// NOTE: This import works with `npx tsx` from the project root.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { resolveBracket } = require("../resolveBracket") as {
  resolveBracket: (
    matches: never[],
    standings: DbStanding[]
  ) => Array<{
    def: { id: string; round: string };
    homeLabel: string;
    awayLabel: string;
    homeLogo: string | null;
    awayLogo: string | null;
    thirdsResolution?: { slotStatus: string };
  }>;
};

// ── Expected snapshots for R32_F slots (home = 1st place, away = 2nd place) ──
// Groups A-H are fixed (ABCDEFGH → sorted key, Annex C determines thirds).
// R32_F slots are purely group-based (type:"group") — unaffected by thirds.

const EXPECTED_F_SLOTS: Record<string, { homeLabel: string; awayLabel: string }> = {
  R32_F1: { homeLabel: "Team-A1", awayLabel: "Team-B2" }, // 1A v 2B
  R32_F2: { homeLabel: "Team-C1", awayLabel: "Team-D2" }, // 1C v 2D
  R32_F3: { homeLabel: "Team-E1", awayLabel: "Team-F2" }, // 1E v 2F
  R32_F4: { homeLabel: "Team-G1", awayLabel: "Team-H2" }, // 1G v 2H
  R32_F5: { homeLabel: "Team-I1", awayLabel: "Team-J2" }, // 1I v 2J
  R32_F6: { homeLabel: "Team-K1", awayLabel: "Team-L2" }, // 1K v 2L
  R32_F7: { homeLabel: "Team-B1", awayLabel: "Team-A2" }, // 1B v 2A
  R32_F8: { homeLabel: "Team-D1", awayLabel: "Team-C2" }, // 1D v 2C
};

test("R32_F slots resolve correctly and are unaffected by thirds logic", () => {
  const resolved = resolveBracket([], standings);
  const fSlots = resolved.filter((s) => s.def.id.startsWith("R32_F"));

  assert.equal(fSlots.length, 8, "Expected 8 R32_F slots");

  for (const slot of fSlots) {
    const expected = EXPECTED_F_SLOTS[slot.def.id];
    if (!expected) continue; // slot ID not in our table — skip, don't fail
    assert.equal(
      slot.homeLabel,
      expected.homeLabel,
      `${slot.def.id} homeLabel`
    );
    assert.equal(
      slot.awayLabel,
      expected.awayLabel,
      `${slot.def.id} awayLabel`
    );
    assert.equal(slot.thirdsResolution, undefined, `${slot.def.id} must not have thirdsResolution`);
  }
});

test("R32_T slots have thirdsResolution with status locked (all played=3)", () => {
  const resolved = resolveBracket([], standings);
  const tSlots = resolved.filter((s) => s.def.id.startsWith("R32_T"));

  assert.equal(tSlots.length, 8, "Expected 8 R32_T slots");

  for (const slot of tSlots) {
    assert.ok(
      slot.thirdsResolution !== undefined,
      `${slot.def.id} should have thirdsResolution`
    );
    assert.equal(
      slot.thirdsResolution!.slotStatus,
      "locked",
      `${slot.def.id} all groups played 3 → locked`
    );
  }
});