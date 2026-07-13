"use client";

import { useTranslations, useLocale } from "next-intl";
import { getLocalizedTeamName } from "@/lib/teamName";
import { League } from "@/types/sports";
import type { DbStanding } from "@/types/sports";
import Image from "next/image";
import Link from "next/link";

interface Props {
  standings: DbStanding[];
  highlightNames?: string[];
}

// ── Zone colour logic ──────────────────────────────────────────────────────────
// groupTeams = all rows in the same conference/group as `team`
function getZoneBorder(team: DbStanding, groupTeams: DbStanding[]): string {
  const rank = team.rank ?? 0;
  if (rank === 0) return "";
  const total = groupTeams.length;

  switch (team.league_id) {
    case League.ChampionsLeague:
      if (rank <= 8) return "border-l-[3px] border-l-emerald-500 bg-emerald-950/5";
      if (rank <= 24) return "border-l-[3px] border-l-amber-500 bg-amber-950/5";
      return "border-l-[3px] border-l-rose-500 bg-rose-950/5";

    case League.LaLiga:
      if (rank <= 4) return "border-l-[3px] border-l-[#00088E]";
      if (rank === 5) return "border-l-[3px] border-l-[#EB6A0A]";
      if (rank === 6) return "border-l-[3px] border-l-[#228B22]";
      if (rank > total - 3) return "border-l-[3px] border-l-[#FF0000]";
      return "";

    case League.PremierLeague:
      if (rank <= 4) return "border-l-[3px] border-l-[#00088E]";
      if (rank === 5) return "border-l-[3px] border-l-[#EB6A0A]";
      if (rank === 6) return "border-l-[3px] border-l-[#228B22]";
      if (rank > total - 3) return "border-l-[3px] border-l-[#FF0000]";
      return "";

    case League.MLS:
      // Top 9 per conference qualify for the MLS Cup Playoffs
      if (rank <= 9) return "border-l-[3px] border-l-emerald-500";
      return "";

    case League.LigaMX:
      if (rank <= 6) return "border-l-[3px] border-l-emerald-500";
      if (rank <= 10) return "border-l-[3px] border-l-[#EB6A0A]";
      return "";

    default:
      return "";
  }
}

// ── Per-league zone legend ─────────────────────────────────────────────────────
const ZONE_LEGENDS: Partial<Record<number, { color: string; labelKey: string }[]>> = {
  [League.ChampionsLeague]: [
    { color: "#10b981", labelKey: "zoneDirectQualification" },
    { color: "#f59e0b", labelKey: "zonePlayOff" },
    { color: "#f43f5e", labelKey: "eliminated" },
  ],
  [League.PremierLeague]: [
    { color: "#00088E", labelKey: "zoneChampionsLeague" },
    { color: "#EB6A0A", labelKey: "zoneEuropaLeague" },
    { color: "#228B22", labelKey: "zoneConferenceLeague" },
    { color: "#FF0000", labelKey: "zoneRelegation" },
  ],
  [League.LaLiga]: [
    { color: "#00088E", labelKey: "zoneChampionsLeague" },
    { color: "#EB6A0A", labelKey: "zoneEuropaLeague" },
    { color: "#228B22", labelKey: "zoneConferenceLeague" },
    { color: "#FF0000", labelKey: "zoneRelegation" },
  ],
  [League.MLS]: [{ color: "#10b981", labelKey: "zonePlayoffs" }],
  [League.LigaMX]: [
    { color: "#10b981", labelKey: "zoneQuarterfinals" },
    { color: "#EB6A0A", labelKey: "zonePlayIn" },
  ],
};

