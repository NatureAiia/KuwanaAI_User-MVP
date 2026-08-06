"use client";

import { useState } from "react";
import { clsx } from "clsx";

const BADGE_PALETTE = [
  "#1E3A8A",
  "#0F8A7A",
  "#D14A3A",
  "#FBBF24",
  "#334155",
  "#7C3AED",
];

function paletteIndexFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return hash % BADGE_PALETTE.length;
}

function initialsFor(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function ProviderLogo({
  name,
  logoUrl,
  size = 32,
}: {
  name: string;
  logoUrl?: string | null;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);

  if (logoUrl && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- arbitrary admin-curated HTTPS URLs, not confined to one CDN next/image could optimize
      <img
        src={logoUrl}
        alt={`${name} logo`}
        width={size}
        height={size}
        onError={() => setFailed(true)}
        // This renders dozens of times per page (every listing card, compare
        // row, tray chip) — most are off-screen on load, so lazy-loading and
        // deprioritizing them matters far more here than for a one-off image.
        loading="lazy"
        decoding="async"
        fetchPriority="low"
        className="shrink-0 rounded-full border border-border bg-bg-surface-raised object-contain"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className={clsx("flex shrink-0 items-center justify-center rounded-full font-display font-bold text-white")}
      style={{ width: size, height: size, backgroundColor: BADGE_PALETTE[paletteIndexFor(name)], fontSize: size * 0.4 }}
    >
      {initialsFor(name)}
    </div>
  );
}
