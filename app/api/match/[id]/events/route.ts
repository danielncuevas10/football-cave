import { NextRequest, NextResponse } from "next/server";
import { guardRoute } from "@/lib/api-guard";
import { supabase } from "@/lib/supabase";

// Lightweight endpoint — reads only from match_details (no API call, no quota used).
// Called by MatchTabs every 60 s during live matches to pick up events the
// cron has written without the client burning any API quota.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const blocked = await guardRoute(req);
  if (blocked) return blocked;

  const { id } = await params;
  const matchId = parseInt(id);
  if (isNaN(matchId)) {
    return NextResponse.json({ error: "Invalid match ID" }, { status: 400 });
  }

  const { data } = await supabase
    .from("match_details")
    .select("match_id, events, lineups, statistics, updated_at, venue_name, venue_city, referee")
    .eq("match_id", matchId)
    .single();

  return NextResponse.json(data ?? null);
}
