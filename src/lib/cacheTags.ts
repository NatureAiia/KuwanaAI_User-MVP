import { revalidateTag } from "next/cache";

/**
 * Cache tags for the catalog read layer.
 *
 * The catalog (sectors, categories, attribute schemas, providers, listings)
 * is the hottest read path in the app and one of the coldest write paths —
 * it changes only when an admin edits content or a provider submission is
 * published. That asymmetry is what makes it worth caching at all; a user's
 * own data (saved, XP, notifications) is deliberately never cached here.
 *
 * Tags are coarse on purpose. A per-listing tag would mean an admin price
 * edit leaves the sector's list page showing the old price until its own
 * TTL expires, which is exactly the kind of stale-price bug this product
 * cannot afford. Invalidating the whole catalog on write costs one cold
 * query and keeps every surface consistent.
 */
export const CATALOG_TAG = "catalog";

/** Price history is written by the freshness/FX jobs, separately from listing edits. */
export const PRICE_HISTORY_TAG = "price-history";

/**
 * Call after any write that changes what a consumer would see in the
 * catalog: listing create/update/delete, provider create/update, and a
 * provider submission moving to (or out of) `published`.
 */
export function revalidateCatalog() {
  // Next 16 requires an explicit expiry profile. `{ expire: 0 }` means purge
  // now rather than schedule the entry to lapse later — an admin who edits a
  // price expects the next page load to show it, not the one after the TTL.
  revalidateTag(CATALOG_TAG, { expire: 0 });
  revalidateTag(PRICE_HISTORY_TAG, { expire: 0 });
}
