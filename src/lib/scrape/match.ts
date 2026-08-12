import { prisma } from "@/lib/prisma";

export type MatchSuggestion = { providerId: string | null; listingId: string | null };

/**
 * Case-insensitive name lookup against existing Provider/Listing rows — the
 * same idea as scripts/social-scan's matchedProvider string match, extended
 * to also check for an existing listing so a reviewer sees "this looks like
 * an update to X" instead of reviewing a blind new entry on every re-scrape.
 */
export async function suggestMatch(params: {
  providerNameGuess: string | null;
  categoryId: string | null;
  listingNameGuess: string;
}): Promise<MatchSuggestion> {
  if (!params.providerNameGuess) return { providerId: null, listingId: null };

  const provider = await prisma.provider.findFirst({
    where: { name: { equals: params.providerNameGuess, mode: "insensitive" } },
  });
  if (!provider) return { providerId: null, listingId: null };
  if (!params.categoryId) return { providerId: provider.id, listingId: null };

  const listing = await prisma.listing.findFirst({
    where: {
      providerId: provider.id,
      categoryId: params.categoryId,
      name: { equals: params.listingNameGuess, mode: "insensitive" },
    },
  });

  return { providerId: provider.id, listingId: listing?.id ?? null };
}
