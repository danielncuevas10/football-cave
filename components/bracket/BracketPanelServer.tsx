import { supabaseAdmin } from "@/lib/server/supabase-admin";
import type { DbMatch, DbStanding } from "@/types/sports";
import BracketPanel from "./BracketPanel";

// Async server component — fetches standings independently so the main page
// does not block on this data. Wrapped in <Suspense> at call site.
export default async function BracketPanelServer({
  wcMatches,
}: {
  wcMatches: DbMatch[];
}) {
  const { data } = await supabaseAdmin
    .from("standings")
    .select("*")
    .eq("league_id", 1)
    .order("rank", { ascending: true });
  const wcStandings = (data ?? []) as DbStanding[];

  return <BracketPanel wcMatches={wcMatches} wcStandings={wcStandings} />;
}