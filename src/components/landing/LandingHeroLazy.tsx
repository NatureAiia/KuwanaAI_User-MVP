"use client";

import dynamic from "next/dynamic";

/**
 * Client boundary whose only job is to hold the `next/dynamic` calls for the
 * landing hero's two heaviest pieces. `ssr: false` is only legal inside a
 * client component, and `src/app/page.tsx` is a server component.
 *
 * Both are pure decoration on the first screen a visitor ever sees:
 *
 * - `LandingFX` is ~220 lines driving four canvases, a rAF loop, and mouse
 *   tracking. Server-rendering it produces empty `<canvas>` elements, so
 *   SSR buys nothing and its JS blocks the hero's interactivity.
 * - `HeroDeviceMockup` is a mouse-parallax device frame — meaningless
 *   without JS, and never above the headline in reading order.
 *
 * Splitting them out means the hero copy and the two CTAs are painted and
 * clickable from the server HTML, and the effects arrive after.
 */
export const LandingFXLazy = dynamic(
  () => import("./LandingFX").then((m) => m.LandingFX),
  { ssr: false },
);

export const HeroDeviceMockupLazy = dynamic(
  () => import("./HeroDeviceMockup").then((m) => m.HeroDeviceMockup),
  {
    ssr: false,
    // Reserves the mockup's box so the hero doesn't reflow when it lands —
    // a layout shift on the primary CTA is worse than a slightly late image.
    loading: () => <div className="aspect-[4/3] w-full rounded-[var(--radius-card)] border border-border bg-bg-surface" />,
  },
);
