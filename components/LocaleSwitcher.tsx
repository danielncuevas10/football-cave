"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";

const locales = [
  { code: "en", label: "EN" },
  { code: "es", label: "ES" },
  { code: "fr", label: "FR" },
  { code: "pt", label: "PT" },
  { code: "bs", label: "BS" },
  { code: "ch", label: "中文" },
  { code: "gr", label: "GR" },
  { code: "jp", label: "日本語" },
  { code: "kr", label: "한국어" },
  { code: "tr", label: "TR" },
];

export default function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    document.cookie = `locale=${next}; path=/; max-age=31536000; SameSite=Lax`;
    router.refresh();
  }

  return (
    <select
      value={locale}
      onChange={handleChange}
      className="bg-transparent text-gray-400 text-xs focus:outline-none hover:text-white transition-colors cursor-pointer"
      aria-label="Select language"
    >
      {locales.map(({ code, label }) => (
        <option key={code} value={code} className="bg-[#313131] text-white">
          {label}
        </option>
      ))}
    </select>
  );
}
