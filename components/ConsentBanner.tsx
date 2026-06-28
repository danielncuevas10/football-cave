"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";

declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
    dataLayer: unknown[];
  }
}

const CONSENT_KEY = "fc_cookie_consent";

function updateGAConsent(granted: boolean) {
  const value = granted ? "granted" : "denied";
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("consent", "update", {
      analytics_storage: value,
      ad_storage: value,
      ad_user_data: value,
      ad_personalization: value,
    });
  }
}

export default function ConsentBanner() {
  const [visible, setVisible] = useState(false);
  const t = useTranslations("consent");

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (!stored) {
      setVisible(true);
    } else {
      updateGAConsent(stored === "granted");
    }
  }, []);

  function accept() {
    localStorage.setItem(CONSENT_KEY, "granted");
    updateGAConsent(true);
    setVisible(false);
  }

  function reject() {
    localStorage.setItem(CONSENT_KEY, "denied");
    updateGAConsent(false);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-20 lg:bottom-6 left-4 z-50 w-72 rounded-2xl border border-[#242424] bg-[#0f0f0f]/90 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.7)] p-4">
      <p className="text-xs text-gray-400 leading-relaxed mb-4">
        {t("message")}{" "}
        <Link
          href="/privacy"
          className="text-gray-300 underline underline-offset-2 hover:text-white transition-colors"
        >
          {t("privacyPolicy")}
        </Link>
        .
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={reject}
          className="flex-1 py-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
        >
          {t("reject")}
        </button>
        <button
          onClick={accept}
          className="flex-1 py-1.5 text-xs rounded-lg border border-white/50 bg-white/50 text-white/90 hover:bg-white hover:text-black transition-colors cursor-pointer"
        >
          {t("accept")}
        </button>
      </div>
    </div>
  );
}
