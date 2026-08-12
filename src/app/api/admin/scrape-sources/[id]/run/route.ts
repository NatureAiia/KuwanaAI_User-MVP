import { privateJson } from "@/lib/apiResponse";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { ingestUrl } from "@/lib/scrape/ingest";

/** Admin-triggered on-demand run of a single ScrapeSource, outside the daily cron. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return privateJson({ error: "Not authorized" }, { status: 403 });

  const { id } = await params;
  const source = await prisma.scrapeSource.findUnique({ where: { id } });
  if (!source) return privateJson({ error: "Not found" }, { status: 404 });

  try {
    const item = await ingestUrl({
      url: source.url,
      sourceId: source.id,
      categoryId: source.categoryId,
      triggeredBy: "admin_manual",
    });
    await prisma.scrapeSource.update({ where: { id }, data: { lastRunAt: new Date(), lastError: null } });
    return privateJson({ item });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.scrapeSource.update({ where: { id }, data: { lastRunAt: new Date(), lastError: message } });
    return privateJson({ error: message }, { status: 502 });
  }
}
