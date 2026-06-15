import { NextRequest, NextResponse } from "next/server"
import { verifyCronSecret } from "@/lib/api-guard"
import { fixtureQuerySchema } from "@/lib/schemas"
import { footballApi } from "@/lib/server/football-api"
import { supabaseAdmin } from "@/lib/server/supabase-admin"

interface ApiStandingItem {
  rank: number;
  team: {
    id: number;
    name: string;
    logo: string;
  };
  points: number;
  group?: string | null;
  all: {
    played: number;
    win: number;
    draw: number;
    lose: number;
    goals: {
      for: number;
      against: number;
    };
  };
}

export async function GET(req: NextRequest) {
  const blocked = verifyCronSecret(req)
  if (blocked) return blocked

  const params = Object.fromEntries(new URL(req.url).searchParams)
  const parsed = fixtureQuerySchema.safeParse(params)

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid params" }, { status: 400 })
  }

  const { leagueId, season } = parsed.data
  const fresh = await footballApi.standings(leagueId, season) 

  if (!fresh || !fresh.response?.[0]?.league?.standings) {
    return NextResponse.json({ error: "Failed to load standings" }, { status: 500 })
  }

  const league = fresh.response[0].league
  const flattenedStandings = league.standings.flat() as ApiStandingItem[]

  const rows = flattenedStandings.map((team) => ({
    team_id: team.team.id,
    team_name: team.team.name,
    team_logo: team.team.logo,
    league_id: league.id,
    season,
    rank: team.rank,
    points: team.points,
    played: team.all.played,
    won: team.all.win,
    drawn: team.all.draw,
    lost: team.all.lose,
    goals_for: team.all.goals.for,
    goals_against: team.all.goals.against,
    group_name: team.group || null, 
    updated_at: new Date().toISOString(),
  }))

  // FIX: Filter out any duplicate team rows before sending to Supabase
  const seenTeamIds = new Set<number>();
  const uniqueRows = rows.filter((row) => {
    if (seenTeamIds.has(row.team_id)) {
      return false; // Skip if we already processed this team
    }
    seenTeamIds.add(row.team_id);
    return true;
  });

  // Send the unique entries to upsert
  const { error } = await supabaseAdmin
    .from("standings")
    .upsert(uniqueRows, { onConflict: "team_id,league_id,season" });

  if (error) {
    console.error("standings upsert error:", error.message)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }

  return NextResponse.json(uniqueRows)
}