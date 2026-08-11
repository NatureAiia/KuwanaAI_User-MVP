import { prisma } from "@/lib/prisma";
import { ListingStatus } from "@prisma/client";
import { computeDecisionScores } from "@/lib/scoring";
import { findClosestMatches } from "@/lib/similarListings";
import { computePriceTrend, type PriceTrend } from "@/lib/priceTrend";
import { loadFittedWeights, type FittedWeights } from "@/lib/fittedWeights";
import type { CategoryDTO, CategoryWithListingsDTO, ListingDTO } from "@/types/catalog";

function toListingDTO(listing: {
  id: string;
  name: string;
  description: string | null;
  price: unknown;
  currency: string;
  attributes: unknown;
  freshnessStatus: string;
  lastVerifiedAt: Date;
  sourceUrl: string | null;
  images: string[];
  rating: unknown;
  reviewCount: number;
  provider: { id: string; name: string; logoUrl: string | null; verified: boolean };
}): ListingDTO {
  return {
    id: listing.id,
    name: listing.name,
    description: listing.description,
    price: Number(listing.price),
    currency: listing.currency,
    attributes: listing.attributes as Record<string, unknown>,
    freshnessStatus: listing.freshnessStatus as ListingDTO["freshnessStatus"],
    lastVerifiedAt: listing.lastVerifiedAt.toISOString(),
    sourceUrl: listing.sourceUrl,
    images: listing.images,
    rating: listing.rating === null || listing.rating === undefined ? null : Number(listing.rating),
    reviewCount: listing.reviewCount,
    provider: listing.provider,
  };
}

export async function getSectorCategories(sectorSlug: string): Promise<CategoryDTO[]> {
  const sector = await prisma.sectorConfig.findUnique({
    where: { slug: sectorSlug },
    include: { categories: { include: { attributeSchema: { orderBy: { sortOrder: "asc" } } } } },
  });
  if (!sector) return [];
  return sector.categories.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    attributeSchema: c.attributeSchema.map((a) => ({
      key: a.key,
      label: a.label,
      dataType: a.dataType as CategoryDTO["attributeSchema"][number]["dataType"],
      unit: a.unit,
      isComparable: a.isComparable,
      sortOrder: a.sortOrder,
    })),
  }));
}

export async function getCategoryWithListings(
  sectorSlug: string,
  categorySlug: string,
): Promise<CategoryWithListingsDTO | null> {
  const sector = await prisma.sectorConfig.findUnique({ where: { slug: sectorSlug } });
  if (!sector) return null;

  const category = await prisma.category.findUnique({
    where: { sectorId_slug: { sectorId: sector.id, slug: categorySlug } },
    include: {
      attributeSchema: { orderBy: { sortOrder: "asc" } },
      listings: {
        where: { status: "published" },
        include: { provider: true },
        orderBy: { price: "asc" },
      },
    },
  });
  if (!category) return null;

  return {
    id: category.id,
    slug: category.slug,
    name: category.name,
    attributeSchema: category.attributeSchema.map((a) => ({
      key: a.key,
      label: a.label,
      dataType: a.dataType as CategoryDTO["attributeSchema"][number]["dataType"],
      unit: a.unit,
      isComparable: a.isComparable,
      sortOrder: a.sortOrder,
    })),
    listings: category.listings.map(toListingDTO),
  };
}

