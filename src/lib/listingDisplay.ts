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
