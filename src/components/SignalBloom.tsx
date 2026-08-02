"use client";

type SignalBloomProps = {
  /** 0–100 */
  value: number;
  size?: number;
  color?: "gold" | "teal";
  segments?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
};

/**
 * The "Signal Bloom" — a segmented radial arc meter (Section 5.3).
 * Reused for value score (gold), XP progress (gold, larger), and AI
 * confidence (teal) so the same shape reinforces brand recognition
 * across telecom signal bars, gamification fill, and "gain" (Kuwana).
 */
export function SignalBloom({
  value,
  size = 72,
  color = "gold",
  segments = 12,
  strokeWidth = 6,
  label,
  sublabel,
}: SignalBloomProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = size / 2 - strokeWidth;
  const circumference = 2 * Math.PI * radius;
  const gap = circumference / segments / 3;
  const dash = circumference / segments - gap;
  const filledSegments = Math.round((clamped / 100) * segments);

  const accent = color === "teal" ? "var(--accent-teal)" : "var(--accent-gold)";

  return (
    <div
      role="img"
      aria-label={`${label ?? "Score"}: ${Math.round(clamped)}${sublabel ? ` (${sublabel})` : ""}`}
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        {Array.from({ length: segments }).map((_, i) => {
          const rotation = (360 / segments) * i;
          return (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={i < filledSegments ? accent : "var(--border)"}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeLinecap="round"
              transform={`rotate(${rotation} ${size / 2} ${size / 2})`}
              style={{ transition: "stroke 300ms ease-out" }}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono font-semibold text-text-primary" style={{ fontSize: size * 0.24 }}>
          {Math.round(clamped)}
        </span>
      </div>
    </div>
  );
}
