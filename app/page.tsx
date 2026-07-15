import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import ScoreList from "@/components/ScoreList";
import QuickNav from "@/components/QuickNav";
import { supabaseAdmin } from "@/lib/server/supabase-admin";
import type { DbMatch } from "@/types/sports";

// ISR: revalidate every 60 s.
export const revalidate = 60;

const DISPLAY_LEAGUE_IDS = [1, 2, 140, 39, 78, 61, 135, 253, 262];

// WARNING: this runs on the server in UTC. Users in UTC-offset timezones (e.g. Mexico UTC-5)
// may have a "today" that extends past midnight UTC. ScoreList always re-fetches on the
// client using local time to cover those gaps — do NOT add a guard that skips that fetch.
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

  return (
    <>
      <div className="bg-background text-white px-6">
        <div className="flex max-w-7xl lg:max-w-360 mx-auto">
          {/* Desktop left sidebar: teams & leagues quick-nav */}
          <aside className="hidden lg:flex flex-col w-[20%] shrink-0 pr-6">
            <div className="sticky top-22 pt-6 pb-6">
              <QuickNav />
            </div>
          </aside>

          <main className="flex-1 min-w-0 pt-6 pb-6">
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
        </div>
      </div>
    </>
  );
}
