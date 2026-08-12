/**
 * Shared fetch → extract → match → file pipeline behind every scrape entry
 * point (scheduled sources, admin "run now", admin web search) — one place
 * so all three land in ScrapedItem the same way, for the same review queue.
 */
import { prisma } from "@/lib/prisma";
import { Prisma, type ScrapeTrigger } from "@prisma/client";
import type { CategoryDTO } from "@/types/catalog";
import { scrapeUrl } from "./firecrawl";
import { extractListingCandidate } from "./extract";
import { suggestMatch } from "./match";

export async function ingestUrl(params: {
  url: string;
  sourceId: string | null;
  categoryId: string | null;
  triggeredBy: ScrapeTrigger;
}) {
  const category = params.categoryId
    ? await prisma.category.findUnique({
        where: { id: params.categoryId },
        include: { attributeSchema: { orderBy: { sortOrder: "asc" } } },
      })
    : null;

  const attributeSchema: CategoryDTO["attributeSchema"] = (category?.attributeSchema ?? []).map((a) => ({
    key: a.key,
    label: a.label,
    dataType: a.dataType as CategoryDTO["attributeSchema"][number]["dataType"],
    unit: a.unit,
    isComparable: a.isComparable,
    sortOrder: a.sortOrder,
  }));

  const page = await scrapeUrl(params.url);
  const { data, confidence } = await extractListingCandidate({
    markdown: page.markdown,
    sourceUrl: page.url,
    attributeSchema,
  });
  const match = await suggestMatch({
    providerNameGuess: data.provider_name_guess,
    categoryId: params.categoryId,
    listingNameGuess: data.name,
  });

  return prisma.scrapedItem.create({
    data: {
      sourceId: params.sourceId,
      categoryId: params.categoryId,
      sourceUrl: page.url,
      triggeredBy: params.triggeredBy,
      rawContent: page.markdown,
      extractedData: data as Prisma.InputJsonValue,
      confidence,
      suggestedProviderId: match.providerId,
      suggestedListingId: match.listingId,
    },
  });
}
