import { getTranslations } from "next-intl/server";
import { supabaseAdmin } from "@/lib/server/supabase-admin";
import type { DbMatch, DbStanding } from "@/types/sports";
import TournamentBracket from "@/components/bracket/TournamentBracket";
import BackButton from "@/components/ui/BackButton";

export const revalidate = 60;

async function getWcMatches(): Promise<DbMatch[]> {
  const { data } = await supabaseAdmin
    .from("matches")
    .select("*")
    .eq("league_id", 1)
    .order("fixture_date", { ascending: true });
  return (data ?? []) as DbMatch[];
}

async function getWcStandings(): Promise<DbStanding[]> {
  const { data } = await supabaseAdmin
    .from("standings")
    .select("*")
    .eq("league_id", 1)
    .order("rank", { ascending: true });
  return (data ?? []) as DbStanding[];
}

export default async function BracketPage() {
  const t = await getTranslations("liveBadge");

  const [wcMatches, wcStandings] = await Promise.all([
    getWcMatches(),
    getWcStandings(),
  ]);

  return (
    <div className="min-h-screen bg-background text-white">
      <div className="w-full px-4 pt-5 pb-12">
        <div className="flex items-center gap-3 mb-6">
          <BackButton />
          <h1 className="text-sm font-extrabold tracking-widest uppercase text-white">
            {t("worldCup")}
          </h1>
        </div>

        <TournamentBracket matches={wcMatches} standings={wcStandings} />
      </div>
    </div>
  );
}
