// A minimal proportional bar (teal = trending down / buyer-favorable,
// coral = trending up) — same "no chart library needed" approach as
// PriceSparkline.tsx, just bars instead of a polyline. Renders nothing
// when there's no movement to show, rather than an empty grey track.
export function SectorTrendBar({ down, up }: { down: number; up: number }) {
  const total = down + up;
  if (total === 0) return null;

  const downPct = (down / total) * 100;

  return (
    <div className="mt-2.5 flex h-1.5 w-full overflow-hidden rounded-full bg-bg-surface-raised">
      {down > 0 && <div className="h-full bg-accent-teal" style={{ width: `${downPct}%` }} />}
      {up > 0 && <div className="h-full bg-accent-coral" style={{ width: `${100 - downPct}%` }} />}
    </div>
  );
}
