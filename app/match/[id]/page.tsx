export const revalidate = 300; // re-render at most every 5 minutes

import { supabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import MatchTabs from "@/components/info/MatchTabs";
import MatchScoreHeader from "@/components/info/MatchScoreHeader";
import { getOrSyncLeagueData } from "@/lib/server/sync-league";
import { getMatchDetails } from "@/lib/server/get-match-details";
import BackButton from "@/components/ui/BackButton";
import { League } from "@/types/sports";

function getCurrentSeason(leagueId: number): number {
  const now = new Date();
  if (leagueId === League.WorldCup) return now.getFullYear();
  return now.getMonth() < 6 ? now.getFullYear() - 1 : now.getFullYear();
}

export default async function MatchDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
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

  const currentSeason = getCurrentSeason(initialMatch.league_id);

  // World Cup standings are keyed by calendar year, not cross-year season,
  // so query without season filter to ensure we always get the live group data.
  const standingsQuery =
    initialMatch.league_id === League.WorldCup
      ? supabase
          .from("standings")
          .select("*")
          .eq("league_id", initialMatch.league_id)
          .order("rank", { ascending: true })
      : supabase
          .from("standings")
          .select("*")
          .eq("league_id", initialMatch.league_id)
          .eq("season", currentSeason)
          .order("rank", { ascending: true });

  const [
    standingsResult,
    { scorers },
    { details, venueName, venueCity, referee },
  ] = await Promise.all([
    standingsQuery,
    getOrSyncLeagueData(initialMatch.league_id, currentSeason),
    getMatchDetails(matchId, initialMatch.status, initialMatch.home_score, initialMatch.away_score),
  ]);

  const standings = standingsResult.data ?? [];

  // Re-read the match after getMatchDetails so any score it wrote back
  // to the matches table (cron sync lag fix) is reflected on first render.
  const { data: match } = await supabase
    .from("matches")
    .select("*")
    .eq("id", matchId)
    .single();

  return (
    <main className="max-w-3xl bg-[#101010] mx-auto py-4 text-white space-y-6">
      <div className="flex justify-start px-4">
        <BackButton />
      </div>

      <MatchScoreHeader
        initialMatch={match ?? initialMatch}
        details={details}
      />

      <MatchTabs
        details={details}
        standings={standings}
        scorers={scorers}
        leagueName={initialMatch.league_name}
        leagueLogo={initialMatch.league_logo}
        leagueId={initialMatch.league_id}
        matchId={matchId}
        homeTeamName={initialMatch.home_team}
        awayTeamName={initialMatch.away_team}
        initialIsLive={(match ?? initialMatch).is_live}
        initialStatus={(match ?? initialMatch).status}
        initialElapsed={(match ?? initialMatch).elapsed}
        venueName={venueName}
        venueCity={venueCity}
        referee={referee}
      />
    </main>
  );
}
