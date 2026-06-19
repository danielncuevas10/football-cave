import type { ResolvedSlot } from "@/types/bracket";
import BracketSlot from "./BracketSlot";

interface BracketRoundProps {
  label: string;
  slots: ResolvedSlot[];
}

export default function BracketRound({ label, slots }: BracketRoundProps) {
  // Group into pairs so we can draw bracket connector lines
  const pairs: [ResolvedSlot, ResolvedSlot | null][] = [];
  for (let i = 0; i < slots.length; i += 2) {
    pairs.push([slots[i], slots[i + 1] ?? null]);
  }

  return (
    <div className="flex flex-col min-w-[280px]">
      {label && (
        <h3 className="text-[10px] font-light tracking-widest text-gray-200 px-1 mb-3">
          {label}
        </h3>
      )}

      <div className="flex flex-col gap-4">
        {pairs.map(([top, bottom]) => (
          <div key={top.def.id} className="relative flex flex-col gap-2">
            <BracketSlot slot={top} />
            {bottom && <BracketSlot slot={bottom} />}

            {/* Bracket connector lines — only drawn when two slots form a pair */}
            {bottom && (
              <>
                {/* Vertical bar: spans from ~center of top card to ~center of bottom card */}
                <div
                  className="absolute w-px bg-gray-700/60"
                  style={{ right: "-1px", top: "28%", bottom: "20%" }}
                />
                {/* Horizontal stub: extends right from the midpoint of the pair */}
                <div
                  className="absolute h-px bg-gray-700/60"
                  style={{
                    left: "100%",
                    top: "50%",
                    width: "12px",
                    transform: "translateY(-50%)",
                  }}
                />
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
