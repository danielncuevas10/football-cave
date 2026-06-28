import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  const { data, error } = await supabase
    .from('standings')
    .select('group_name, rank, team_name')
    .eq('league_id', 1)
    .order('group_name')
    .order('rank')

  if (error) { console.error(error); process.exit(1) }

  const byGroup: Record<string, string[]> = {}
  for (const row of data ?? []) {
    const g = row.group_name ?? 'unknown'
    if (!byGroup[g]) byGroup[g] = []
    byGroup[g].push(`${row.rank}. ${row.team_name}`)
  }

  for (const [group, teams] of Object.entries(byGroup)) {
    console.log(group + ': ' + teams.join(', '))
  }
  console.log('Total groups:', Object.keys(byGroup).length)
}

main().catch(console.error)
