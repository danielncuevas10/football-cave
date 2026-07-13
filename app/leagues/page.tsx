import { getTranslations } from "next-intl/server";
import Image from "next/image";
import Link from "next/link";

export const revalidate = 3600;

const TEAM_IMG_BASE = "https://media.api-sports.io/football/teams";

const SECTION_CLASS =
  "flex flex-col gap-0 items-center justify-between bg-custom-gray p-3 rounded-xl border-b border-white/7 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]";

export default async function LeaguesPage() {
  const t = await getTranslations("quickNav");

  const teams = [
    { id: 541, label: "Real Madrid",       imgSrc: `${TEAM_IMG_BASE}/541.png`, isFlag: false },
    { id: 529, label: "Barcelona",          imgSrc: `${TEAM_IMG_BASE}/529.png`, isFlag: false },
    { id: 85,  label: "PSG",                imgSrc: `${TEAM_IMG_BASE}/85.png`,  isFlag: false },
    { id: 26,  label: t("argentina"),       imgSrc: "/images/flags/ar.svg",     isFlag: true  },
    { id: 9,   label: t("nationalSpain"),   imgSrc: "/images/flags/es.svg",     isFlag: true  },
    { id: 2,   label: t("nationalFrance"),  imgSrc: "/images/flags/fr.svg",     isFlag: true  },
  ];

  const leagues = [
    { id: 39,  label: t("leagueEngland"), flag: "/images/flags/gb-eng.svg" },
    { id: 140, label: t("leagueSpain"),   flag: "/images/flags/es.svg"     },
    { id: 61,  label: t("leagueFrance"),  flag: "/images/flags/fr.svg"     },
    { id: 78,  label: t("leagueGermany"), flag: "/images/flags/de.svg"     },
    { id: 135, label: t("leagueItaly"),   flag: "/images/flags/it.svg"     },
    { id: 262, label: t("leagueMexico"),  flag: "/images/flags/mx.svg"     },
    { id: 253, label: t("leagueUSA"),     flag: "/images/flags/us.svg"     },
  ];

  return (
    <div className="bg-background text-white px-6 pt-6 pb-24 max-w-7xl mx-auto flex flex-col gap-3">
      {/* Teams section */}
      <div className={SECTION_CLASS}>
        <p className="w-full text-[10px] tracking-widest text-gray-200 font-medium mb-2">
          {t("teams")}
        </p>
        <div className="w-full flex flex-col">
          {teams.map(({ id, label, imgSrc, isFlag }) => (
            <Link
              key={id}
              href={`/team/${id}`}
              className="flex items-center gap-3 px-1 py-3 rounded-lg hover:bg-white/5 transition-colors group w-full border-b border-white/5 last:border-0"
            >
              {isFlag ? (
                <Image
                  src={imgSrc}
                  alt={label}
                  width={28}
                  height={20}
                  className="rounded-sm object-cover shrink-0"
                />
              ) : (
                <div className="w-7 h-5 relative shrink-0">
                  <Image
                    src={imgSrc}
                    alt={label}
                    fill
                    className="object-contain"
                    sizes="28px"
                  />
                </div>
              )}
              <span className="text-[13px] text-gray-300 group-hover:text-white transition-colors">
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
          {leagues.map(({ id, label, flag }) => (
            <Link
              key={id}
              href={`/league/${id}`}
              className="flex items-center gap-3 px-1 py-3 rounded-lg hover:bg-white/5 transition-colors group w-full border-b border-white/5 last:border-0"
            >
              <Image
                src={flag}
                alt={label}
                width={28}
                height={20}
                className="rounded-sm object-cover shrink-0"
              />
              <span className="text-[13px] text-gray-300 group-hover:text-white transition-colors">
                {label}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
