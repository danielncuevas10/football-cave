import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  const { data, error } = await supabase
    .from('matches')
    .select('home_team, away_team, round, stage, fixture_date')
    .eq('league_id', 1)
    .eq('stage', 'R32')
    .order('fixture_date')

  if (error) { console.error(error); process.exit(1) }

  console.log('R32 matches in DB:')
  for (const m of data ?? []) {
    const d = new Date(m.fixture_date).toLocaleDateString()
    console.log(`  ${m.home_team} vs ${m.away_team}  [${d}]`)
  }
  console.log('Total:', data?.length)
}

main().catch(console.error)
