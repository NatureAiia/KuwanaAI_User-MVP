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
      // Deliberately a plain <img>, not next/image. Provider.logoUrl is an
      // arbitrary operator-supplied URL, so next/image would require
      // `remotePatterns` open to any host — which turns /_next/image into an
      // unauthenticated fetch-and-resize proxy anyone can point at any URL.
      // The optimizer wins here (a 32px avatar) are not worth that.
      //
      // The lazy/async/decoding attributes below get most of the benefit:
      // logos below the fold aren't fetched until they approach the
      // viewport, and decoding never blocks the main thread. Explicit
      // width/height (and the matching style) reserve the box so a late logo
      // cannot shift the row it sits in.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={`${name} logo`}
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
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
