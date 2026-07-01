import { getTranslations } from "next-intl/server";
import { supabaseAdmin } from "@/lib/server/supabase-admin";
import { footballApi } from "@/lib/server/football-api";
import { standardizeRound } from "@/lib/sync/standardizeRound";
import { LIVE_STATUSES } from "@/types/sports";
import type { DbMatch, DbStanding } from "@/types/sports";
import TournamentBracket from "@/components/bracket/TournamentBracket";
import BackButton from "@/components/ui/BackButton";

export const revalidate = 60;

function getCurrentSeason(): number {
  const now = new Date();
  return now.getMonth() < 6 ? now.getFullYear() - 1 : now.getFullYear();
}

const FINISHED_SET = new Set(["FT", "AET", "PEN", "AWD", "WO"]);

// Returns true if the DB is missing R16/QF/SF fixtures that should already
// exist based on how many R32/R16/QF matches have finished.
// Each pair of finished upstream matches should produce one downstream fixture.
function needsKnockoutSync(matches: DbMatch[]): boolean {
  const byStage = (stage: string, roundKeyword: string) =>
    matches.filter(
      (m) =>
        m.stage === stage ||
        (m.round ?? "").toLowerCase().includes(roundKeyword)
    );

  const r32Finished = byStage("R32", "round of 32").filter((m) =>
    FINISHED_SET.has(m.status)
  ).length;
  const r16InDb = byStage("R16", "round of 16").length;
  const r16Finished = byStage("R16", "round of 16").filter((m) =>
    FINISHED_SET.has(m.status)
  ).length;
  const qfInDb = byStage("QF", "quarter").length;
  const qfFinished = byStage("QF", "quarter").filter((m) =>
    FINISHED_SET.has(m.status)
  ).length;
  const sfInDb = byStage("SF", "semi").length;

  return (
    r16InDb < Math.floor(r32Finished / 2) ||
    qfInDb < Math.floor(r16Finished / 2) ||
    sfInDb < Math.floor(qfFinished / 2)
  );
}

async function syncKnockoutFixtures(): Promise<void> {
  const season = getCurrentSeason();
  const [upcoming, recent] = await Promise.all([
    footballApi.fixturesByLeague({ league: 1, season, next: 20 }),
    footballApi.fixturesByLeague({ league: 1, season, last: 5 }),
  ]);

  const combined = [
    ...(upcoming?.response ?? []),
    ...(recent?.response ?? []),
  ];
  if (!combined.length) return;

  const seen = new Set<number>();
  const unique = combined.filter((m) => {
    if (seen.has(m.fixture.id)) return false;
    seen.add(m.fixture.id);
    return true;
  });

  const knockoutKeywords = ["round of 16", "quarter", "semi", "final"];
  const knockouts = unique.filter((m) =>
    knockoutKeywords.some((k) =>
      (m.league.round ?? "").toLowerCase().includes(k)
    )
  );

  if (!knockouts.length) return;

  const rows: Omit<DbMatch, "updated_at">[] = knockouts.map((m) => ({
    id: m.fixture.id,
    home_team: m.teams.home.name,
    away_team: m.teams.away.name,
    home_logo: m.teams.home.logo ?? null,
    away_logo: m.teams.away.logo ?? null,
    home_score: m.goals.home,
    away_score: m.goals.away,
    penalty_home: m.score.penalty.home ?? null,
    penalty_away: m.score.penalty.away ?? null,
    status: m.fixture.status.short as DbMatch["status"],
    fixture_date: m.fixture.date,
    league_id: m.league.id,
    league_name: m.league.name,
    league_logo: m.league.logo ?? null,
    round: m.league.round ?? null,
    stage: standardizeRound(m.league.round),
    elapsed: m.fixture.status.elapsed,
    is_live: LIVE_STATUSES.includes(
      m.fixture.status.short as DbMatch["status"]
    ),
  }));

  await supabaseAdmin.from("matches").upsert(rows, { onConflict: "id" });
}

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

  // Fetch matches and standings in parallel
  let [wcMatches, wcStandings] = await Promise.all([
    getWcMatches(),
    getWcStandings(),
  ]);

  // If the DB is missing knockout fixtures the API already has (e.g. because
  // the discover cron ran with next:10 and missed R16+), sync them now and
  // re-read so this render is always accurate. Guarded by revalidate=60 so
  // the API is called at most once per minute globally.
  if (needsKnockoutSync(wcMatches)) {
    await syncKnockoutFixtures();
    wcMatches = await getWcMatches();
  }

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
