"use client";

import { useRouter } from "next/navigation";

export default function BackButton() {
  const router = useRouter();

  const handleBack = () => {
    window.dispatchEvent(new CustomEvent("nav-start"));

    const hasInternalHistory =
      typeof window !== "undefined" &&
      window.history.length > 1 &&
      document.referrer.startsWith(window.location.origin);

    if (hasInternalHistory) {
      router.back();
    } else {
      router.push("/");
    }
  };

  return (
    <button
      onClick={handleBack}
      className="inline-flex items-center gap-2 px-3 py-.5 text-xs font-semibold text-gray-200 hover:text-white transition-colors group"
      aria-label="Go back"
    >
      <img
        src="/images/specs/arrow.svg"
        alt=""
        className="w-3.5 h-3.5 object-contain -rotate-270 transition-transform group-hover:-translate-x-0.5"
        onError={(e) => {
          e.currentTarget.onerror = null;
          e.currentTarget.src = "/images/specs/arrow.jpg";
        }}
      />
      <span>Back</span>
    </button>
  );
}
