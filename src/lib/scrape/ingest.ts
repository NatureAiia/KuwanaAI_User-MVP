/**
 * Shared fetch → extract → match → file pipeline behind every scrape entry
 * point (scheduled sources, admin "run now", admin web search) — one place
 * so all three land in ScrapedItem the same way, for the same review queue.
 */
import { prisma } from "@/lib/prisma";
import { Prisma, type ScrapeTrigger } from "@prisma/client";
import type { CategoryDTO } from "@/types/catalog";
import { scrapeUrl, type ScrapedPage } from "./firecrawl";
import { scrapeUrlWithPlaywright } from "./playwright";
import { extractListingCandidate } from "./extract";
import { suggestMatch } from "./match";

/**
 * Firecrawl first (its own extraction/blocking-handling is generally better
 * for a plain content page); Playwright as the fallback when Firecrawl
 * isn't configured or its request fails, and for pages that need real JS
 * rendering Firecrawl's fetch couldn't handle. Errors from both are thrown
 * together so a caller sees the full picture, not just whichever failed last.
 */
async function fetchPage(url: string): Promise<ScrapedPage> {
  try {
    return await scrapeUrl(url);
  } catch (firecrawlErr) {
    try {
      return await scrapeUrlWithPlaywright(url);
    } catch (playwrightErr) {
      throw new Error(
        `Both fetch engines failed for ${url} — Firecrawl: ${firecrawlErr instanceof Error ? firecrawlErr.message : String(firecrawlErr)}; ` +
          `Playwright: ${playwrightErr instanceof Error ? playwrightErr.message : String(playwrightErr)}`,
      );
    }
  }
}

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
    consumerLabel: a.consumerLabel,
    qualityAxis: a.qualityAxis,
    synonyms: a.synonyms,
    isComparable: a.isComparable,
    sortOrder: a.sortOrder,
  }));

  const page = await fetchPage(params.url);
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
