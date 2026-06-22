/**
 * One-time fix for match 1489397.
 * The match finished 4-0 but match_details had 5 Goal events because a goal
 * at 90+2' was scored during the live window and disallowed by VAR.
 *
 * The matches.home_score was already correct at 4 when this ran.
 * This script removes only the latest Goal event from match_details so that
 * the event count matches the stored score.
 *
 * Already applied — kept here as a record of what was done.
 * Result: Spain 4-0 Saudi Arabia, 4 Goal events (10', 21', 24', 49' OG).
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envContent = readFileSync(resolve(__dirname, "../.env.local"), "utf-8");
for (const line of envContent.split("\n")) {
  const m = line.match(/^([^=]+)=["']?(.+?)["']?\s*$/);
  if (m) process.env[m[1]] = m[2];
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const MATCH_ID = 1489397;

async function main() {
  const { data: match } = await supabase
    .from("matches")
    .select("home_team, away_team, home_score, away_score, status")
    .eq("id", MATCH_ID)
    .single();

  const { data: details } = await supabase
    .from("match_details")
    .select("events")
    .eq("match_id", MATCH_ID)
    .single();

  const events = details?.events ?? [];
  const goalEvents = events.filter(
    (e) => e.type === "Goal" && e.detail !== "Missed Penalty"
  );
  const expectedGoals = (match.home_score ?? 0) + (match.away_score ?? 0);

  console.log(`Score: ${match.home_team} ${match.home_score} – ${match.away_score} ${match.away_team} [${match.status}]`);
  console.log(`Expected goals: ${expectedGoals} | Goal events: ${goalEvents.length}`);

  if (goalEvents.length === expectedGoals) {
    console.log("Already consistent — nothing to do.");
    return;
  }

  if (goalEvents.length < expectedGoals) {
    console.log("Fewer events than score — cannot fix automatically.");
    return;
  }

  // Remove the latest Goal event (highest elapsed+extra time)
  const sorted = [...goalEvents].sort((a, b) => {
    const ta = (a.time?.elapsed ?? 0) * 100 + (a.time?.extra ?? 0);
    const tb = (b.time?.elapsed ?? 0) * 100 + (b.time?.extra ?? 0);
    return tb - ta;
  });

  const toRemove = sorted[0];
  const extraStr = toRemove.time?.extra != null ? `+${toRemove.time.extra}` : "";
  console.log(`Removing: ${toRemove.time?.elapsed}${extraStr}' | ${toRemove.team?.name} | ${toRemove.player?.name}`);

  const targetIdx = events.findIndex(
    (e) =>
      e.type === "Goal" &&
      e.detail !== "Missed Penalty" &&
      e.time?.elapsed === toRemove.time?.elapsed &&
      e.time?.extra === toRemove.time?.extra &&
      e.player?.id === toRemove.player?.id
  );

  const filteredEvents = [...events.slice(0, targetIdx), ...events.slice(targetIdx + 1)];

  const { error } = await supabase
    .from("match_details")
    .update({ events: filteredEvents, updated_at: new Date().toISOString() })
    .eq("match_id", MATCH_ID);

  console.log(error ? `Error: ${error.message}` : "Events fixed.");
}

main().catch(console.error);