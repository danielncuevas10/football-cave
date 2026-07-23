import type { useTranslations } from "next-intl";

type TFunc = ReturnType<typeof useTranslations<"matchDetails">>;

export function parseRound(
  round: string | null | undefined,
  t: TFunc
): string | null {
  if (!round) return null;
  const r = round.toLowerCase();

  const matchdayMatch = r.match(
    /(?:regular season|apertura|clausura)\s*[-–]\s*(\d+)/
  );
  if (matchdayMatch)
    return t("roundMatchday", { n: parseInt(matchdayMatch[1]) });

  if (
    r.includes("reclasificacion") ||
    r.includes("wild card") ||
    r.includes("play-off") ||
    r.includes("playoff")
  )
    return t("roundPlayoff");
  if (
    r.includes("round of 32") ||
    r.includes("1/16-finals") ||
    r.includes("last 32")
  )
    return t("roundR32");
  if (r.includes("round of 16") || r.includes("last 16")) return t("roundR16");
  if (r.includes("quarter")) return t("roundQF");
  if (r.includes("semi")) return t("roundSF");
  if (r.includes("final") && !r.includes("semi") && !r.includes("quarter"))
    return t("roundFinal");
  if (r.includes("group")) return t("roundGroup");

  const roundNumMatch = r.match(
    /(?:(\d+)(?:st|nd|rd|th)?\s+round|round\s+(\d+))/
  );
  if (roundNumMatch) {
    const n = parseInt(roundNumMatch[1] ?? roundNumMatch[2]);
    return t("roundNumber", { n });
  }

  return null;
}
