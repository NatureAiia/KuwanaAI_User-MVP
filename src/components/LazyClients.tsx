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

/**
 * The provider submission wizard: ~590 lines across the form and its four
 * step components, loaded only on /provider/listings/new and .../edit.
 *
 * Repointed from the old `NewProviderListingForm`, which was renamed and
 * restructured into ProviderListingForm + steps/. Git reported no conflict
 * for that rename because the import lived in this file — it would only have
 * surfaced as a build failure.
 */
export const ProviderListingFormLazy = dynamic(
  () => import("@/components/provider/ProviderListingForm").then((m) => m.ProviderListingForm),
  { loading: () => <Skeleton height={420} /> },
);

/** Corporate's edit/new-product request wizard — reuses the provider portal's step components. */
export const CorporateProductRequestFormLazy = dynamic(
  () => import("@/components/corporate/CorporateProductRequestForm").then((m) => m.CorporateProductRequestForm),
  { loading: () => <Skeleton height={420} /> },
);

/** Corporate's "propose a new comparable field" request — see CorporateFieldRequestForm. */
export const CorporateFieldRequestFormLazy = dynamic(
  () => import("@/components/corporate/CorporateFieldRequestForm").then((m) => m.CorporateFieldRequestForm),
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

export const ScrapeSourceFormLazy = dynamic(
  () => import("@/components/admin/ScrapeSourceForm").then((m) => m.ScrapeSourceForm),
  { loading: () => <Skeleton height={260} /> },
);

export const ScrapeSearchBoxLazy = dynamic(
  () => import("@/components/admin/ScrapeSearchBox").then((m) => m.ScrapeSearchBox),
  { loading: () => <Skeleton height={220} /> },
);
