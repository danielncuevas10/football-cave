import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/auth-helpers-nextjs";
import { guardRoute } from "@/lib/api-guard";
import { getClientIp } from "@/lib/ratelimit";
import { supabaseAdmin } from "@/lib/server/supabase-admin";
import { predictionSchema } from "@/lib/schemas";

type Prediction = "home" | "draw" | "away";

interface VoteCounts {
  home: number;
  draw: number;
  away: number;
}

function calcPercentages(counts: VoteCounts): VoteCounts {
  const total = counts.home + counts.draw + counts.away;
  if (total === 0) return { home: 0, draw: 0, away: 0 };
  const h = Math.round((counts.home / total) * 100);
  const d = Math.round((counts.draw / total) * 100);
  return { home: h, draw: d, away: Math.max(0, 100 - h - d) };
}

async function getVoteCounts(
  matchId: number
): Promise<VoteCounts & { total: number }> {
  const { data } = await supabaseAdmin
    .from("predictions")
    .select("prediction")
    .eq("match_id", matchId)
    .eq("source", "user");

  const raw: VoteCounts = { home: 0, draw: 0, away: 0 };
  for (const row of data ?? []) {
    if (row.prediction === "home") raw.home++;
    else if (row.prediction === "draw") raw.draw++;
    else if (row.prediction === "away") raw.away++;
  }

  return {
    ...calcPercentages(raw),
    total: raw.home + raw.draw + raw.away,
  };
}

async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(ip);
  const buf = await crypto.subtle.digest("SHA-256", data);
  const hex = Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `anon:${hex}`;
}

async function getUserIdentifier(req: NextRequest): Promise<string> {
  const cookieStore = await cookies();
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );
  const {
    data: { session },
  } = await supabaseAuth.auth.getSession();

  if (session?.user?.id) return session.user.id;

  return hashIp(getClientIp(req));
}

// The GET endpoint is designed to later accept an additional data source.
// When a real predictions API is added, insert those as source='api' rows
// and add a query param ?source=api to switch the display. No schema changes needed.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const blocked = await guardRoute(req);
    if (blocked) return blocked;

    const { id } = await params;
    const matchId = parseInt(id, 10);
    if (isNaN(matchId) || matchId <= 0) {
      return NextResponse.json({ error: "Invalid match ID" }, { status: 400 });
    }

    const userIdentifier = await getUserIdentifier(req);

    const [counts, voteResult] = await Promise.all([
      getVoteCounts(matchId),
      supabaseAdmin
        .from("predictions")
        .select("prediction")
        .eq("match_id", matchId)
        .eq("user_identifier", userIdentifier)
        .maybeSingle(),
    ]);

    const userVote = (voteResult.data?.prediction as Prediction | null) ?? null;

    return NextResponse.json({ ...counts, userVote });
  } catch (e) {
    console.error("Prediction GET error:", e);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const blocked = await guardRoute(req);
    if (blocked) return blocked;

    const { id } = await params;
    const matchId = parseInt(id, 10);
    if (isNaN(matchId) || matchId <= 0) {
      return NextResponse.json({ error: "Invalid match ID" }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = predictionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.issues },
        { status: 400 }
      );
    }

    if (parsed.data.matchId !== matchId) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const userIdentifier = await getUserIdentifier(req);
    const prediction = parsed.data.prediction as Prediction;

    const { error: upsertError } = await supabaseAdmin
      .from("predictions")
      .upsert(
        {
          match_id: matchId,
          user_identifier: userIdentifier,
          prediction,
          source: "user",
        },
        { onConflict: "match_id,user_identifier" }
      );

    if (upsertError) {
      console.error("Prediction upsert error:", upsertError.message);
      return NextResponse.json(
        { error: "Failed to save prediction" },
        { status: 500 }
      );
    }

    const counts = await getVoteCounts(matchId);
    return NextResponse.json({ ...counts, userVote: prediction });
  } catch (e) {
    console.error("Prediction POST error:", e);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
