import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MarketBasketItemForm } from "@/components/admin/MarketBasketItemForm";
import { MarketBasketItemRowActions } from "@/components/admin/MarketBasketItemRowActions";
import { SearchableSection } from "@/components/admin/SearchableSection";

export default async function AdminMarketBasketsPage() {
  const admin = await requireAdmin();
  if (!admin) notFound();

  const [items, listings] = await Promise.all([
    prisma.marketBasketItem.findMany({
      include: { listing: { select: { name: true } } },
      orderBy: [{ basketName: "asc" }, { createdAt: "asc" }],
    }),
    prisma.listing.findMany({
      where: { status: "published" },
      select: { id: true, name: true, provider: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  const existingBasketNames = [...new Set(items.map((i) => i.basketName))];

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-8 md:px-10">
      <h1 className="font-display text-[24px] font-bold">Market baskets</h1>
      <p className="mt-1 text-[13px] text-text-secondary">
        {items.length} component(s) across {existingBasketNames.length} basket(s). A cost-of-living index tracked
        over time on /regulator/price-index, computed from each component listing&apos;s own price history —
        nothing entered here directly.
      </p>

      <div className="mt-6">
        <MarketBasketItemForm
          existingBasketNames={existingBasketNames}
          listings={listings.map((l) => ({ id: l.id, name: l.name, providerName: l.provider.name }))}
        />
      </div>

      <div className="mt-6">
        <SearchableSection placeholder="Search basket components…">
          <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border">
            <table className="w-full min-w-[720px] border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-border bg-bg-surface-raised text-left">
                  <th className="p-3 font-medium text-text-muted">Basket</th>
                  <th className="p-3 font-medium text-text-muted">Component</th>
                  <th className="p-3 font-medium text-text-muted">Listing</th>
                  <th className="p-3 font-medium text-text-muted">Weight</th>
                  <th className="p-3 font-medium text-text-muted">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} data-search-row className="border-b border-border last:border-0">
                    <td className="p-3 font-medium">{item.basketName}</td>
                    <td className="p-3 text-text-secondary">{item.label}</td>
                    <td className="p-3 text-text-secondary">{item.listing.name}</td>
                    <td className="p-3 font-mono text-text-secondary">{Number(item.weight)}</td>
                    <td className="p-3">
                      <MarketBasketItemRowActions itemId={item.id} />
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-text-muted">
                      No basket components yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SearchableSection>
      </div>
    </div>
  );
}
