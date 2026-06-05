import { NextRequest, NextResponse } from "next/server";
import { guardRoute } from "@/lib/api-guard";
import { getMatchDetails } from "@/lib/server/get-match-details";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const blocked = await guardRoute(req);
  if (blocked) return blocked;

  const { id } = await params;
  const matchId = parseInt(id);

  if (isNaN(matchId)) {
    return NextResponse.json({ error: "Invalid Match ID" }, { status: 400 });
  }

  const details = await getMatchDetails(matchId);

  if (!details) {
    return NextResponse.json({ error: "No details available" }, { status: 404 });
  }

  return NextResponse.json(details);
}