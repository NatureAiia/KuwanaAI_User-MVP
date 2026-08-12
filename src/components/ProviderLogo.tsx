"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { providerLogoUrl } from "@/lib/providerLogos";

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

/**
 * Carrier/provider mark used everywhere a logo is shown: listing cards,
 * compare rows, tray chips, signup chips. Lookup order:
 *   1. Explicit `logoUrl` prop (DB-supplied URL).
 *   2. `public/provider-logos/<slug>.<ext>` resolved from the provider name
 *      (see src/lib/providerLogos.ts).
 *   3. Colored-initials fallback — never renders a broken <img>.
 *
 * Sizing is constrained by the caller via the `size` prop, not by the
 * component, so the card / chip / row can each enforce its own max
 * dimensions. The default `size` here is 32px (≈ h-8) for the common
 * card/row case; the listing card passes size=22 and a max-h/max-w via
 * the wrapping class to match the 20px / 60px layout brief.
 */
export function ProviderLogo({
  name,
  logoUrl,
  size = 32,
  className,
}: {
  name: string;
  logoUrl?: string | null;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  // Prefer the DB logoUrl (an admin-controlled URL), then fall back to
  // the locally-fetched logo at /provider-logos/<slug>.<ext>. Once the
  // chosen source errors, stop trying to render an <img> entirely and
  // drop to the initials badge — a broken <img> must never persist.
  const resolvedUrl = failed ? null : (logoUrl ?? providerLogoUrl(name));

  if (resolvedUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- arbitrary admin-curated HTTPS URLs + locally-served assets under /provider-logos/; next/image's fixed-size ceremony doesn't pay off for these small marks
      <img
        src={resolvedUrl}
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
        className={clsx(
          "shrink-0 rounded-full border border-border bg-bg-surface-raised object-contain",
          className,
        )}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className={clsx(
        "flex shrink-0 items-center justify-center rounded-full font-display font-bold text-white",
        className,
      )}
      style={{ width: size, height: size, backgroundColor: BADGE_PALETTE[paletteIndexFor(name)], fontSize: size * 0.4 }}
    >
      {initialsFor(name)}
    </div>
  );
}
