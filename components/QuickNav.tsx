import { getTranslations } from "next-intl/server";
import Image from "next/image";
import Link from "next/link";

const TEAM_IMG_BASE = "https://media.api-sports.io/football/teams";

const SECTION_CLASS =
  "flex flex-col gap-0 items-center justify-between bg-custom-gray p-3 rounded-xl border-b border-white/7 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]";

export default async function QuickNav() {
  const t = await getTranslations("quickNav");

  const teams = [
    { id: 541, label: "Real Madrid", imgSrc: `${TEAM_IMG_BASE}/541.png` },
    { id: 529, label: "Barcelona", imgSrc: `${TEAM_IMG_BASE}/529.png` },
    { id: 85, label: "PSG", imgSrc: `${TEAM_IMG_BASE}/85.png` },
    { id: 33, label: "Man United", imgSrc: `${TEAM_IMG_BASE}/33.png` },
    { id: 50, label: "Man City", imgSrc: `${TEAM_IMG_BASE}/50.png` },
    { id: 157, label: "Bayern", imgSrc: `${TEAM_IMG_BASE}/157.png` },
  ];

  const leagues = [
    { id: 2, label: "Champions League", flag: "/images/champions.svg", isEmblem: true },
    { id: 39, label: t("leagueEngland"), flag: "/images/flags/gb-eng.svg" },
    { id: 140, label: t("leagueSpain"), flag: "/images/flags/es.svg" },
    { id: 61, label: t("leagueFrance"), flag: "/images/flags/fr.svg" },
    { id: 78, label: t("leagueGermany"), flag: "/images/flags/de.svg" },
    { id: 262, label: t("leagueMexico"), flag: "/images/flags/mx.svg" },
    { id: 253, label: t("leagueUSA"), flag: "/images/flags/us.svg" },
    { id: 135, label: t("leagueItaly"), flag: "/images/flags/it.svg" },
  ];

  return (
    <nav className="flex flex-col gap-2 rounded-xl border-b border-white/7 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] overflow-hidden">
      {/* Teams section */}
      <div className={SECTION_CLASS}>
        <p className="w-full text-[10px] tracking-widest text-gray-200 font-medium mb-2">
          {t("teams")}
        </p>
        <div className="w-full flex flex-col">
          {teams.map(({ id, label, imgSrc }) => (
            <Link
              key={id}
              href={`/team/${id}`}
              className="flex items-center gap-3 px-1 py-2 rounded-lg hover:bg-white/5 transition-colors group w-full"
            >
              <div className="w-7 h-5 relative shrink-0">
                <Image
                  src={imgSrc}
                  alt={label}
                  fill
                  className="object-contain"
                  sizes="28px"
                />
              </div>
              <span className="text-[12px] text-gray-300 group-hover:text-white transition-colors truncate">
                {label}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* Leagues section */}
      <div className={SECTION_CLASS}>
        <p className="w-full text-[10px] tracking-widest text-gray-200 font-medium mb-2">
          {t("leagues")}
        </p>
        <div className="w-full flex flex-col">
          {leagues.map(({ id, label, flag, isEmblem }) => (
            <Link
              key={id}
              href={`/league/${id}`}
              className="flex items-center gap-3 px-1 py-2 rounded-lg hover:bg-white/5 transition-colors group w-full"
            >
              {isEmblem ? (
                <div className="w-5 h-5 relative shrink-0">
                  <Image
                    src={flag}
                    alt={label}
                    fill
                    className="object-contain"
                    sizes="20px"
                  />
                </div>
              ) : (
                <Image
                  src={flag}
                  alt={label}
                  width={28}
                  height={20}
                  className="rounded-sm object-cover shrink-0"
                />
              )}
              <span className="text-[12px] text-gray-300 group-hover:text-white transition-colors truncate">
                {label}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
