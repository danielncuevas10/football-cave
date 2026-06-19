import { supabaseAdmin } from "@/lib/server/supabase-admin";
import type { DbMatch, DbStanding } from "@/types/sports";
import BracketBottomSheet from "./BracketBottomSheet";

// Async server component for the mobile sticky bracket sheet.
// Fetches standings independently — wrapped in <Suspense fallback={null}>
// so the main content renders before this data arrives.
export default async function MobileBracketServer({
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

  return <BracketBottomSheet wcMatches={wcMatches} wcStandings={wcStandings} />;
}