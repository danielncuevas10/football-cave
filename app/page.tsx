import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import ScoreList from "@/components/ScoreList";
import About from "@/components/About";
import BracketPanelServer from "@/components/bracket/BracketPanelServer";
import { supabaseAdmin } from "@/lib/server/supabase-admin";
import { footballApi } from "@/lib/server/football-api";
import type { DbMatch } from "@/types/sports";

// ISR: revalidate every 60 s. The sync below is capped so it runs at most
// once per minute across all requests in that window.
export const revalidate = 60;

const FINISHED_STATUSES = ["FT", "AET", "PEN", "AWD", "WO"];

// Fire-and-forget: patches stale match rows in the DB (missed cron result or
// a match that went live without the cron catching it). We intentionally do
// NOT await this — the SWR polling in ScoreList picks up any changes on the
// client, so the page can start streaming immediately without waiting for
// potentially slow external API calls (up to 10 sequential requests).
function syncMissingScores(matches: DbMatch[]): void {
  const now = Date.now();
  const ninetyMinMs = 90 * 60 * 1000;
  const threeHoursMs = 3 * 60 * 60 * 1000;

  const needsSync = matches
    .filter((m) => {
      const age = now - new Date(m.fixture_date).getTime();
      if ((m.home_score === null || m.away_score === null) && age > ninetyMinMs)
        return true;
      if (
        (m.status === "NS" || m.status === "TBD") &&
        age > 0 &&
        age < threeHoursMs
      )
        return true;
      return false;
    })
    .slice(0, 10);

  if (!needsSync.length) return;

  // Run in background — no await
  void Promise.all(
    needsSync.map(async (m) => {
      const data = await footballApi.getMatchById(m.id);
      const row = data?.response?.[0];
      if (!row) return;

      const freshStatus = row.fixture.status.short;
      const isFinished = FINISHED_STATUSES.includes(freshStatus);
      const isLive = ["1H", "HT", "2H", "ET", "BT", "P", "LIVE"].includes(
        freshStatus
      );
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
    .order("fixture_date", { ascending: false });
  return (data ?? []) as DbMatch[];
}

export default async function HomePage() {
  const [t, initialMatches] = await Promise.all([
    getTranslations("matchTabs"),
    getInitialMatches(),
  ]);

  // Kick off background sync — does not block the render
  syncMissingScores(initialMatches);

  const wcMatches = initialMatches.filter((m) => m.league_id === 1);

  return (
    <>
      <div className="bg-[#101010] text-white px-6">
        {/* Responsive wrapper: matches list (left) + bracket panel (right, lg+) */}
        <div className="flex max-w-7xl lg:max-w-360 mx-auto">
          <main className="flex-1 min-w-0 pt-6 pb-6">
            {/* Matches render on the first byte — no dependency on standings */}
            <Suspense
              fallback={
                <div className="text-gray-200 text-sm p-4">
                  {t("loadingMatches")}
                </div>
              }
            >
              <ScoreList initialMatches={initialMatches} />
            </Suspense>
          </main>

          {/* Desktop: bracket streams in via its own Suspense boundary.
              Standings are fetched inside BracketPanelServer in parallel
              with the match list render — users see matches first. */}
          <aside className="hidden lg:flex flex-col w-[42%] shrink-0 pl-6">
            <div className="sticky top-22 flex flex-col flex-1 min-h-0 pt-6 pb-6">
              <Suspense fallback={<BracketSkeleton />}>
                <BracketPanelServer wcMatches={wcMatches} />
              </Suspense>
            </div>
          </aside>
        </div>
      </div>

    </>
  );
}

// Minimal skeleton shown in the desktop bracket sidebar while standings load
function BracketSkeleton() {
  return (
    <div className="flex flex-col gap-3 pt-2 animate-pulse">
      <div className="h-8 rounded bg-custom-gray w-full" />
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-14 rounded bg-custom-gray w-full" />
      ))}
    </div>
  );
}
