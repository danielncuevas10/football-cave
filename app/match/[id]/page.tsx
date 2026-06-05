import { supabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import MatchTabs from "@/components/info/MatchTabs";
import MatchScoreHeader from "@/components/info/MatchScoreHeader";
import { getOrSyncLeagueData } from "@/lib/server/sync-league";
import { getMatchDetails } from "@/lib/server/get-match-details";
import BackButton from "@/components/ui/BackButton";

export default async function MatchDetailsPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = await params;
  const matchId = parseInt(id);

  const { data: initialMatch } = await supabase
    .from("matches")
    .select("*")
    .eq("id", matchId)
    .single();

  if (!initialMatch) {
    notFound();
  }

  const currentSeason = 2025;
  const [{ standings, scorers }, details] = await Promise.all([
    getOrSyncLeagueData(initialMatch.league_id, currentSeason),
    getMatchDetails(matchId),
  ]);

  // Re-read the match after getMatchDetails so any score it wrote back
  // to the matches table (cron sync lag fix) is reflected on first render.
  const { data: match } = await supabase
    .from("matches")
    .select("*")
    .eq("id", matchId)
    .single();

  return (
    <main className="max-w-3xl bg-[#1B1B1B] mx-auto p-6 text-white space-y-6">
      <div className="flex justify-start">
        <BackButton />
      </div>

      <MatchScoreHeader initialMatch={match ?? initialMatch} details={details} />

      <MatchTabs
        details={details}
        standings={standings}
        scorers={scorers}
        leagueName={initialMatch.league_name}
        leagueLogo={initialMatch.league_logo}
        leagueId={initialMatch.league_id}
        matchId={matchId}
        initialIsLive={(match ?? initialMatch).is_live}
        initialStatus={(match ?? initialMatch).status}
      />
    </main>
  );
}
