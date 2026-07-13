"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

function FieldIcon() {
  return (
    <svg width="22" height="14" viewBox="0 0 80 50" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="1" y="1" width="78" height="48" rx="1" />
      <circle cx="40" cy="25" r="9" />
      <line x1="40" y1="15" x2="40" y2="2" strokeLinecap="round" />
      <line x1="40" y1="48" x2="40" y2="35" strokeLinecap="round" />
      <rect x="67" y="13" width="12" height="25" rx="1" />
      <rect x="1" y="13" width="12" height="25" rx="1" />
    </svg>
  );
}

function LeaguesIcon() {
  return (
    <svg width="18" height="14" viewBox="0 0 18 14" fill="currentColor">
      <rect x="0" y="0" width="18" height="3" rx="1" />
      <rect x="0" y="5" width="18" height="3" rx="1" />
      <rect x="0" y="10" width="18" height="3" rx="1" />
    </svg>
  );
}

function BracketIcon() {
  return (
    <svg width="20" height="16" viewBox="0 0 20 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" y1="3" x2="8" y2="3" />
      <line x1="1" y1="13" x2="8" y2="13" />
      <line x1="8" y1="3" x2="8" y2="8" />
      <line x1="8" y1="13" x2="8" y2="8" />
      <line x1="8" y1="8" x2="19" y2="8" />
    </svg>
  );
}

const TABS = [
  { href: "/",        Icon: FieldIcon,   ns: "matchTabs", labelKey: "matches"       },
  { href: "/leagues", Icon: LeaguesIcon, ns: "quickNav",  labelKey: "leagues"       },
  { href: "/bracket", Icon: BracketIcon, ns: "matchTabs", labelKey: "knockoutStage" },
] as const;

export default function BracketBottomSheet() {
  const tTabs = useTranslations("matchTabs");
  const tQuickNav = useTranslations("quickNav");
  const pathname = usePathname();

  const getLabel = (tab: (typeof TABS)[number]) => {
    if (tab.ns === "quickNav") return tQuickNav(tab.labelKey as "leagues");
    return tTabs(tab.labelKey as "matches" | "knockoutStage");
  };

  return (
    <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-custom-gray-2 shadow-lg border-t border-white/8">
      <div className="flex items-stretch">
        {TABS.map(({ href, Icon, ...rest }, i) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex-1 flex flex-col items-center justify-center gap-1.5 px-2 py-3 transition-colors
                ${i < TABS.length - 1 ? "border-r border-custom-gray" : ""}
                ${isActive ? "text-accent bg-custom-gray/30" : "text-white/70 hover:text-white"}`}
            >
              <Icon />
              <span className="text-[10px] font-light tracking-wide leading-none">
                {getLabel({ href, Icon, ...rest } as (typeof TABS)[number])}
              </span>
              {isActive && (
                <span className="absolute bottom-0 inset-x-0 h-0.5 bg-accent" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
