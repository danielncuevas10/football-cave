import { Suspense } from "react";
import ScoreList from "@/components/ScoreList";
import { supabaseAdmin } from "@/lib/server/supabase-admin";
import { footballApi } from "@/lib/server/football-api";
import type { DbMatch } from "@/types/sports";

const FINISHED_STATUSES = ["FT", "AET", "PEN", "AWD", "WO"];

// Syncs matches that are stale in the DB:
//   1. Finished matches with null scores (cron missed the result)
//   2. Matches whose kickoff has passed but are still marked NS/TBD (cron missed going live)
// Capped at 10 per page load to respect API rate limits.
async function syncMissingScores(matches: DbMatch[]): Promise<void> {
  const now = Date.now();
  const ninetyMinMs = 90 * 60 * 1000;
  const threeHoursMs = 3 * 60 * 60 * 1000;

  const needsSync = matches
    .filter((m) => {
      const age = now - new Date(m.fixture_date).getTime();
      // Case 1: finished/old match with no score yet
      if ((m.home_score === null || m.away_score === null) && age > ninetyMinMs) return true;
      // Case 2: kickoff passed but DB still shows NS/TBD — likely live and cron hasn't run
      if ((m.status === "NS" || m.status === "TBD") && age > 0 && age < threeHoursMs) return true;
      return false;
    })
    .slice(0, 10);

  if (!needsSync.length) return;

  await Promise.all(
    needsSync.map(async (m) => {
      const data = await footballApi.getMatchById(m.id);
      const row = data?.response?.[0];
      if (!row) return;

      const freshStatus = row.fixture.status.short;
      const isFinished = FINISHED_STATUSES.includes(freshStatus);
      const isLive = ["1H", "HT", "2H", "ET", "BT", "P", "LIVE"].includes(freshStatus);
      await supabaseAdmin
        .from("matches")
        .update({
          home_score: row.goals.home,
          away_score: row.goals.away,
          status: freshStatus,
          elapsed: row.fixture.status.elapsed,
          is_live: isLive,
          ...(isFinished ? { is_live: false } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq("id", m.id);
    })
  );
}

async function getInitialMatches(): Promise<DbMatch[]> {
  const { data } = await supabaseAdmin
    .from("matches")
    .select("*")
    .order("fixture_date", { ascending: false })
    .returns<DbMatch[]>();
  return data ?? [];
}

export default async function HomePage() {
  const staleMatches = await getInitialMatches();

  // Sync scores for recently finished matches that still show null in the DB.
  // After this write, re-read so ScoreList gets the real scores on first render.
  await syncMissingScores(staleMatches);
  const initialMatches = await getInitialMatches();

  return (
    <div className="min-h-screen bg-[#1B1B1B] text-white">
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-16">
        <Suspense
          fallback={
            <div className="text-gray-400 text-sm p-4">Loading matches…</div>
          }
        >
          <ScoreList initialMatches={initialMatches} />
        </Suspense>
      </main>
    </div>
  );
}
