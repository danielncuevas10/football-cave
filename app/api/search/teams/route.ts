import { NextRequest, NextResponse } from "next/server";
import { guardRoute } from "@/lib/api-guard";
import { supabase } from "@/lib/supabase";
import { League } from "@/types/sports";

export type TeamSearchResult = {
  team_id: number;
  team_name: string;
  team_logo: string;
  rank: number;
  league_id: number;
};

export async function GET(req: NextRequest) {
  const blocked = await guardRoute(req);
  if (blocked) return blocked;

  const { data } = await supabase
    .from("standings")
    .select("team_id, team_name, team_logo, rank, league_id")
    .eq("league_id", League.WorldCup)
    .order("rank", { ascending: true });

  if (!data?.length) {
    return NextResponse.json([], { status: 200 });
  }

  return NextResponse.json(data as TeamSearchResult[], {
    headers: {
      "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
    },
  });
}
