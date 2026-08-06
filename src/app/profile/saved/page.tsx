import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { BottomTabBar } from "@/components/BottomTabBar";
import { Header } from "@/components/Header";
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
      <h1 className="mt-4 font-display text-[24px] font-bold">Saved & history</h1>

      <h2 className="mt-6 font-display text-[15px] font-semibold">Saved listings</h2>
      {saved.length === 0 ? (
        <p className="mt-2 text-[13px] text-text-muted">Nothing saved yet.</p>
      ) : (
        <div className="mt-3 space-y-2.5">
          {saved.map((s) => (
            <Link
              key={s.listingId}
              href={`/listing/${s.listingId}`}
              className="flex items-center justify-between rounded-xl border border-border bg-bg-surface px-4 py-3"
            >
              <div>
                <p className="text-[14px] font-medium">{s.listing.name}</p>
                <p className="text-[12px] text-text-muted">{s.listing.provider.name}</p>
              </div>
              <p className="font-mono text-[14px] font-semibold">
                <FormattedPrice amount={Number(s.listing.price)} currency={s.listing.currency} />
              </p>
            </Link>
          ))}
        </div>
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
