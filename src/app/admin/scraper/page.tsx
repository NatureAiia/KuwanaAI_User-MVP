import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/Card";
import { ScrapeSourceFormLazy, ScrapeSearchBoxLazy } from "@/components/LazyClients";
import { ScrapeSourceRowActions } from "@/components/admin/ScrapeSourceRowActions";
import { ScrapedItemReview, type ExtractedFields } from "@/components/admin/ScrapedItemReview";
import { SearchableSection } from "@/components/admin/SearchableSection";

export default async function AdminScraperPage() {
  const admin = await requireAdmin();
  if (!admin) notFound();

  const [sources, pendingItems, categories, providers] = await Promise.all([
    prisma.scrapeSource.findMany({
      include: { category: { include: { sector: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.scrapedItem.findMany({
      where: { status: "pending" },
      include: {
        suggestedProvider: { select: { id: true, name: true } },
        suggestedListing: { select: { id: true, name: true, category: { select: { name: true } } } },
      },
      orderBy: { discoveredAt: "desc" },
      take: 100,
    }),
    prisma.category.findMany({ include: { sector: true }, orderBy: [{ sector: { name: "asc" } }, { name: "asc" }] }),
    prisma.provider.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="mx-auto max-w-[1100px] px-5 py-8 md:px-10">
      <h1 className="font-display text-[24px] font-bold">Web scraper</h1>
      <p className="mt-1 text-[13px] text-text-secondary">
        Fetches and extracts pricing from the web — nothing here reaches the catalog until it&apos;s
        approved below. Scheduled sources run once daily via cron; &quot;Run now&quot; and
        &quot;Search the web&quot; run on demand.
      </p>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <ScrapeSourceFormLazy categories={categories} />
        <ScrapeSearchBoxLazy categories={categories} />
      </section>

      <section className="mt-8">
        <h2 className="font-display text-[16px] font-semibold">Sources</h2>
        <div className="mt-3">
        <SearchableSection placeholder="Search sources…">
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border">
          <table className="w-full min-w-[680px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-border bg-bg-surface-raised text-left">
                <th className="p-3 font-medium text-text-muted">Name</th>
                <th className="p-3 font-medium text-text-muted">Category</th>
                <th className="p-3 font-medium text-text-muted">Last run</th>
                <th className="p-3 font-medium text-text-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.id} data-search-row className="border-b border-border last:border-0">
                  <td className="p-3">
                    <p className="font-medium">{s.name}</p>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11.5px] text-text-muted hover:underline"
                    >
                      {s.url}
                    </a>
                  </td>
                  <td className="p-3 text-text-secondary">
                    {s.category ? `${s.category.sector.name} / ${s.category.name}` : "—"}
                  </td>
                  <td className="p-3 text-text-secondary">
                    {s.lastRunAt ? s.lastRunAt.toISOString().replace("T", " ").slice(0, 19) : "Never"}
                    {s.lastError && <Badge tone="coral" className="ml-1.5">Failed</Badge>}
                  </td>
                  <td className="p-3">
                    <ScrapeSourceRowActions id={s.id} enabled={s.enabled} />
                  </td>
                </tr>
              ))}
              {sources.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-text-muted">
                    No sources yet — add one above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </SearchableSection>
        </div>
      </section>

      <section className="mt-8">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-[16px] font-semibold">Review queue</h2>
          {pendingItems.length > 0 && <Badge tone="sky">{pendingItems.length} pending</Badge>}
        </div>
        <div className="mt-3">
        <SearchableSection placeholder="Search review queue…">
        <div className="space-y-3">
          {pendingItems.map((item) => (
            <div key={item.id} data-search-row>
              <ScrapedItemReview
                item={{
                  id: item.id,
                  sourceUrl: item.sourceUrl,
                  rawContent: item.rawContent,
                  confidence: item.confidence,
                  extractedData: item.extractedData as unknown as ExtractedFields,
                  categoryId: item.categoryId,
                  suggestedProvider: item.suggestedProvider,
                  suggestedListing: item.suggestedListing,
                }}
                categories={categories}
                providers={providers}
              />
            </div>
          ))}
          {pendingItems.length === 0 && (
            <p className="text-[13px] text-text-muted">Nothing pending — run a source or search above.</p>
          )}
        </div>
        </SearchableSection>
        </div>
      </section>
    </div>
  );
}
