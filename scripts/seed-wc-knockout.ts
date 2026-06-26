/**
 * One-time script: fetches all WC 2026 fixtures from Football API and upserts
 * them to Supabase, including Round of 32 onwards.
 *
 * Usage: npx tsx --env-file=.env.local scripts/seed-wc-knockout.ts
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const API_KEY = process.env.API_FOOTBALL_KEY!;

if (!SUPABASE_URL || !SERVICE_KEY || !API_KEY) {
  console.error("❌ Missing env vars. Check .env.local");
  process.exit(1);
}

function standardizeRound(round: string | null | undefined): string | null {
  if (!round) return null;
  const r = round.toLowerCase();
  if (r.includes("group")) return "GROUP";
  if (r.includes("round of 32") || r.includes("1/16-finals") || r.includes("last 32")) return "R32";
  if (r.includes("round of 16") || r.includes("last 16")) return "R16";
  if (r.includes("quarter")) return "QF";
  if (r.includes("semi")) return "SF";
  if (r.includes("final") && !r.includes("semi") && !r.includes("quarter")) return "FINAL";
  if (r.includes("regular season")) return null;
  return "UNKNOWN";
}

async function fetchFixtures() {
  const url = "https://v3.football.api-sports.io/fixtures?league=1&season=2026&next=50";
  console.log("📡 Fetching upcoming WC 2026 fixtures from Football API...");

  const res = await fetch(url, {
    headers: { "x-apisports-key": API_KEY, Accept: "application/json" },
  });

  if (!res.ok) {
    console.error(`❌ Football API error: ${res.status}`);
    process.exit(1);
  }

  const json = await res.json();

  if (json.errors && Object.keys(json.errors).length > 0) {
    console.error("❌ API errors:", json.errors);
    process.exit(1);
  }

  return json.response as any[];
}

async function upsertToSupabase(rows: object[]) {
  const url = `${SUPABASE_URL}/rest/v1/matches`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(rows),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("❌ Supabase upsert failed:", text);
    process.exit(1);
  }
}

async function main() {
  const fixtures = await fetchFixtures();
  console.log(`✅ Got ${fixtures.length} upcoming fixtures from API`);

  const LIVE_STATUSES = ["1H", "HT", "2H", "ET", "BT", "P", "LIVE"];

  const rows = fixtures.map((m: any) => ({
    id: m.fixture.id,
    home_team: m.teams.home.name,
    away_team: m.teams.away.name,
    home_logo: m.teams.home.logo ?? null,
    away_logo: m.teams.away.logo ?? null,
    home_score: m.goals.home,
    away_score: m.goals.away,
    status: m.fixture.status.short,
    fixture_date: m.fixture.date,
    league_id: m.league.id,
    league_name: m.league.name,
    league_logo: m.league.logo ?? null,
    round: m.league.round ?? null,
    stage: standardizeRound(m.league.round),
    elapsed: m.fixture.status.elapsed,
    is_live: LIVE_STATUSES.includes(m.fixture.status.short),
  }));

  // Show what we're about to seed
  const byRound = rows.reduce((acc: Record<string, number>, r: any) => {
    const key = r.round ?? "unknown";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  console.log("\n📋 Fixtures by round:");
  for (const [round, count] of Object.entries(byRound)) {
    console.log(`  ${round}: ${count} matches`);
  }

  // Upsert in batches of 50
  const BATCH = 50;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    await upsertToSupabase(batch);
    console.log(`\n⬆️  Upserted ${Math.min(i + BATCH, rows.length)}/${rows.length}`);
  }

  console.log("\n✅ Done! WC knockout fixtures are now in Supabase.");
}

main().catch((e) => {
  console.error("❌ Script failed:", e);
  process.exit(1);
});
