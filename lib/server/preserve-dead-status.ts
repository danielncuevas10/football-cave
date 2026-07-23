import { supabaseAdmin } from "@/lib/server/supabase-admin";
import type { DbMatch } from "@/types/sports";

const DEAD_STATUSES = ["PST", "CANC", "SUSP", "ABD"] as const;
// Statuses where we defer to the DB — the API hasn't caught up yet.
const OVERRIDABLE_API_STATUSES = ["NS", "TBD"] as const;

type OverridableStatus = (typeof OVERRIDABLE_API_STATUSES)[number];
type DeadStatus = (typeof DEAD_STATUSES)[number];

/**
 * Prevents the sync from reverting manually-set dead statuses (PST/CANC/SUSP/ABD)
 * back to NS when the upstream API hasn't updated yet.
 *
 * For any row whose API status is NS or TBD but whose DB status is already a
 * dead status, the dead status is preserved in the returned rows.
 */
export async function preserveDeadStatuses<T extends { id: number; status: string }>(
  rows: T[]
): Promise<T[]> {
  const candidateIds = rows
    .filter((r) => (OVERRIDABLE_API_STATUSES as readonly string[]).includes(r.status))
    .map((r) => r.id);

  if (candidateIds.length === 0) return rows;

  const { data } = await supabaseAdmin
    .from("matches")
    .select("id, status")
    .in("id", candidateIds)
    .in("status", DEAD_STATUSES as unknown as DbMatch["status"][]);

  if (!data || data.length === 0) return rows;

  const deadById = new Map<number, DeadStatus>(
    data.map((r) => [r.id, r.status as DeadStatus])
  );

  return rows.map((row) => {
    const dbDeadStatus = deadById.get(row.id);
    if (dbDeadStatus && (OVERRIDABLE_API_STATUSES as readonly string[]).includes(row.status)) {
      return { ...row, status: dbDeadStatus };
    }
    return row;
  });
}
