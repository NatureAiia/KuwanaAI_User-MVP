import type { PriceTrend } from "@/lib/priceTrend";
import type { ListingDTO } from "@/types/catalog";

/** Shared Badge tone / arrow glyph per trend direction, used anywhere a PriceTrend is rendered. */
export const TREND_TONE: Record<PriceTrend["direction"], "teal" | "coral" | "neutral"> = {
  down: "teal",
  up: "coral",
  flat: "neutral",
};

export const TREND_ARROW: Record<PriceTrend["direction"], string> = {
  down: "↓",
  up: "↑",
  flat: "→",
};

/** Shared Badge tone per listing freshness status, used anywhere a ListingDTO is rendered. */
export const FRESHNESS_TONE: Record<ListingDTO["freshnessStatus"], "teal" | "sky" | "coral"> = {
  fresh: "teal",
  stale: "sky",
  unverified: "coral",
};

/**
 * Public-facing label for who/what last touched a listing's data
 * (Listing.lastUpdateSource) — deliberately excludes "corporate", which is
 * rendered as the provider's own name at the call site instead of a generic
 * label, and deliberately never includes an admin's email even internally
 * (see ListingUpdateLog.actorLabel for that) — this is what shoppers see.
 */
export const PROVENANCE_LABEL: Record<"admin" | "scraper" | "seed", string> = {
  admin: "Kuwana Team",
  scraper: "Automated web scan",
  seed: "Kuwana Team",
};

/**
 * The link to show for "visit the provider / see where this data came
 * from" — prefers the listing's own sourceUrl (the specific page the data
 * was sourced from) and falls back to the provider's general website when
 * the listing has none of its own. Used everywhere a listing or
 * recommendation is rendered so the fallback logic lives in one place.
 */
export function resolveProviderLink(listing: {
  sourceUrl: string | null;
  provider: { websiteUrl: string | null };
}): string | null {
  return listing.sourceUrl ?? listing.provider.websiteUrl ?? null;
}

/** Shared disclaimer shown anywhere prices/listings/recommendations render — Kuwana surfaces provider data, it doesn't sell or resell it. */
export const NOT_A_RESELLER_NOTICE =
  "Kuwana is not a reseller — prices and details are provided by each company and may change without notice.";
