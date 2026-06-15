"use client";

import { useTranslations } from "next-intl";

export default function About() {
  const t = useTranslations("about");

  return (
    <section className="px-4 py-10 space-y-3 border-t border-custom-gray bg-[#303030]">
      <h2 className="text-base font-bold text-white tracking-tight">
        {t("title")}
      </h2>
      <p className="text-sm text-gray-200 leading-relaxed">{t("body")}</p>
    </section>
  );
}
