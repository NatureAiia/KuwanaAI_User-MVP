import { prisma } from "@/lib/prisma";
import { computeDecisionScores } from "@/lib/scoring";
import { computeBciForListings } from "@/lib/bciServer";
import { getListingPriceTrends } from "@/lib/catalog";
import type { AttributeSchemaFieldDTO, ListingDTO } from "@/types/catalog";

/**
 * Retrieval layer ("RAG" without a vector store) behind the chat
 * assistant's grounding — this is the same structured-data retrieval
 * /api/chat always did (real listings + Decision Score + price trend,
 * assembled into a system-prompt block the model is told never to
 * contradict), pulled out into one named, testable module instead of being
 * inlined in the route, and now also carrying BCI axis scores. No
 * embeddings/pgvector: retrieval here means "the exact real rows this
 * question is about," which for a closed, structured catalog like this one
 * is more precise than semantic similarity search would be anyway.
 *
 * Max 50 listings per call, matching the uploaded docs' "never a full
 * dump" rule for anything fed to an LLM.
 */
const MAX_GROUNDING_LISTINGS = 50;

export type RetrievedListing = {
  name: string;
  provider: string;
  provider_verified: boolean;
  price: number;
  currency: string;
  freshness: string;
  decision_score: number | null;
  bci_score: number | null;
  price_trend: { direction: string; change_percent: number } | null;
};

export type RetrievalResult = { listings: RetrievedListing[]; truncated: boolean };

function toListingDTO(l: {
  id: string;
  name: string;
  price: unknown;
  currency: string;
  attributes: unknown;
  freshnessStatus: string;
  lastVerifiedAt: Date;
  sourceUrl: string | null;
  images: string[];
  description: string | null;
  rating: unknown;
  reviewCount: number;
  provider: { id: string; name: string; logoUrl: string | null; verified: boolean; websiteUrl: string | null };
}): ListingDTO {
  return {
    id: l.id,
    name: l.name,
    price: Number(l.price),
    currency: l.currency,
    attributes: l.attributes as Record<string, unknown>,
    freshnessStatus: l.freshnessStatus as ListingDTO["freshnessStatus"],
    lastVerifiedAt: l.lastVerifiedAt.toISOString(),
    sourceUrl: l.sourceUrl,
    images: l.images,
    description: l.description ?? null,
    rating: l.rating === null || l.rating === undefined ? null : Number(l.rating),
    reviewCount: l.reviewCount ?? 0,
    provider: l.provider,
  };
}

/**
 * Retrieves real, grounded data for an explicit set of listing ids — what
 * /api/chat calls once a comparison prompt names or has selected specific
 * listings (via listingIds, or once resolveChatIntent()/Flow-1 auto-
 * selection has picked a ranked set — see Phase 7's flow wiring).
 */
export async function retrieveListingGrounding(listingIds: string[]): Promise<RetrievalResult | null> {
  if (listingIds.length === 0) return null;
  const truncated = listingIds.length > MAX_GROUNDING_LISTINGS;
  const boundedIds = listingIds.slice(0, MAX_GROUNDING_LISTINGS);

  const rows = await prisma.listing.findMany({
    where: { id: { in: boundedIds }, status: "published" },
    include: { provider: true, category: { include: { attributeSchema: true } } },
  });
  if (rows.length === 0) return null;

  const listings = rows.map(toListingDTO);
  const trends = await getListingPriceTrends(boundedIds);

  const sameCategory = rows.every((l) => l.categoryId === rows[0].categoryId);
  const schema: AttributeSchemaFieldDTO[] = rows[0].category.attributeSchema.map((a) => ({
    key: a.key,
    label: a.label,
    dataType: a.dataType,
    unit: a.unit,
    consumerLabel: a.consumerLabel,
    qualityAxis: a.qualityAxis,
    synonyms: a.synonyms,
    isComparable: a.isComparable,
    sortOrder: a.sortOrder,
  }));

  const decisionScores = sameCategory ? computeDecisionScores(listings, schema, trends) : {};
  const bciScores = sameCategory ? await computeBciForListings(listings, schema, { trends }) : {};

  return {
    truncated,
    listings: rows.map((l) => ({
      name: l.name,
      provider: l.provider.name,
      provider_verified: l.provider.verified,
      price: Number(l.price),
      currency: l.currency,
      freshness: l.freshnessStatus,
      decision_score: decisionScores[l.id]?.total ?? null,
      bci_score: bciScores[l.id]?.total ?? null,
      price_trend: trends[l.id] ? { direction: trends[l.id]!.direction, change_percent: trends[l.id]!.changePercent } : null,
    })),
  };
}
