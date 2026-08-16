import { prisma } from "@/lib/prisma";
import { getListingPriceTrends } from "@/lib/catalog";
import type { PriceTrend } from "@/lib/priceTrend";
import type { AdvertShortsCard, ListingShortsCard, ShortsCard } from "@/lib/shortsTypes";

export type { ListingShortsCard, AdvertShortsCard, ShortsCard } from "@/lib/shortsTypes";

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const CARD_SELECT = {
  id: true,
  name: true,
  images: true,
  price: true,
  currency: true,
  freshnessStatus: true,
  provider: { select: { name: true, logoUrl: true } },
  category: { select: { slug: true, sector: { select: { slug: true } } } },
} as const;

// Fallback chain, in priority order: the listing's own photo, then the
// provider's logo, then Kuwana's own mark. Almost no listing in this catalog
// has a photo yet, and almost no provider has a logo set either (see
// HANDOFF.md) — without the last resort, most cards would have nothing to
// render at all rather than a placeholder.
const BRAND_PLACEHOLDER = "/kuwana-mark.png";

function toListingCard(
  listing: {
    id: string;
    name: string;
    images: string[];
    price: { toString(): string };
    currency: string;
    freshnessStatus: string;
    provider: { name: string; logoUrl: string | null };
    category: { slug: string; sector: { slug: string } };
  },
  priceTrend: PriceTrend | null,
): ListingShortsCard {
  return {
    kind: "listing",
    id: listing.id,
    name: listing.name,
    image: listing.images[0] || listing.provider.logoUrl || BRAND_PLACEHOLDER,
    providerLogoUrl: listing.provider.logoUrl,
    price: listing.price.toString(),
    currency: listing.currency,
    providerName: listing.provider.name,
    sectorSlug: listing.category.sector.slug,
    categorySlug: listing.category.slug,
    freshnessStatus: listing.freshnessStatus as ListingShortsCard["freshnessStatus"],
    priceTrend,
  };
}

function toAdvertCard(advert: { id: string; sponsorName: string; tagline: string; imageUrl: string }, cardId: string): AdvertShortsCard {
  return {
    kind: "advert",
    id: cardId,
    sponsorName: advert.sponsorName,
    tagline: advert.tagline,
    image: advert.imageUrl,
  };
}

// Adverts appear on a fixed cadence rather than joining the shuffle pool
// outright — there are usually only a handful of active adverts against
// dozens of listings, so a pure random merge would make them vanishingly
// rare (or, on a small feed, cluster them). This guarantees they actually
// "run in shorts" the way /explore's AdvertRotator already guarantees them a
// slot on that page.
const ADVERT_EVERY = 5;

/**
 * Personalized image feed for the /shorts tab. Ranking is deliberately
 * simple for now — filter to the viewer's onboarding footprint sectors (the
 * same implicit-signal source getPersonalizedSpecials uses), then shuffle
 * for the "random autoplay" feel, rather than a scored model. Falls back to
 * the whole published catalog when the footprint sectors don't have enough
 * eligible listings to fill a feed, so a fresh account never sees an empty
 * screen.
 */
export async function getShortsFeed(userId: string, limit = 24): Promise<ShortsCard[]> {
  const footprints = await prisma.sectorFootprint.findMany({ where: { userId }, select: { sector: true } });
  const sectorSlugs = footprints.map((f) => f.sector as string);

  const personalized = await prisma.listing.findMany({
    where: {
      status: "published",
      ...(sectorSlugs.length > 0 ? { category: { sector: { slug: { in: sectorSlugs } } } } : {}),
    },
    select: CARD_SELECT,
    orderBy: { lastVerifiedAt: "desc" },
    take: limit * 3,
  });

  const pool =
    personalized.length >= limit
      ? personalized
      : await prisma.listing.findMany({
          where: { status: "published" },
          select: CARD_SELECT,
          orderBy: { lastVerifiedAt: "desc" },
          take: limit * 3,
        });

  const picked = shuffle(pool).slice(0, limit);
  // Price trend is a real, transparent signal (Kuwana's whole pitch is
  // explainable comparisons) — shown on each card instead of the vanity
  // like/comment counts an earlier pass added.
  const trends = await getListingPriceTrends(picked.map((l) => l.id));
  const listingCards = picked.map((listing) => toListingCard(listing, trends[listing.id] ?? null));

  const adverts = await prisma.advert.findMany({
    where: { active: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, sponsorName: true, tagline: true, imageUrl: true },
  });
  if (adverts.length === 0) return listingCards;
  if (listingCards.length === 0) {
    return adverts.map((advert) => toAdvertCard(advert, `advert-${advert.id}`));
  }

  const feed: ShortsCard[] = [];
  let advertIndex = 0;
  listingCards.forEach((card, i) => {
    feed.push(card);
    if ((i + 1) % ADVERT_EVERY === 0) {
      const advert = adverts[advertIndex % adverts.length];
      feed.push(toAdvertCard(advert, `advert-${advert.id}-${i}`));
      advertIndex++;
    }
  });
  return feed;
}
