"use client";

import { useTranslations } from "next-intl";
import type { DbMatchDetails, TeamLineup } from "@/types/sports";

interface DetailsProps {
  details: DbMatchDetails | null;
}

export default function MatchCenterLinenups({ details }: DetailsProps) {
  const t = useTranslations("lineups");

  if (!details) {
    return (
      <div className="p-8 text-center text-gray-200 border border-custom-gray rounded-lg">
        {t("notAvailableYet")}
        <img
          src="/images/specs/clock.svg"
          alt=""
          className="w-8 h-8 object-contain mx-auto mt-4"
        />
      </div>
    );
  }

  if (!details.lineups || details.lineups.length === 0) {
    return (
      <div className="p-8 text-center text-gray-200 border border-custom-gray rounded-lg">
        {t("notAvailableYet")}
        <img
          src="/images/specs/clock.svg"
          alt=""
          className="w-8 h-8 object-contain mx-auto mt-4"
        />
      </div>
    );
  }

  // Build substitution maps from events so we can annotate players
  const subbedOut = new Map<number, number>(); // playerId → minute
  const subbedIn = new Map<number, number>();  // playerId → minute
  details.events?.forEach((ev) => {
    if (ev.type === "subst") {
      subbedOut.set(ev.player.id, ev.time.elapsed);
      if (ev.assist.id != null) subbedIn.set(ev.assist.id, ev.time.elapsed);
    }
  });

  return (
    <div className="space-y-6 w-full text-white">
      <div className="bg-custom-gray-2 rounded-xl border border-custom-gray overflow-hidden">
        {/* Main Layout Header */}
        <div className="bg-custom-gray flex items-center justify-center gap-2 py-4 text-[11px] font-light text-white tracking-widest border-b border-custom-gray">
          <span>{t("confirmedLineups")}</span>
          <img
            src="/images/specs/check.svg"
            alt=""
            className="w-5.5 h-5.5 object-contain"
          />
        </div>

        {/* ROW 1: Starting XI Side-by-Side */}
        <div className="grid grid-cols-2 gap-8 p-4">
          {details.lineups.map((lineup: TeamLineup, teamIdx: number) => (
            <div key={teamIdx} className="space-y-4">
              <div>
                <h4 className="font-bold text-gray-200 text-sm">
                  {lineup.team.name}
                </h4>

                {lineup.coach?.name && (
                  <div className="text-xs text-gray-400 pt-2">
                    <span className="font-medium text-gray-200">
                      {t("manager")}:
                    </span>{" "}
                    {lineup.coach.name}
                  </div>
                )}
                <p className="text-xs text-gray-400 pt-2">
                  {t("formation")}: {lineup.formation}
                </p>
              </div>

              <div className="space-y-1">
                <ul className="space-y-1 text-xs text-gray-300">
                  {lineup.startXI.map(
                    (
                      item: {
                        player: {
                          id: number;
                          name: string;
                          number: number;
                          pos: string | null;
                        };
                      },
                      playerIdx: number
                    ) => {
                      const outMinute = subbedOut.get(item.player.id);
                      return (
                        <li
                          key={playerIdx}
                          className="flex gap-2 py-1 last:border-0 items-center"
                        >
                          <span className="text-gray-400 w-5 text-right text-[11px]">
                            {item.player.number}
                          </span>
                          <span className={`font-medium min-w-0 flex-1 truncate ${outMinute !== undefined ? "text-gray-400" : "text-gray-200"}`}>
                            {item.player.name}
                          </span>
                          {outMinute !== undefined && (
                            <span className="flex items-center gap-0.5 ml-auto shrink-0">
                              <span className="text-[10px] text-gray-500">{outMinute}′</span>
                              <img
                                src="/images/specs/out.svg"
                                alt="subbed out"
                                className="w-3 h-3 object-contain"
                              />
                            </span>
                          )}
                        </li>
                      );
                    }
                  )}
                </ul>
              </div>
            </div>
          ))}
        </div>

        {/* ROW 2: Substitutes Side-by-Side */}
        <div className="grid grid-cols-2 gap-8 p-4 border-t border-gray-800/40 bg-gray-900/10">
          {details.lineups.map((lineup: TeamLineup, teamIdx: number) => (
            <div key={teamIdx} className="space-y-4">
              <div className="space-y-1">
                <h5 className="text-[11px] tracking-wider font-light text-gray-200 mb-4">
                  {t("substitutes")}
                </h5>
                <ul className="space-y-1 text-xs text-gray-400">
                  {lineup.substitutes.map(
                    (
                      item: {
                        player: {
                          id: number;
                          name: string;
                          number: number;
                          pos: string | null;
                        };
                      },
                      subIdx: number
                    ) => {
                      const inMinute = subbedIn.get(item.player.id);
                      return (
                        <li
                          key={subIdx}
                          className="flex gap-2 py-1 border-b border-gray-800/20 last:border-0 items-center"
                        >
                          <span className="text-gray-400 w-5 text-right text-[11px]">
                            {item.player.number}
                          </span>
                          <span className={`min-w-0 flex-1 truncate ${inMinute !== undefined ? "text-gray-200 font-medium" : "text-gray-300"}`}>
                            {item.player.name}
                          </span>
                          {inMinute !== undefined && (
                            <span className="flex items-center gap-0.5 ml-auto shrink-0">
                              <span className="text-[10px] text-gray-500">{inMinute}′</span>
                              <img
                                src="/images/specs/in.svg"
                                alt="subbed in"
                                className="w-3 h-3 object-contain"
                              />
                            </span>
                          )}
                        </li>
                      );
                    }
                  )}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
