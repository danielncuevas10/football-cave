"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import type { DbMatch, DbStanding } from "@/types/sports";
import MobileBracketTree from "./MobileBracketTree";

interface BracketBottomSheetProps {
  wcMatches: DbMatch[];
  wcStandings: DbStanding[];
}

const sheetVariants = {
  hidden: { y: "100%" },
  visible: { y: 0 },
};

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const springTransition = {
  type: "spring",
  stiffness: 280,
  damping: 30,
} as const;

export default function BracketBottomSheet({
  wcMatches,
  wcStandings,
}: BracketBottomSheetProps) {
  const t = useTranslations("matchTabs");
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Sticky trigger bar — only visible on mobile (hidden lg+) */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-custom-gray rounded-t-md shadow-lg">
        <button
          onClick={() => setIsOpen(true)}
          className="w-full flex items-center justify-between px-5 py-8 group"
          aria-label="Open live bracket"
        >
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-light text-white tracking-wide">
              {t("knockoutStage")}
            </span>
          </div>

          {/* Bouncing Arrow */}
          <img
            src="/images/specs/arrow.svg"
            alt="view knowckout stage"
            className="w-4 h-4 object-contain animate-bounce"
            onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = "/images/specs/arrow.jpg"; }}
          />
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              variants={backdropVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
              transition={{ duration: 0.2 }}
              className="lg:hidden fixed inset-0 z-40 bg-black/60"
              onClick={() => setIsOpen(false)}
            />

            {/* Sheet */}
            <motion.div
              key="sheet"
              variants={sheetVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
              transition={springTransition}
              className="lg:hidden fixed inset-x-0 bottom-0 z-50 bg-[#101010] rounded-t-2xl will-change-transform"
              style={{ height: "85dvh" }}
            >
              {/* Handle bar */}
              <div className="flex justify-center pt-3 pb-1 bg-custom-gray rounded-t-md">
                <div className="w-10 h-1 rounded-full bg-gray-600" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 bg-custom-gray">
                <span className="text-sm font-light tracking-widest text-white">
                  {t("knockoutStage")}
                </span>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-200 hover:text-white transition-colors p-1"
                  aria-label="Close"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* Bracket content */}
              <div className="h-full overflow-auto px-3 pb-20 pt-4">
                <MobileBracketTree
                  matches={wcMatches}
                  standings={wcStandings}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
