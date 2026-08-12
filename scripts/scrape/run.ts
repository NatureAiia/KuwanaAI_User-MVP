/**
 * Scheduled scraper — run manually or wire to a scheduler:
 *
 *   npx tsx scripts/scrape/run.ts
 *
 * Fetches every enabled ScrapeSource (see /admin/scraper), extracts a
 * candidate listing via the LLM ladder, and files it as a ScrapedItem for
 * manual review. Nothing here writes to Listing/Provider directly — an
 * admin decides what to approve. See src/lib/scrape/ingest.ts for the
 * shared fetch/extract/match pipeline, also used by the admin "run now" and
 * "search the web" actions.
 */
import "dotenv/config";
import { fileURLToPath } from "node:url";
import { prisma } from "@/lib/prisma";
import { ingestUrl } from "@/lib/scrape/ingest";

export async function runScrape() {
  const sources = await prisma.scrapeSource.findMany({ where: { enabled: true } });
  let ok = 0;
  let failed = 0;

  for (const source of sources) {
    try {
      await ingestUrl({
        url: source.url,
        sourceId: source.id,
        categoryId: source.categoryId,
        triggeredBy: "cron",
      });
      await prisma.scrapeSource.update({
        where: { id: source.id },
        data: { lastRunAt: new Date(), lastError: null },
      });
      ok += 1;
      console.log(`[scrape] ${source.name}: ok`);
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message : String(err);
      await prisma.scrapeSource.update({
        where: { id: source.id },
        data: { lastRunAt: new Date(), lastError: message },
      });
      console.error(`[scrape] ${source.name}: failed — ${message}`);
    }
  }

  console.log(`\n[scrape] ${ok}/${sources.length} source(s) ok, ${failed} failed.`);
  return { total: sources.length, ok, failed };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runScrape()
    .catch((err) => {
      console.error("[scrape] failed:", err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
