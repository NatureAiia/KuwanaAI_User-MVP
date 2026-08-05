"use client";

import dynamic from "next/dynamic";

/**
 * Code-split entry points for the app's largest client components.
 *
 * Each of these is the whole interactive body of exactly one route, so
 * bundling it eagerly means every *other* route's visitor downloads it too
 * via the shared chunk. Splitting keeps the initial JS proportional to the
 * page actually being viewed.
 *
 * These keep `ssr: true` (the default) — unlike the landing hero's purely
 * decorative effects, this is the page's real content, and skipping SSR
 * would trade a JS win for a blank first paint and a worse crawl.
 *
 * Each `loading` skeleton reserves roughly the height of the real component
 * so the split does not introduce a layout shift.
 */

function Skeleton({ height }: { height: number }) {
  return (
    <div
      aria-hidden="true"
      className="mt-4 w-full animate-pulse rounded-[var(--radius-card)] border border-border bg-bg-surface"
      style={{ height }}
    />
  );
}

/** ~310 lines: the side-by-side spec table, scoring UI, and AI recommendation panel. */
export const CompareClientLazy = dynamic(
  () => import("@/components/explore/CompareClient").then((m) => m.CompareClient),
  { loading: () => <Skeleton height={520} /> },
);

/** ~180 lines plus the composer, message list, and streaming reader. */
export const ChatClientLazy = dynamic(
  () => import("@/components/chat/ChatClient").then((m) => m.ChatClient),
  { loading: () => <Skeleton height={480} /> },
);

/** ~370 lines: the one-question-per-screen provider submission wizard. */
export const NewProviderListingFormLazy = dynamic(
  () => import("@/components/provider/NewProviderListingForm").then((m) => m.NewProviderListingForm),
  { loading: () => <Skeleton height={420} /> },
);

/** Admin-only forms — never worth shipping to a consumer's bundle. */
export const NewListingFormLazy = dynamic(
  () => import("@/components/admin/NewListingForm").then((m) => m.NewListingForm),
  { loading: () => <Skeleton height={360} /> },
);

export const NewProviderFormLazy = dynamic(
  () => import("@/components/admin/NewProviderForm").then((m) => m.NewProviderForm),
  { loading: () => <Skeleton height={220} /> },
);
