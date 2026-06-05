import { supabase } from "@/lib/supabase";
import TournamentBracket from "@/components/info/TournamentBracket";
import BackButton from "@/components/ui/BackButton";

export default async function Page() {
  <div className="flex justify-start">
    <BackButton />
  </div>;
  // Pull real fixtures with actual scores, live indicators, and landing IDs
  const { data: matches, error } = await supabase
    .from("matches")
    .select()
    .eq("league_id", 2) // Champions League (or change to your World Cup ID)
    .order("fixture_date", { ascending: true });

  if (error) {
    return (
      <div className="p-6 text-red-400 font-mono text-xs">
        Error loading data: {error.message}
      </div>
    );
  }

  if (!matches || matches.length === 0) {
    return (
      <div className="p-6 text-gray-400 text-sm font-medium">
        No matches found for this tournament.
      </div>
    );
  }

  return (
    <main className="max-w-6xl mx-auto p-6 text-white space-y-8">
      <div className="flex justify-start">
        <BackButton />
      </div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Knockout Stages</h1>
      </div>

      {/* Render the clean, singular bracket manager file */}
      <TournamentBracket matches={matches} />
    </main>
  );
}
