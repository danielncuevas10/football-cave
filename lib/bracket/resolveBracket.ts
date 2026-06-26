import type { DbMatch, DbStanding } from "@/types/sports";
import type { GroupLetter, ResolvedSlot, SlotRef, ThirdsSlotResolution } from "@/types/bracket";
import { ALL_BRACKET_DEFS } from "./r32Slots";
import { getThirdAssignments } from "./thirdsLookup";

// ─── Helpers ─────────────────────────────────────────────────────────────────

type GroupRankKey = `${1 | 2 | 3}_${GroupLetter}`;

function buildStandingMap(standings: DbStanding[]): Map<GroupRankKey, DbStanding> {
  const map = new Map<GroupRankKey, DbStanding>();
  for (const s of standings) {
    const letter = (s.group_name ?? "").replace(/^Group\s*/i, "").trim();
    if (!letter || s.rank > 3) continue;
    const key = `${s.rank as 1 | 2 | 3}_${letter as GroupLetter}` as GroupRankKey;
    map.set(key, s);
  }
  return map;
}

function findMatchByTeams(
  pool: DbMatch[],
  teamA: string,
  teamB: string
): DbMatch | null {
  return (
    pool.find(
      (m) =>
        (m.home_team === teamA && m.away_team === teamB) ||
        (m.home_team === teamB && m.away_team === teamA)
    ) ?? null
  );
}

function isR32(m: DbMatch): boolean {
  const r = (m.round ?? "").toLowerCase();
  return r.includes("32");
}

