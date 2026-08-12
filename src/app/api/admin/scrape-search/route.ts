import { z } from "zod";
import { privateJson } from "@/lib/apiResponse";
import { requireAdmin } from "@/lib/auth";
import { searchWeb } from "@/lib/scrape/firecrawl";
import { ingestUrl } from "@/lib/scrape/ingest";

const searchSchema = z.object({
  query: z.string().trim().min(1).max(300),
  categoryId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(10).default(3),
});

/**
 * The actual "search the web" admin action. Results are never shown raw —
 * each hit is fetched, extracted, and filed as a ScrapedItem straight into
 * the same review queue as scheduled sources, so nothing bypasses approval.
 */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return privateJson({ error: "Not authorized" }, { status: 403 });

  const parsed = searchSchema.safeParse(await req.json());
  if (!parsed.success) return privateJson({ error: parsed.error.flatten() }, { status: 400 });

  const { query, categoryId, limit } = parsed.data;

  let results;
  try {
    results = await searchWeb(query, { limit });
  } catch (err) {
    return privateJson({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }

  const items = await Promise.all(
    results.map(async (result) => {
      try {
        return await ingestUrl({
          url: result.url,
          sourceId: null,
          categoryId: categoryId ?? null,
          triggeredBy: "admin_manual",
        });
      } catch (err) {
        console.error(`[scrape-search] failed to ingest ${result.url}:`, err);
        return null;
      }
    }),
  );

  return privateJson({ items: items.filter(Boolean) });
}
