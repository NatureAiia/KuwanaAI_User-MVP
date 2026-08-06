"use client";

import { useId } from "react";

const GRADIENT_PALETTE: [string, string][] = [
  ["#1E3A8A", "#0F8A7A"],
  ["#0F8A7A", "#34D399"],
  ["#D14A3A", "#FBBF24"],
  ["#7C3AED", "#1E3A8A"],
  ["#334155", "#0F8A7A"],
  ["#FBBF24", "#D14A3A"],
];

function hashOf(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return hash;
}

/**
 * No listing here has real product photography (these are service/financial
 * offerings, not physical goods) — this generates a deterministic gradient +
 * geometric mark from the listing id so every card still has a distinct,
 * recognizable visual anchor for a dense grid, without depending on any
 * uploaded or externally sourced image.
 */
export function ListingCoverArt({ seed, className }: { seed: string; className?: string }) {
  const gradientId = useId();
  const hash = hashOf(seed);
  const [from, to] = GRADIENT_PALETTE[hash % GRADIENT_PALETTE.length];
  const angle = hash % 360;
  const shapeVariant = Math.floor(hash / 360) % 3;

  return (
    <svg viewBox="0 0 160 160" className={className} role="presentation" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} gradientTransform={`rotate(${angle} 0.5 0.5)`}>
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
      </defs>
      <rect width="160" height="160" fill={`url(#${gradientId})`} />
      {shapeVariant === 0 && <circle cx={130} cy={30} r="55" fill="white" fillOpacity="0.12" />}
      {shapeVariant === 1 && (
        <rect x="20" y="90" width="150" height="150" fill="white" fillOpacity="0.12" transform="rotate(20 20 90)" />
      )}
      {shapeVariant === 2 && <circle cx={30} cy={130} r="70" fill="black" fillOpacity="0.1" />}
    </svg>
  );
}
