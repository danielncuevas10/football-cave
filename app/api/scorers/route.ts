import { NextRequest, NextResponse } from "next/server"
import { guardRoute } from "@/lib/api-guard"
import { scorerQuerySchema } from "@/lib/schemas"
import { footballApi } from "@/lib/server/football-api"
import { supabaseAdmin } from "@/lib/server/supabase-admin"

export async function GET(req: NextRequest) {
  const blocked = await guardRoute(req)
  if (blocked) return blocked

  const params = Object.fromEntries(new URL(req.url).searchParams)
  const parsed = scorerQuerySchema.safeParse(params)

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid params" }, { status: 400 })
  }

  const { leagueId, season } = parsed.data
  const fresh = await footballApi.topScorers(leagueId, season)

  if (!fresh) {
    return NextResponse.json({ error: "Failed to load scorers" }, { status: 500 })
  }

  const rows = fresh.response.map((item) => ({
    player_id: item.player.id,
    player_name: item.player.name,
    player_photo: item.player.photo,
    team_name: item.statistics[0]?.team.name ?? null,
    goals: item.statistics[0]?.goals.total ?? 0,
    assists: item.statistics[0]?.goals.assists ?? 0,
    appearances: item.statistics[0]?.games.appearences ?? 0,
    league_id: leagueId,
    season,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await supabaseAdmin
  .from("top_scorers")
  .upsert(rows, { onConflict: "player_id,league_id,season" });

  if (error) {
    console.error("scorers upsert error:", error.message)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }

  return NextResponse.json(rows)
}