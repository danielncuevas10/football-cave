import Link from "next/link";
import { useTranslations } from "next-intl";

export default function Footer() {
  const t = useTranslations("footer");
  return (
    <footer className="bg-[#101010] border-t border-[#303030] px-6 py-6 mb-20 lg:mb-0">
      <div className="max-w-7xl lg:max-w-360 mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-gray-200">
        <p>© {new Date().getFullYear()} FootballCave. All rights reserved.</p>
        <nav className="flex items-center gap-4">
          <Link
            href="/privacy"
            className="hover:text-gray-300 transition-colors"
          >
            {t("privacyPolicy")}
          </Link>
          <Link href="/terms" className="hover:text-gray-300 transition-colors">
            {t("termsOfService")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
