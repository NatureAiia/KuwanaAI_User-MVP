import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { BottomTabBar } from "@/components/BottomTabBar";
import { Header } from "@/components/Header";
import { ProviderLogo } from "@/components/ProviderLogo";
import { FormattedPrice } from "@/components/FormattedPrice";
import { SECTORS } from "@/lib/sectors";

export default async function SavedPage() {
  const user = await requireUser();
  if (!user) return null;

  const [saved, comparisons] = await Promise.all([
    prisma.savedListing.findMany({
      where: { userId: user.id },
      include: { listing: { include: { provider: true } } },
      orderBy: { savedAt: "desc" },
    }),
    prisma.comparison.findMany({
      where: { userId: user.id },
      include: { category: { include: { sector: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div id="main-content" tabIndex={-1} className="flex flex-1 flex-col px-5 pb-24 pt-6 md:px-10">
      <Header />
      <h1 className="mt-4 font-display text-[24px] font-bold">Shopping List</h1>
      <p className="mt-1 text-[13px] text-text-secondary">
        Everything you&apos;ve saved — product, brand and price, in one place.
      </p>

      <h2 className="mt-6 font-display text-[15px] font-semibold">Saved items</h2>
      {saved.length === 0 ? (
        <p className="mt-2 text-[13px] text-text-muted">
          Your shopping list is empty — save products you&apos;re comparing and they&apos;ll show up here.
        </p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {saved.map((s) => (
            <li key={s.listingId}>
              <Link
                href={`/listing/${s.listingId}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-bg-surface px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <ProviderLogo
                    name={s.listing.provider.name}
                    logoUrl={s.listing.provider.logoUrl}
                    size={32}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-medium">{s.listing.name}</p>
                    <p className="truncate text-[12px] text-text-muted">{s.listing.provider.name}</p>
                  </div>
                </div>
                <p className="shrink-0 font-mono text-[14px] font-semibold">
                  <FormattedPrice amount={Number(s.listing.price)} currency={s.listing.currency} />
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-8 font-display text-[15px] font-semibold">Comparison history</h2>
      {comparisons.length === 0 ? (
        <p className="mt-2 text-[13px] text-text-muted">No comparisons yet.</p>
      ) : (
        <div className="mt-3 space-y-2.5">
          {comparisons.map((c) => (
            <div key={c.id} className="rounded-xl border border-border bg-bg-surface px-4 py-3">
              <p className="text-[14px] font-medium">
                {SECTORS[c.category.sector.slug as keyof typeof SECTORS]?.name} · {c.category.name}
              </p>
              <p className="text-[12px] text-text-muted">
                {c.listingIds.length} listings · {c.createdAt.toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}

      <BottomTabBar />
    </div>
  );
}