function matchesByStage(
  matches: DbMatch[],
  stageKey: "R16" | "QF" | "SF" | "FINAL" | "THIRD"
): DbMatch[] {
  return matches
    .filter((m) => {
      const r = (m.round ?? "").toLowerCase();
      switch (stageKey) {
        case "R16":
          return m.stage === "R16" || r.includes("round of 16") || r.includes("last 16");
        case "QF":
          return m.stage === "QF" || r.includes("quarter");
        case "SF":
          return m.stage === "SF" || r.includes("semi");
        case "FINAL":
          return (
            m.stage === "FINAL" &&
            !r.includes("third") &&
            !r.includes("3rd") &&
            !r.includes("place")
          );
        case "THIRD":
          return (
            m.stage === "FINAL" &&
            (r.includes("third") || r.includes("3rd") || r.includes("place"))
          );
      }
    })
    .sort(
      (a, b) =>
        new Date(a.fixture_date).getTime() - new Date(b.fixture_date).getTime()
    );
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Pure resolver: maps every bracket slot definition to a DbMatch (if the
 * match already exists in the DB) plus the best-known team labels.
 *
 * For R32 group slots the team label comes from current standings even before
 * a match is scheduled — the bracket always shows who WOULD advance today.
 * For R16+ stages, matches are assigned sequentially by fixture_date.
 */
export function resolveBracket(
  matches: DbMatch[],
  standings: DbStanding[]
): ResolvedSlot[] {
  const standingMap = buildStandingMap(standings);

  // ── Determine qualifying 3rd-place teams ──────────────────────────────────
  const allThirds = standings
    .filter((s) => s.rank === 3)
    .sort((a, b) => {
      const pts = b.points - a.points;
      if (pts !== 0) return pts;
      const gd =
        b.goals_for - b.goals_against - (a.goals_for - a.goals_against);
      if (gd !== 0) return gd;
      return b.goals_for - a.goals_for;
    });

  const top8Thirds = allThirds.slice(0, 8);
  const qualifyingGroups: GroupLetter[] = top8Thirds
    .map((s) =>
      (s.group_name ?? "").replace(/^Group\s*/i, "").trim() as GroupLetter
    )
    .filter(Boolean);

  const thirdAssignments =
    qualifyingGroups.length === 8
      ? getThirdAssignments(qualifyingGroups)
      : null;

  // ── Status helper for R32_T slots ────────────────────────────────────────
  function getThirdResolution(slotId: string): ThirdsSlotResolution | undefined {
    if (!thirdAssignments) return { slotStatus: "tbd" };
    const assignedGroup = thirdAssignments[slotId];
    if (!assignedGroup) return { slotStatus: "tbd" };
    const s = standingMap.get(`3_${assignedGroup}` as GroupRankKey);
    const slotStatus = !s ? "tbd" : s.played >= 3 ? "locked" : "projected";
    return { slotStatus };
  }

  // ── Team-label resolver for a single SlotRef ──────────────────────────────
  function resolveRef(
    ref: SlotRef,
    slotId: string
  ): { label: string; logo: string | null; standing: DbStanding | null } {
    if (ref.type === "group") {
      const key = `${ref.position}_${ref.group}` as GroupRankKey;
      const s = standingMap.get(key);
      return s
        ? { label: s.team_name, logo: s.team_logo, standing: s }
        : { label: `${ref.position}${ref.group}`, logo: null, standing: null };
    }

    if (ref.type === "third") {
      if (!thirdAssignments) return { label: "TBD", logo: null, standing: null };
      const assignedGroup = thirdAssignments[slotId];
      if (!assignedGroup) return { label: "TBD", logo: null, standing: null };
      const key = `3_${assignedGroup}` as GroupRankKey;
      const s = standingMap.get(key);
      return s
        ? { label: s.team_name, logo: s.team_logo, standing: s }
        : {
            label: `3rd-${assignedGroup}`,
            logo: null,
            standing: null,
          };
    }

    // winner/loser refs — cannot be resolved without match results
    return { label: "TBD", logo: null, standing: null };
  }

  // ── Pre-built match queues for each post-R32 stage ────────────────────────
  const queues = {
    R16: matchesByStage(matches, "R16"),
    QF: matchesByStage(matches, "QF"),
    SF: matchesByStage(matches, "SF"),
    FINAL: matchesByStage(matches, "FINAL"),
    THIRD: matchesByStage(matches, "THIRD"),
  } as const;
  const qIdx: Record<string, number> = {
    R16: 0,
    QF: 0,
    SF: 0,
    FINAL: 0,
    THIRD: 0,
  };

  const r32Pool = matches.filter(isR32);

  // ── Map each definition to a ResolvedSlot ─────────────────────────────────
  return ALL_BRACKET_DEFS.map((def) => {
    const homeInfo = resolveRef(def.home, def.id);
    const awayInfo = resolveRef(def.away, def.id);

    let match: DbMatch | null = null;
    let fixtureDate: string | null = null;

    if (def.round === "R32") {
      // Full match: requires both teams confirmed in standings
      if (homeInfo.standing && awayInfo.standing) {
        match = findMatchByTeams(
          r32Pool,
          homeInfo.standing.team_name,
          awayInfo.standing.team_name
        );
        fixtureDate = match?.fixture_date ?? null;
      }

      // Partial date lookup: find any R32 fixture containing a known team.
      // Each team plays exactly one R32 game, so this is unambiguous.
      // Used to show the scheduled time even before both teams are confirmed.
      if (!fixtureDate) {
        const knownTeam =
          homeInfo.standing?.team_name ?? awayInfo.standing?.team_name ?? null;
        if (knownTeam) {
          const partial = r32Pool.find(
            (m) => m.home_team === knownTeam || m.away_team === knownTeam
          );
          fixtureDate = partial?.fixture_date ?? null;
        }
      }
    } else {
      const stageKey = def.round as keyof typeof queues;
      const queue = queues[stageKey];
      const idx = qIdx[stageKey];
      if (queue && idx < queue.length) {
        match = queue[idx];
        qIdx[stageKey]++;
      }
      fixtureDate = match?.fixture_date ?? null;
    }

    const homeLabel = match ? match.home_team : homeInfo.label;
    const awayLabel = match ? match.away_team : awayInfo.label;

    const thirdsResolution =
      def.round === "R32" && def.away.type === "third"
        ? getThirdResolution(def.id)
        : undefined;

    return {
      def,
      match,
      homeLabel,
      awayLabel,
      homeLogo: match?.home_logo ?? homeInfo.logo,
      awayLogo: match?.away_logo ?? awayInfo.logo,
      fixtureDate,
      thirdsResolution,
    };
  });
}
