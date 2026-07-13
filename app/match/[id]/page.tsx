export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/server/supabase-admin";
import { notFound } from "next/navigation";
import MatchTabs from "@/components/info/MatchTabs";
import MatchScoreHeader from "@/components/info/MatchScoreHeader";
import { getOrSyncLeagueData } from "@/lib/server/sync-league";
import { getMatchDetails } from "@/lib/server/get-match-details";
import BackButton from "@/components/ui/BackButton";
import { League } from "@/types/sports";
import { cleanLeagueName } from "@/lib/teamName";
import type { DbMatch } from "@/types/sports";

function getCurrentSeason(leagueId: number): number {
  const now = new Date();
  if (leagueId === League.WorldCup) return now.getFullYear();
  return now.getMonth() < 6 ? now.getFullYear() - 1 : now.getFullYear();
}

function MatchTabsSkeleton() {
  return (
    <div className="space-y-6 w-full px-4 animate-pulse">
      {/* Tab bar */}
      <div className="flex justify-center border-b border-custom-gray">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="w-1/4 py-3 px-2">
            <div className="h-2.5 bg-custom-gray rounded mx-auto w-3/4" />
          </div>
        ))}
      </div>
      {/* Content rows */}
      <div className="space-y-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-14 bg-custom-gray rounded-xl" />
        ))}
      </div>
    </div>
  );
}

async function MatchContent({
  matchId,
  initialMatch,
}: {
  matchId: number;
  initialMatch: DbMatch;
}) {
  const currentSeason = getCurrentSeason(initialMatch.league_id);

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
    getMatchDetails(
      matchId,
      initialMatch.status,
      initialMatch.home_score,
      initialMatch.away_score
    ),
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
    <MatchTabs
      details={details}
      standings={standings}
      scorers={scorers}
      leagueName={cleanLeagueName(initialMatch.league_name)}
      leagueId={initialMatch.league_id}
      matchId={matchId}
      homeTeamName={initialMatch.home_team}
      awayTeamName={initialMatch.away_team}
      homeLogo={initialMatch.home_logo}
      awayLogo={initialMatch.away_logo}
      initialIsLive={(match ?? initialMatch).is_live}
      initialStatus={(match ?? initialMatch).status}
      initialElapsed={(match ?? initialMatch).elapsed}
      venueName={venueName}
      venueCity={venueCity}
      referee={referee}
      penaltyHome={(match ?? initialMatch).penalty_home}
      penaltyAway={(match ?? initialMatch).penalty_away}
      round={(match ?? initialMatch).round}
      kickoffDate={initialMatch.fixture_date}
    />
  );
}

export default async function MatchDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const matchId = parseInt(id);

  const [{ data: initialMatch }, { data: venueRow }] = await Promise.all([
    supabase.from("matches").select("*").eq("id", matchId).single(),
    supabaseAdmin
      .from("match_details")
      .select("venue_name, venue_city")
      .eq("match_id", matchId)
      .single(),
  ]);

  if (!initialMatch) {
    notFound();
  }

  return (
    <main className="max-w-3xl bg-background mx-auto py-4 text-white space-y-6">
      <div className="flex justify-start px-4">
        <BackButton />
      </div>

      {/* Renders immediately — only needs initialMatch from the DB */}
      <MatchScoreHeader
        initialMatch={initialMatch}
        details={null}
        venueName={venueRow?.venue_name ?? null}
        venueCity={venueRow?.venue_city ?? null}
      />

      {/* Streams in once standings + scorers + match details are ready */}
      <Suspense fallback={<MatchTabsSkeleton />}>
        <MatchContent matchId={matchId} initialMatch={initialMatch} />
      </Suspense>
    </main>
  );
}
