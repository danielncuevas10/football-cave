import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import ScoreList from "@/components/ScoreList";
import About from "@/components/About";
import BracketPanelServer from "@/components/bracket/BracketPanelServer";
import { supabaseAdmin } from "@/lib/server/supabase-admin";
import type { DbMatch } from "@/types/sports";

// ISR: revalidate every 60 s.
export const revalidate = 60;

const DISPLAY_LEAGUE_IDS = [1, 2, 140, 39, 78, 61, 135, 253, 262];

async function getInitialMatches(): Promise<DbMatch[]> {
  const today = new Date();
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setHours(23, 59, 59, 999);

  const { data } = await supabaseAdmin
    .from("matches")
    .select("*")
    .in("league_id", DISPLAY_LEAGUE_IDS)
    .gte("fixture_date", start.toISOString())
    .lte("fixture_date", end.toISOString())
    .order("fixture_date", { ascending: true });
  return (data ?? []) as DbMatch[];
}

export default async function HomePage() {
  const [t, initialMatches] = await Promise.all([
    getTranslations("matchTabs"),
    getInitialMatches(),
  ]);

  const wcMatches = initialMatches.filter((m) => m.league_id === 1);

  return (
    <>
      <div className="bg-background text-white px-6">
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
