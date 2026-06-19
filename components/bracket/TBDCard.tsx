// Placeholder card shown in bracket slots that have no match scheduled yet.
// Mirrors MatchCard's 4-column grid so height/width remain stable when a real
// match card animates in to replace it.

interface TBDCardProps {
  homeLabel: string;
  awayLabel: string;
  homeLogo: string | null;
  awayLogo: string | null;
}

function Flag({ src }: { src: string }) {
  return (
    <div className="w-12 h-8 overflow-hidden shrink-0 relative border border-gray-300 rounded-tr rounded-bl">
      <img
        src={src}
        alt=""
        className="w-full h-full object-cover scale-[1.15] will-change-transform"
      />
    </div>
  );
}

function FlagPlaceholder() {
  return (
    <div className="w-12 h-8 shrink-0 border border-gray-300/30 rounded-tr rounded-bl bg-custom-gray" />
  );
}

export default function TBDCard({
  homeLabel,
  awayLabel,
  homeLogo,
  awayLogo,
}: TBDCardProps) {
  return (
    <div className="bg-custom-gray-2 py-4 px-3 grid grid-cols-[1rem_1fr_auto_1fr] gap-2 items-center border border-custom-gray-2/20 opacity-90 select-none rounded-md">
      {/* badge column — empty like MatchCard's live-minute slot */}
      <div />

      {/* home */}
      <div className="flex flex-col items-center justify-end gap-2 min-w-0">
        {homeLogo ? <Flag src={homeLogo} /> : <FlagPlaceholder />}
        <span className="text-sm font-medium text-right text-gray-200 truncate">
          {homeLabel}
        </span>
      </div>

      {/* center — "vs" separator */}
      <div className="flex flex-col items-center justify-center gap-0.5 px-2 min-w-14">
        <span className="text-gray-200 text-sm font-light">vs</span>
      </div>

      {/* away */}
      <div className="flex flex-col items-center justify-start gap-2 min-w-0">
        {awayLogo ? <Flag src={awayLogo} /> : <FlagPlaceholder />}
        <span className="text-sm font-medium text-left text-gray-200 truncate">
          {awayLabel}
        </span>
      </div>
    </div>
  );
}
