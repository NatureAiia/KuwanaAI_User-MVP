import type { PricePoint } from "@/lib/priceTrend";

/** Minimal inline-SVG line chart of a listing's price history. No chart library needed for 7-8 points. */
export function PriceSparkline({
  points,
  direction,
  width = 240,
  height = 56,
}: {
  points: PricePoint[];
  direction: "down" | "up" | "flat";
  width?: number;
  height?: number;
}) {
  if (points.length < 2) return null;

  const padding = 4;
  const prices = points.map((p) => p.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  const coords = points.map((p, i) => {
    const x = padding + (i / (points.length - 1)) * (width - padding * 2);
    const y = height - padding - ((p.price - min) / range) * (height - padding * 2);
    return { x, y };
  });

  const stroke =
    direction === "down" ? "var(--accent-teal)" : direction === "up" ? "var(--accent-coral)" : "var(--text-muted)";
  const last = coords[coords.length - 1];

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <polyline
        points={coords.map((c) => `${c.x},${c.y}`).join(" ")}
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last.x} cy={last.y} r={3} fill={stroke} />
    </svg>
  );
}
