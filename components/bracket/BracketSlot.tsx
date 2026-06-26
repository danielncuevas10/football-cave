"use client";

import { AnimatePresence, motion } from "framer-motion";
import MatchCard from "@/components/MatchCard";
import TBDCard from "./TBDCard";
import ProjectedCard from "./ProjectedCard";
import type { ResolvedSlot } from "@/types/bracket";

interface BracketSlotProps {
  slot: ResolvedSlot;
}

const springTransition = {
  type: "spring",
  stiffness: 260,
  damping: 22,
} as const;

export default function BracketSlot({ slot }: BracketSlotProps) {
  const { match, homeLabel, awayLabel, homeLogo, awayLogo, fixtureDate, thirdsResolution } = slot;
  const isProjected = !match && thirdsResolution?.slotStatus === "projected";

  return (
    <div className="will-change-transform">
      <AnimatePresence mode="wait">
        {match ? (
          <motion.div
            key={match.id}
            initial={{ scale: 0.93, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.93, opacity: 0 }}
            transition={springTransition}
            className="will-change-transform"
          >
            <MatchCard match={match} />
          </motion.div>
        ) : isProjected ? (
          <motion.div
            key={`proj-${awayLabel}`}
            initial={{ opacity: 0.6 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0.6 }}
            transition={{ duration: 0.2 }}
          >
            <ProjectedCard
              homeLabel={homeLabel}
              awayLabel={awayLabel}
              homeLogo={homeLogo}
              awayLogo={awayLogo}
              fixtureDate={fixtureDate}
            />
          </motion.div>
        ) : (
          <motion.div
            key="tbd"
            initial={{ opacity: 0.6 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0.6 }}
            transition={{ duration: 0.2 }}
          >
            <TBDCard
              homeLabel={homeLabel}
              awayLabel={awayLabel}
              homeLogo={homeLogo}
              awayLogo={awayLogo}
              fixtureDate={fixtureDate}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