function ZoneLegend({ leagueId }: { leagueId: number | undefined }) {
  const t = useTranslations("matchTabs");
  const zones = leagueId !== undefined ? ZONE_LEGENDS[leagueId] : undefined;
  if (!zones?.length) return null;
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 px-4 py-3 border-t border-gray-800/40">
      {zones.map((z) => (
        <div key={z.labelKey} className="flex items-center gap-1.5">
          <div
            className="w-2.5 h-2.5 rounded-sm shrink-0"
            style={{ backgroundColor: z.color }}
          />
          <span className="text-[10px] text-gray-400">{t(z.labelKey)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function StandingsTable({ standings, highlightNames = [] }: Props) {
  const t = useTranslations("matchTabs");
  const locale = useLocale();
  const leagueId = standings[0]?.league_id;

  // Group by conference/group when the standings contain multiple groups (e.g. MLS)
  const groupMap = new Map<string, DbStanding[]>();
  for (const team of standings) {
    const key = team.group_name ?? "";
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(team);
  }
  const hasGroups = groupMap.size > 1;

  function renderRows(groupTeams: DbStanding[]) {
    return groupTeams.map((team) => {
      const zoneClass = getZoneBorder(team, groupTeams);
      const isHighlighted = highlightNames.includes(team.team_name);
      return (
        <tr
          key={`${team.team_id}-${team.group_name ?? ""}`}
          className={`border-b border-gray-800/50 transition-colors ${isHighlighted ? "bg-accent/50" : "hover:bg-gray-800/30"}`}
        >
          <td
            className={`w-8 px-2 py-3 text-center text-xs font-mono text-gray-400 ${zoneClass}`}
          >
            {team.rank}
          </td>
          <td className="px-3 py-3 min-w-0">
            <Link
              href={`/team/${team.team_id}`}
              className="flex items-center gap-2 hover:opacity-75 transition-opacity min-w-0"
            >
              {team.team_logo && (
                <Image
                  src={team.team_logo}
                  alt={team.team_name}
                  width={20}
                  height={20}
                  className="object-contain w-5 h-5 shrink-0"
                />
              )}
              <span className="font-sans text-sm text-gray-100 truncate">
                {getLocalizedTeamName(team.team_name, locale)}
              </span>
            </Link>
          </td>
          <td className="w-8 px-1 py-3 text-center text-xs font-mono">{team.played}</td>
          <td className="w-7 px-1 py-3 text-center text-xs font-mono">{team.won}</td>
          <td className="w-7 px-1 py-3 text-center text-xs font-mono">{team.drawn}</td>
          <td className="w-7 px-1 py-3 text-center text-xs font-mono">{team.lost}</td>
          <td className="w-10 px-2 py-3 text-center text-xs font-mono font-bold text-white bg-custom-gray/30">
            {team.points}
          </td>
        </tr>
      );
    });
  }

  return (
    <div className="w-full overflow-x-auto bg-custom-gray-2 border border-custom-gray-2 rounded-xl">
      <table className="w-full text-sm text-left text-gray-200 border-collapse table-fixed">
        <thead className="text-xs text-gray-300 uppercase bg-custom-gray border-b border-custom-gray">
          <tr>
            <th className="w-8 px-2 py-3 font-medium text-center">#</th>
            <th className="px-3 py-3 font-medium">{t("club")}</th>
            <th className="w-8 px-1 py-3 font-medium text-center" title="Played">MP</th>
            <th className="w-7 px-1 py-3 font-medium text-center" title="Won">W</th>
            <th className="w-7 px-1 py-3 font-medium text-center" title="Drawn">D</th>
            <th className="w-7 px-1 py-3 font-medium text-center" title="Lost">L</th>
            <th className="w-10 px-2 py-3 font-bold text-white text-center" title="Points">Pts</th>
          </tr>
        </thead>
        <tbody>
          {hasGroups
            ? Array.from(groupMap.entries()).flatMap(([groupName, groupTeams]) => [
                <tr key={`hdr-${groupName}`}>
                  <td
                    colSpan={7}
                    className="px-4 py-2 text-[11px] font-bold text-gray-300 uppercase tracking-wider bg-custom-gray/60 border-b border-gray-700/40"
                  >
                    {groupName}
                  </td>
                </tr>,
                ...renderRows(groupTeams),
              ])
            : renderRows(standings)}
        </tbody>
      </table>

      <ZoneLegend leagueId={leagueId} />
    </div>
  );
}