export async function getTopListings(
  sectorSlug: string,
  categorySlug: string,
  limit = 4,
  priceWeight = 0.5,
): Promise<{ categoryName: string; listings: (ListingDTO & { score: number; trend: PriceTrend | null })[] }> {
  const result = await getCategoryWithListings(sectorSlug, categorySlug);
  if (!result) return { categoryName: "", listings: [] };

  const trends = await getListingPriceTrends(result.listings.map((l) => l.id));
  const scores = computeDecisionScores(result.listings, result.attributeSchema, trends, priceWeight);
  const sorted = [...result.listings]
    .map((l) => ({ ...l, score: scores[l.id]?.total ?? 0, trend: trends[l.id] ?? null }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return { categoryName: result.name, listings: sorted };
}

/**
 * Reads a user's SectorFootprint for the given sector and derives a price
 * weight for computeDecisionScores — a footprint indicating low spend biases
 * the score toward price-sensitivity rather than the default 50/50 split.
 * Falls back to 0.5 when there's no footprint or no recognizable spend field.
 *
 * Spend fields are free-text ranges from onboarding (e.g. "Under $10",
 * "$10–$25", "$25–$50", "$50+" — see SPEND_RANGES in onboarding-options.ts),
 * not pre-bucketed labels, so this reads the highest number in the string
 * rather than matching against "low"/"medium"/"high" keywords.
 */
export async function getFootprintPriceWeight(userId: string, sectorSlug: string): Promise<number> {
  const footprint = await prisma.sectorFootprint.findUnique({
    where: { userId_sector: { userId, sector: sectorSlug as never } },
  });
  if (!footprint) return 0.5;

  const data = footprint.data as Record<string, unknown>;
  const spendField = Object.entries(data).find(([key]) => key.toLowerCase().includes("spend"));
  const spendValue = typeof spendField?.[1] === "string" ? spendField[1] : "";
  const numbers = spendValue.match(/\d+/g)?.map(Number) ?? [];
  if (numbers.length === 0) return 0.5;

  const maxSpend = Math.max(...numbers);
  if (maxSpend <= 10) return 0.7;
  if (maxSpend <= 25) return 0.6;
  if (maxSpend <= 50) return 0.5;
  return 0.3;
}

/**
 * "Specials for you" (KUWANA_DECISION_INTELLIGENCE_PLAN.md Section 4): joins
 * the user's footprint and comparison/saved-listing engagement against
 * current listings, sorted by a footprint-biased, trend-aware Decision Score
 * — instead of the same generic "best value this week" shown to everyone.
 *
 * Candidate categories come from two sources, in priority order: categories
 * the user has actually compared/saved (explicit signal), then — to avoid an
 * empty feed for a user who onboarded but hasn't compared anything yet — the
 * first category of each sector in their onboarding footprint (implicit
 * signal). Categories with no listings yet (e.g. a coming-soon sector) are
 * dropped by the final filter.
 */
export async function getPersonalizedSpecials(
  userId: string,
  limit = 4,
): Promise<
  {
    sectorSlug: string;
    categorySlug: string;
    categoryName: string;
    listings: (ListingDTO & { score: number; trend: PriceTrend | null })[];
  }[]
> {
  const [comparisons, saved, footprints] = await Promise.all([
    prisma.comparison.findMany({
      where: { userId },
      include: { category: { include: { sector: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.savedListing.findMany({
      where: { userId },
      include: { listing: { include: { category: { include: { sector: true } } } } },
      take: 10,
    }),
    prisma.sectorFootprint.findMany({ where: { userId } }),
  ]);

  const candidates = new Map<string, { sectorSlug: string; categorySlug: string }>();
  for (const c of comparisons) {
    candidates.set(c.category.id, { sectorSlug: c.category.sector.slug, categorySlug: c.category.slug });
  }
  for (const s of saved) {
    candidates.set(s.listing.category.id, {
      sectorSlug: s.listing.category.sector.slug,
      categorySlug: s.listing.category.slug,
    });
  }

  const engagedSectors = new Set([...candidates.values()].map((c) => c.sectorSlug));
  for (const footprint of footprints) {
    if (engagedSectors.has(footprint.sector)) continue;
    const [firstCategory] = await getSectorCategories(footprint.sector);
    if (firstCategory) candidates.set(firstCategory.id, { sectorSlug: footprint.sector, categorySlug: firstCategory.slug });
  }

  if (candidates.size === 0) return [];

  const results = await Promise.all(
    [...candidates.values()].slice(0, 3).map(async ({ sectorSlug, categorySlug }) => {
      const priceWeight = await getFootprintPriceWeight(userId, sectorSlug);
      const { categoryName, listings } = await getTopListings(sectorSlug, categorySlug, limit, priceWeight);
      return { sectorSlug, categorySlug, categoryName, listings };
    }),
  );

  return results.filter((r) => r.listings.length > 0);
}

/**
 * "Recommended for you" — sits above "Specials for you" on the home page.
 * Recommends according to the user's profile across ALL categories, not just
 * the ones their providers happen to have seeded:
 *   1. Listings from the providers the user is already locked into (their
 *      mobile network, their bank, their insurer) — across every category.
 *   2. Top candidates from every category of each sector in their onboarding
 *      footprint (so a banking user sees savings-account picks, an insured
 *      user sees motor/health cover picks, etc.).
 * Categories the user has already explicitly compared/saved are excluded so
 * this section surfaces fresh ground rather than re-ranking what they've seen.
 *
 * Ranking (mirrors the notebook, kept in sync by hand until the model is
 * fitted): each candidate listing gets a value score (price + first numeric
 * benefit, 50/50 — same as computeDecisionScores), plus bonuses for being
 * a "special" (price drop / below-median), freshness, and provider trust,
 * clamped to 0-100.
 *
 * If `notebooks/data/fitted_weights.json` exists with an in-sample fit for
 * this category (see `loadFittedWeights`), the score is computed via the
 * fitted logistic-regression formula instead of the hand-tuned blend. The
 * heuristic stays in charge until the notebook produces a fit — which is
 * the production behavior until enough `action_taken` / saved-listing
 * signals have accumulated for a category.
 */

function scoreWithFit(
  fit: FittedWeights,
  features: {
    value_score: number;
    special_bonus: number;
    freshness_bonus: number;
    trust_bonus: number;
    trend_feature: number;
  },
): number {
  return (
    fit._intercept +
    fit.value_score * features.value_score +
    fit.special_bonus * features.special_bonus +
    fit.freshness_bonus * features.freshness_bonus +
    fit.trust_bonus * features.trust_bonus +
    fit.trend_feature * features.trend_feature
  );
}

/** All category ids across every sector present in a user's footprint. */
async function getFootprintCategoryIds(footprints: { sector: string }[]): Promise<string[]> {
  const sectors = new Set(footprints.map((fp) => fp.sector));
  if (sectors.size === 0) return [];
  const configs = await prisma.sectorConfig.findMany({
    where: { slug: { in: [...sectors] } },
    include: { categories: { select: { id: true } } },
  });
  return configs.flatMap((s) => s.categories.map((c) => c.id));
}

export async function getFavoriteProductSpecials(
  userId: string,
  limit = 4,
): Promise<
  {
    sectorSlug: string;
    categorySlug: string;
    categoryName: string;
    listings: (ListingDTO & { score: number; trend: PriceTrend | null; reason: string | null })[];
  }[]
> {
  const [footprints, saved] = await Promise.all([
    prisma.sectorFootprint.findMany({ where: { userId } }),
    prisma.savedListing.findMany({ where: { userId }, select: { listing: { select: { providerId: true } } } }),
  ]);

  // 1. Extract provider names from footprints.
  const providerNames = new Set<string>();
  const PROVIDER_KEY_PATTERNS = ["provider", "network", "bank", "insurer"];
  for (const fp of footprints) {
    const data = (fp.data ?? {}) as Record<string, unknown>;
    for (const [key, value] of Object.entries(data)) {
      if (!PROVIDER_KEY_PATTERNS.some((p) => key.toLowerCase().includes(p))) continue;
      if (typeof value === "string") {
        for (const token of value.split(/,| and | & /)) {
          const t = token.trim();
          if (t) providerNames.add(t);
        }
      } else if (Array.isArray(value)) {
        for (const v of value) {
          if (typeof v === "string" && v.trim()) providerNames.add(v.trim());
        }
      }
    }
  }
  // 2. Explicit > implicit — providers the user has saved listings from.
  for (const s of saved) providerNames.add(s.listing.providerId);

  // Broaden beyond the user's own providers: pull candidates from every
  // category of each sector in their onboarding footprint so the section
  // recommends across ALL categories, not only the ones where the user's
  // specific provider happens to have listings seeded.
  const footprintCategoryIds = await getFootprintCategoryIds(footprints);

  if (providerNames.size === 0 && footprintCategoryIds.length === 0) return [];

  // Resolve provider names -> provider records. Match on exact name OR on
  // providerId (saved listings give us the id directly).
  const providers = await prisma.provider.findMany({
    where: {
      OR: [
        { name: { in: [...providerNames] } },
        { id: { in: [...providerNames].filter((n) => /^[0-9a-f-]{36}$/i.test(n)) } },
      ],
    },
    select: { id: true, name: true },
  });

  const favoriteProviderIds = new Set(providers.map((p) => p.id));
  const favoriteProviderNames = new Set(providers.map((p) => p.name));

  // Listings from those providers AND from the footprint sectors' categories,
  // excluding categories the user has already explicitly engaged with — this
  // section surfaces fresh ground, not a re-rank of what they've compared.
  const engagedCategoryIds = new Set(
    (await prisma.comparison.findMany({ where: { userId }, select: { categoryId: true } })).map(
      (c) => c.categoryId,
    ),
  );

  const favoriteListings = await prisma.listing.findMany({
    where: {
      status: "published",
      OR: [
        ...(favoriteProviderIds.size > 0 ? [{ providerId: { in: [...favoriteProviderIds] } }] : []),
        ...(footprintCategoryIds.length > 0 ? [{ categoryId: { in: footprintCategoryIds } }] : []),
      ],
      ...(engagedCategoryIds.size > 0 ? { categoryId: { notIn: [...engagedCategoryIds] } } : {}),
    },
    include: { provider: true, category: { include: { sector: true, attributeSchema: { orderBy: { sortOrder: "asc" } } } } },
  });
  if (favoriteListings.length === 0) return [];

  const trends = await getListingPriceTrends(favoriteListings.map((l) => l.id));

  // Per-category weights from the offline notebook (Section 5 of
  // `notebooks/recommendation_engine.py`). Null when the notebook hasn't been
  // run yet — production behavior, no error. Cached on mtime so a fresh
  // notebook run is picked up on the next request without a server restart.
  // Below `_accuracy < FITTED_FIT_FLOOR`, the in-sample fit isn't even a
  // coin-flip better than random — fall through to the heuristic so the UI
  // doesn't ship a confidently-wrong rank order.
  const FITTED_FIT_FLOOR = 0.55;
  const fitted = loadFittedWeights();

  // Group by category so the home page shows one carousel per category, and
  // rank within each category with the favorite-product score below.
  const byCategory = new Map<
    string,
    { sectorSlug: string; sectorName: string; categorySlug: string; categoryName: string; listings: typeof favoriteListings }
  >();
  for (const listing of favoriteListings) {
    const key = listing.category.id;
    if (!byCategory.has(key)) {
      byCategory.set(key, {
        sectorSlug: listing.category.sector.slug,
        sectorName: listing.category.sector.name,
        categorySlug: listing.category.slug,
        categoryName: listing.category.name,
        listings: [],
      });
    }
    byCategory.get(key)!.listings.push(listing);
  }

  const results: {
    sectorSlug: string;
    categorySlug: string;
    categoryName: string;
    listings: (ListingDTO & { score: number; trend: PriceTrend | null; reason: string | null })[];
  }[] = [];

  for (const group of byCategory.values()) {
    const dtos = group.listings.map(toListingDTO);
    const attributeSchema = group.listings[0].category.attributeSchema.map((a) => ({
      key: a.key,
      label: a.label,
      dataType: a.dataType as CategoryDTO["attributeSchema"][number]["dataType"],
      unit: a.unit,
      isComparable: a.isComparable,
      sortOrder: a.sortOrder,
    }));
    const scores = computeDecisionScores(dtos, attributeSchema, trends);
    const median =
      dtos.map((d) => d.price).sort((a, b) => a - b)[Math.floor(dtos.length / 2)] ?? Number.POSITIVE_INFINITY;

    // Decide per category whether to use the logistic-regression fit or the
    // hand-tuned heuristic. The fit must exist AND its in-sample accuracy
    // must clear the floor; otherwise the heuristic stays in charge.
    const fittedForCategory = fitted?.weights[group.categorySlug];
    const useFitted = !!(fittedForCategory && fittedForCategory._accuracy >= FITTED_FIT_FLOOR);

    const ranked = dtos
      .map((listing) => {
        const trend = trends[listing.id] ?? null;
        const trendingDown = trend?.direction === "down" && Math.abs(trend.changePercent) >= 5;
        const belowMedian = listing.price <= median * 0.9;
        const isSpecial = trendingDown || belowMedian;
        const specialBonus = isSpecial ? 20 : 0;
        const trustBonus = listing.provider.verified ? 5 : 0;
        // Feature vector — same values the notebook fits against, so the
        // coefficients drop in without translation.
        const base = scores[listing.id]?.total ?? 0;
        const trendPct = trend?.changePercent ?? 0;
        const features = {
          value_score: base,
          special_bonus: specialBonus,
          freshness_bonus: scores[listing.id]?.freshnessAdjustment ?? 0,
          trust_bonus: trustBonus,
          trend_feature: trendPct,
        };
        const score = useFitted
          ? scoreWithFit(fittedForCategory!, features)
          : base + specialBonus + trustBonus;
        return {
          ...listing,
          score: Math.max(0, Math.min(100, score)),
          trend,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    // Tag each listing with a `reason` (trending down / below median) so
    // the UI can render a "why" badge. Done after ranking so the reason
    // doesn't leak into the score computation.
    const decorated = ranked.map((listing) => {
      const trend = listing.trend;
      const trendingDown = trend?.direction === "down" && Math.abs(trend.changePercent) >= 5;
      const medianCheck =
        listing.price <=
        (dtos.map((d) => d.price).sort((a, b) => a - b)[Math.floor(dtos.length / 2)] ?? Number.POSITIVE_INFINITY) * 0.9;
      const reason = trendingDown
        ? `Price dropped ${Math.abs(trend!.changePercent)}% recently`
        : medianCheck
          ? "Priced below category median"
          : null;
      return { ...listing, reason };
    });

    // Filter out categories where the user's only favorite in that category
    // is the same provider across all rows and there's no signal of a deal —
    // we want *specials*, not just "your provider's regular catalog".
    const hasSpecial = decorated.some((l) => !!l.reason);
    if (!hasSpecial && ranked.length > 0) {
      // Keep at most one non-special row from each provider as a fallback so
      // the section isn't blank for users with footprint data but no price
      // drops yet (the seed catalog never has price history).
      const seen = new Set<string>();
      const trimmed: typeof decorated = [];
      for (const l of decorated) {
        if (seen.has(l.provider.id)) continue;
        seen.add(l.provider.id);
        trimmed.push(l);
        if (trimmed.length >= 2) break;
      }
      if (trimmed.length > 0) results.push({ ...group, listings: trimmed });
    } else {
      results.push({ ...group, listings: decorated });
    }
  }

  // Sort the categories themselves by the top listing's score, so the
  // highest-value favorite-category carousel sits at the very top of the
  // home page section.
  results.sort((a, b) => (b.listings[0]?.score ?? 0) - (a.listings[0]?.score ?? 0));
  // Silence the unused-variable warning for favoriteProviderNames — kept
  // for future debug logging / "you use these providers" footer.
  void favoriteProviderNames;

  return results.slice(0, 3);
}

/**
 * Fetches ListingPriceHistory rows for the given listings and reduces each
 * to a PriceTrend (or null if there's no history yet). Keyed by listing id
 * so callers can look up a listing's trend alongside its other data.
 */
export async function getListingPriceTrends(listingIds: string[]): Promise<Record<string, PriceTrend | null>> {
  if (listingIds.length === 0) return {};

  const rows = await prisma.listingPriceHistory.findMany({
    where: { listingId: { in: listingIds } },
    orderBy: { recordedAt: "asc" },
  });

  const grouped = new Map<string, { price: number; recordedAt: Date }[]>();
  for (const row of rows) {
    const arr = grouped.get(row.listingId) ?? [];
    arr.push({ price: Number(row.price), recordedAt: row.recordedAt });
    grouped.set(row.listingId, arr);
  }

  const result: Record<string, PriceTrend | null> = {};
  for (const id of listingIds) {
    result[id] = computePriceTrend(grouped.get(id) ?? []);
  }
  return result;
}

/**
 * Snapshots a listing's price into ListingPriceHistory before it changes.
 * Every price-trend/sparkline/price-drop-notification feature reads from
 * this table — an edit that skips this call is invisible to all of them,
 * which was true of every live admin/provider price edit until this was
 * wired in (only prisma/seed.ts wrote here before). Call with the price
 * *before* the update lands, so the history reflects what was actually true
 * at that point in time.
 */
export async function recordPriceChange(listingId: string, previousPrice: number): Promise<void> {
  await prisma.listingPriceHistory.create({ data: { listingId, price: previousPrice } });
}

export async function getListingsByIds(ids: string[]): Promise<ListingDTO[]> {
  const listings = await prisma.listing.findMany({
    where: { id: { in: ids }, status: "published" },
    include: { provider: true },
  });
  return listings.map(toListingDTO);
}

export type RecentlyViewedListing = { listing: ListingDTO; viewedAt: string; pinned: boolean };

/**
 * The most recent distinct listings a user engaged with, sourced from
 * `action_taken` events (ListingActions fires one with `metadata.listingId`
 * on every CTA click). Not a full page-view log — there's no separate
 * "viewed" event today — but every action_taken implies the listing was
 * actually seen, so this under-counts rather than over-claims. Listings that
 * are no longer published (unpublished/rejected/deleted since) are silently
 * excluded via getListingsByIds' own status filter.
 *
 * Pinned listings float to the top regardless of recency (a pin says "I'm
 * still deciding on this one"), so a pin survives even once the listing falls
 * out of the recent-6 window. Unpinned items keep their recency order below.
 */
export async function getRecentlyViewed(userId: string, limit = 6): Promise<RecentlyViewedListing[]> {
  const [pinned, events] = await Promise.all([
    prisma.pinnedListing.findMany({
      where: { userId },
      orderBy: { pinnedAt: "desc" },
      select: { listingId: true, pinnedAt: true },
    }),
    prisma.userEvent.findMany({
      where: { userId, eventType: "action_taken" },
      orderBy: { createdAt: "desc" },
      take: limit * 3, // over-fetch to allow for de-duplication by listing
      select: { metadata: true, createdAt: true },
    }),
  ]);

  const pinnedIds = new Set(pinned.map((p) => p.listingId));

  const viewedAtById = new Map<string, Date>();
  for (const event of events) {
    const listingId = (event.metadata as { listingId?: string } | null)?.listingId;
    if (!listingId || viewedAtById.has(listingId)) continue;
    viewedAtById.set(listingId, event.createdAt);
  }

  // Pinned first, in pin order; then recency order, skipping anything pinned
  // so it doesn't appear twice.
  const unpinnedLimit = Math.max(limit - pinned.length, 0);
  const pickedIds = new Set<string>();
  const orderedIds: string[] = [];
  for (const event of events) {
    const listingId = (event.metadata as { listingId?: string } | null)?.listingId;
    if (!listingId || pinnedIds.has(listingId) || pickedIds.has(listingId)) continue;
    pickedIds.add(listingId);
    orderedIds.push(listingId);
    if (orderedIds.length >= unpinnedLimit) break;
  }
  const allIds = [...pinned.map((p) => p.listingId), ...orderedIds];
  if (allIds.length === 0) return [];

  const pinnedAtById = new Map(pinned.map((p) => [p.listingId, p.pinnedAt]));

  const listings = await getListingsByIds(allIds);
  const byId = new Map(listings.map((l) => [l.id, l]));
  return allIds
    .map((id) => byId.get(id))
    .filter((l): l is ListingDTO => !!l)
    .map((listing) => ({
      listing,
      viewedAt: (viewedAtById.get(listing.id) ?? pinnedAtById.get(listing.id) ?? new Date()).toISOString(),
      pinned: pinnedIds.has(listing.id),
    }));
}

/**
 * Pin or unpin a listing for a user. Pins are independent of recency — a
 * pinned listing floats to the top of the recents row and the history page
 * until explicitly unpinned. Re-pinning an already-pinned listing is a no-op
 * (the upsert's update is empty); unpinning a never-pinned listing is also a
 * no-op.
 */
export async function setListingPinned(userId: string, listingId: string, pinned: boolean): Promise<void> {
  if (pinned) {
    await prisma.pinnedListing.upsert({
      where: { userId_listingId: { userId, listingId } },
      create: { userId, listingId },
      update: {},
    });
  } else {
    await prisma.pinnedListing.deleteMany({ where: { userId, listingId } });
  }
}

export type RecentlyViewedDetailedListing = {
  listing: ListingDTO;
  category: { id: string; slug: string; name: string; sector: { slug: string; name: string } };
  viewedAt: string;
  pinned: boolean;
};

/**
 * History-page variant of getRecentlyViewed that also resolves each listing's
 * category and sector, so the history can be shown "no matter the category".
 * Pinned listings are pulled to the top (the history keeps its recency order
 * below them), so what a user pinned stays easy to find even after it scrolls
 * off the dashboard row.
 */
export async function getRecentlyViewedDetailed(
  userId: string,
  limit = 100,
): Promise<RecentlyViewedDetailedListing[]> {
  const [pinned, events] = await Promise.all([
    prisma.pinnedListing.findMany({
      where: { userId },
      orderBy: { pinnedAt: "desc" },
      select: { listingId: true, pinnedAt: true },
    }),
    prisma.userEvent.findMany({
      where: { userId, eventType: "action_taken" },
      orderBy: { createdAt: "desc" },
      take: limit * 3, // over-fetch to allow for de-duplication by listing
      select: { metadata: true, createdAt: true },
    }),
  ]);

  const pinnedIds = new Set(pinned.map((p) => p.listingId));

  const viewedAtById = new Map<string, Date>();
  for (const event of events) {
    const listingId = (event.metadata as { listingId?: string } | null)?.listingId;
    if (!listingId || viewedAtById.has(listingId)) continue;
    viewedAtById.set(listingId, event.createdAt);
  }

  const unpinnedLimit = Math.max(limit - pinned.length, 0);
  const pickedIds = new Set<string>();
  const orderedIds: string[] = [];
  for (const event of events) {
    const listingId = (event.metadata as { listingId?: string } | null)?.listingId;
    if (!listingId || pinnedIds.has(listingId) || pickedIds.has(listingId)) continue;
    pickedIds.add(listingId);
    orderedIds.push(listingId);
    if (orderedIds.length >= unpinnedLimit) break;
  }
  const allIds = [...pinned.map((p) => p.listingId), ...orderedIds];
  if (allIds.length === 0) return [];

  const pinnedAtById = new Map(pinned.map((p) => [p.listingId, p.pinnedAt]));

  const listings = await prisma.listing.findMany({
    where: { id: { in: allIds }, status: "published" },
    include: { provider: true, category: { include: { sector: true } } },
  });
  const byId = new Map(listings.map((l) => [l.id, l]));
  return allIds
    .map((id) => byId.get(id))
    .flatMap((l) => (l ? [l] : []))
    .map((l) => ({
      listing: toListingDTO(l),
      category: {
        id: l.category.id,
        slug: l.category.slug,
        name: l.category.name,
        sector: { slug: l.category.sector.slug, name: l.category.sector.name },
      },
      viewedAt: (viewedAtById.get(l.id) ?? pinnedAtById.get(l.id) ?? new Date()).toISOString(),
      pinned: pinnedIds.has(l.id),
    }));
}

/**
 * "Others also compared" — the Amazon-style social-proof pattern named in
 * the build plan but never implemented. Scans recent Comparison rows that
 * included this listing, tallies which other listings showed up alongside
 * it most often, and returns the top few in rank order. No separate
 * aggregation table — computed from Comparison rows that already exist.
 */
export async function getAlsoCompared(listingId: string, limit = 4): Promise<ListingDTO[]> {
  const comparisons = await prisma.comparison.findMany({
    where: { listingIds: { has: listingId } },
    select: { listingIds: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const counts = new Map<string, number>();
  for (const comparison of comparisons) {
    for (const otherId of comparison.listingIds) {
      if (otherId === listingId) continue;
      counts.set(otherId, (counts.get(otherId) ?? 0) + 1);
    }
  }

  const rankedIds = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id]) => id);
  if (rankedIds.length === 0) return [];

  const listings = await getListingsByIds(rankedIds);
  const byId = new Map(listings.map((l) => [l.id, l]));
  return rankedIds.map((id) => byId.get(id)).filter((l): l is ListingDTO => !!l);
}

/**
 * Cross-provider substitutes for one listing, ranked by comparable-attribute
 * closeness rather than usage history — available immediately (unlike
 * getAlsoCompared, which needs real Comparison rows to exist first) since it's
 * computed straight from the category's own AttributeSchemaFields. See
 * findClosestMatches in similarListings.ts for the scoring itself.
 */
export async function getClosestMatches(listingId: string, limit = 3): Promise<ListingDTO[]> {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: {
      provider: true,
      category: { include: { attributeSchema: { orderBy: { sortOrder: "asc" } } } },
    },
  });
  if (!listing) return [];

  const siblings = await prisma.listing.findMany({
    where: { categoryId: listing.categoryId, status: "published", id: { not: listingId } },
    include: { provider: true },
  });

  const attributeSchema = listing.category.attributeSchema.map((a) => ({
    key: a.key,
    label: a.label,
    dataType: a.dataType as CategoryDTO["attributeSchema"][number]["dataType"],
    unit: a.unit,
    isComparable: a.isComparable,
    sortOrder: a.sortOrder,
  }));

  const matches = findClosestMatches(toListingDTO(listing), siblings.map(toListingDTO), attributeSchema, limit);
  return matches.map((m) => m.listing);
}

export type TrendingListing = { listing: ListingDTO; comparisonCount: number };

/**
 * "127 people compared this this week" style social-proof signal — real
 * comparison volume in the trailing window, never invented. Same
 * tally-over-Comparison-rows approach as getAlsoCompared, but time-windowed
 * and ranked across a sector rather than scoped to one listing's neighbors.
 */
export async function getTrendingListings(
  sectorSlug?: string,
  limit = 6,
  windowDays = 7,
): Promise<TrendingListing[]> {
  const since = new Date(Date.now() - windowDays * 86_400_000);
  const comparisons = await prisma.comparison.findMany({
    where: {
      createdAt: { gte: since },
      ...(sectorSlug ? { category: { sector: { slug: sectorSlug } } } : {}),
    },
    select: { listingIds: true },
  });

  const counts = new Map<string, number>();
  for (const comparison of comparisons) {
    for (const id of comparison.listingIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  const rankedIds = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id]) => id);
  if (rankedIds.length === 0) return [];

  const listings = await getListingsByIds(rankedIds);
  const byId = new Map(listings.map((l) => [l.id, l]));
  return rankedIds
    .map((id) => byId.get(id))
    .filter((l): l is ListingDTO => !!l)
    .map((listing) => ({ listing, comparisonCount: counts.get(listing.id)! }));
}

export type ProviderListingStats = { comparisonAppearances: number; savedCount: number };

/**
 * Provider-facing interest signals, sourced entirely from data that already
 * exists (Comparison/SavedListing) — no new tracking. Deliberately doesn't
 * report a "views" count: nothing in this app tracks a per-listing page
 * view today (see EventType in schema.prisma), and inventing one would be
 * exactly the kind of number this project's design brief forbids.
 */
export async function getProviderListingStats(
  listingIds: string[],
): Promise<Record<string, ProviderListingStats>> {
  const stats: Record<string, ProviderListingStats> = Object.fromEntries(
    listingIds.map((id) => [id, { comparisonAppearances: 0, savedCount: 0 }]),
  );
  if (listingIds.length === 0) return stats;

  const [comparisons, savedCounts] = await Promise.all([
    prisma.comparison.findMany({ where: { listingIds: { hasSome: listingIds } }, select: { listingIds: true } }),
    prisma.savedListing.groupBy({ by: ["listingId"], where: { listingId: { in: listingIds } }, _count: true }),
  ]);

  for (const comparison of comparisons) {
    for (const id of comparison.listingIds) {
      if (id in stats) stats[id].comparisonAppearances += 1;
    }
  }
  for (const row of savedCounts) {
    if (row.listingId in stats) stats[row.listingId].savedCount = row._count;
  }

  return stats;
}

export type MarketOverview = {
  bySector: {
    sectorSlug: string;
    sectorName: string;
    listingCount: number;
    avgPrice: number;
    trendingDown: number;
    trendingUp: number;
    unverifiedCount: number;
  }[];
  anomalies: { listing: ListingDTO; sectorName: string; categoryName: string; trend: PriceTrend }[];
  unverifiedListings: { listing: ListingDTO; sectorName: string; categoryName: string }[];
};

/**
 * Aggregates every live listing into a market-wide view — per-sector
 * pricing/trend/trust rollups, the biggest recent price swings, and
 * unverified-provider listings. Shared root for the Corporate ("Market
 * Intelligence") and Regulator ("Compliance & Market Monitoring")
 * dashboards, computed entirely from existing listing/price-history data —
 * no separate aggregation tables. Pass sectorSlug to drill down into a
 * single sector (the "Explore" stage) instead of the full market.
 */
export async function getMarketOverview(sectorSlug?: string): Promise<MarketOverview> {
  const rows = await prisma.listing.findMany({
    where: {
      status: "published",
      category: { sector: { status: "live", ...(sectorSlug ? { slug: sectorSlug } : {}) } },
    },
    include: { provider: true, category: { include: { sector: true } } },
  });
  const trends = await getListingPriceTrends(rows.map((r) => r.id));

  const bySector = new Map<string, MarketOverview["bySector"][number]>();
  const anomalies: MarketOverview["anomalies"] = [];
  const unverifiedListings: MarketOverview["unverifiedListings"] = [];

  for (const row of rows) {
    const sectorSlug = row.category.sector.slug;
    const entry = bySector.get(sectorSlug) ?? {
      sectorSlug,
      sectorName: row.category.sector.name,
      listingCount: 0,
      avgPrice: 0,
      trendingDown: 0,
      trendingUp: 0,
      unverifiedCount: 0,
    };
    const price = Number(row.price);
    entry.avgPrice = (entry.avgPrice * entry.listingCount + price) / (entry.listingCount + 1);
    entry.listingCount += 1;
    if (!row.provider.verified) entry.unverifiedCount += 1;

    const trend = trends[row.id];
    if (trend) {
      if (trend.direction === "down") entry.trendingDown += 1;
      if (trend.direction === "up") entry.trendingUp += 1;
    }
    bySector.set(sectorSlug, entry);

    const listing = toListingDTO(row);
    if (trend && trend.direction !== "flat") {
      anomalies.push({ listing, sectorName: row.category.sector.name, categoryName: row.category.name, trend });
    }
    if (!row.provider.verified) {
      unverifiedListings.push({ listing, sectorName: row.category.sector.name, categoryName: row.category.name });
    }
  }

  anomalies.sort((a, b) => Math.abs(b.trend.changePercent) - Math.abs(a.trend.changePercent));

  return {
    bySector: [...bySector.values()].map((s) => ({ ...s, avgPrice: Math.round(s.avgPrice * 100) / 100 })),
    // 25, not the whole set — this is "biggest swings worth a look", not a
    // full history. Regulator's compliance trail (getComplianceActivity,
    // below) is the actual full-history view.
    anomalies: anomalies.slice(0, 25),
    unverifiedListings,
  };
}

export type ComplianceActivity = {
  listing: ListingDTO;
  sectorName: string;
  categoryName: string;
  rejectionReason: string | null;
  // lastVerifiedAt, not a dedicated rejectedAt column — admin's reject
  // action bumps lastVerifiedAt (markVerifiedNow defaults true on any admin
  // edit, see /api/admin/listings/[id]), so this is an accurate proxy for
  // "when this rejection happened" without needing a schema change.
  rejectedAt: string;
};

/**
 * Regulator-facing compliance trail: every currently-rejected listing, most
 * recent first — the actual audit-trail feature HANDOFF.md's "no audit log
 * for Regulator" gap was about. Computed straight from Listing.status,
 * nothing invented or separately tracked.
 */
export async function getComplianceActivity(sectorSlug?: string, limit = 50): Promise<ComplianceActivity[]> {
  const rows = await prisma.listing.findMany({
    where: {
      status: "rejected",
      category: { sector: { status: "live", ...(sectorSlug ? { slug: sectorSlug } : {}) } },
    },
    include: { provider: true, category: { include: { sector: true } } },
    orderBy: { lastVerifiedAt: "desc" },
    take: limit,
  });

  return rows.map((row) => ({
    listing: toListingDTO(row),
    sectorName: row.category.sector.name,
    categoryName: row.category.name,
    rejectionReason: row.rejectionReason,
    rejectedAt: row.lastVerifiedAt.toISOString(),
  }));
}


// Social intelligence feed
export async function getSocialMentionsForProvider(providerName: string, limit = 20) {
  return prisma.socialPriceMention.findMany({
    where: { matchedProvider: providerName },
    orderBy: { discoveredAt: "desc" },
    take: limit,
  });
}

// Admin-only write path - enforced via requireAdmin() checking ADMIN_EMAILS allowlist
export const AdminWrite = {
  async publishListing(id: string) {
    return prisma.listing.update({ where: { id }, data: { status: ListingStatus.published } });
  },
  async rejectListing(id: string) {
    return prisma.listing.update({ where: { id }, data: { status: ListingStatus.rejected } });
  },
};
