"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

export default function About() {
  const t = useTranslations("about");
  const tBadge = useTranslations("liveBadge");
  const tTabs = useTranslations("matchTabs");

  return (
    <section className="px-4 lg:px-6 py-10 border-t border-custom-gray bg-[#303030]">
      <div className="max-w-7xl lg:max-w-360 mx-auto lg:flex lg:gap-12 lg:items-center">
        <div className="space-y-3 lg:w-1/2">
          <h2 className="text-base font-bold text-white tracking-tight">
            {t("title")}
          </h2>
          <p className="text-sm text-gray-200 leading-relaxed">{t("body")}</p>
        </div>

        <div className="hidden lg:flex lg:w-1/2 flex-col gap-3">
          <Link
            href="/league/1"
            className="flex items-center justify-between px-5 py-4 group"
          >
            <span className="text-sm font-medium text-white ">
              {tBadge("worldCup")}
            </span>
          </Link>
          <Link
            href="/bracket"
            className="flex items-center justify-between px-5 py-4 group"
          >
            <span className="text-sm font-medium text-white ">
              {tTabs("knockoutStage")}
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
