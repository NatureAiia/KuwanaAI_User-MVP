import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BottomTabBar } from "@/components/BottomTabBar";
import { Badge } from "@/components/ui/Card";
import { ListingActions } from "@/components/ListingActions";

const FRESHNESS_TONE = { fresh: "teal", stale: "gold", unverified: "coral" } as const;

export default async function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const listing = await prisma.listing.findUnique({
    where: { id },
    include: {
      provider: true,
      category: { include: { sector: true, attributeSchema: { orderBy: { sortOrder: "asc" } } } },
    },
  });
  if (!listing) notFound();

  const attributes = listing.attributes as Record<string, unknown>;

  return (
    <div className="flex flex-1 flex-col px-5 pb-24 pt-6 md:px-10">
      <p className="text-[12px] uppercase tracking-widest text-text-muted">
        {listing.category.sector.name} · {listing.category.name}
      </p>
      <h1 className="mt-1 font-display text-[24px] font-bold">{listing.name}</h1>
      <p className="mt-1 text-[14px] text-text-secondary">{listing.provider.name}</p>

      <div className="mt-4 flex items-center gap-3">
        <p className="font-mono text-[28px] font-semibold">
          {listing.currency} {Number(listing.price).toFixed(2)}
        </p>
        <Badge tone={FRESHNESS_TONE[listing.freshnessStatus]}>{listing.freshnessStatus}</Badge>
      </div>
      <p className="mt-1 text-[11px] text-text-muted">
        Last verified {listing.lastVerifiedAt.toLocaleDateString()}
      </p>

      <div className="mt-6 rounded-[var(--radius-card)] border border-border bg-bg-surface p-5">
        <h2 className="font-display text-[15px] font-semibold">Specifications</h2>
        <dl className="mt-3 space-y-2.5">
          {listing.category.attributeSchema.map((attr) => (
            <div key={attr.key} className="flex justify-between text-[13px]">
              <dt className="text-text-secondary">{attr.label}</dt>
              <dd className="font-medium">
                {typeof attributes[attr.key] === "boolean"
                  ? attributes[attr.key]
                    ? "Yes"
                    : "No"
                  : `${attributes[attr.key] ?? "—"}${attr.unit ? ` ${attr.unit}` : ""}`}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <ListingActions listingId={listing.id} sourceUrl={listing.sourceUrl} providerName={listing.provider.name} />

      <BottomTabBar />
    </div>
  );
}
