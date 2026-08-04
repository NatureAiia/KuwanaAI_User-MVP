import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getListingPriceTrends } from "@/lib/catalog";
import { computePriceForecast } from "@/lib/priceTrend";
import { BottomTabBar } from "@/components/BottomTabBar";
import { Header } from "@/components/Header";
import { Badge } from "@/components/ui/Card";
import { ProviderLogo } from "@/components/ProviderLogo";
import { ListingActions } from "@/components/ListingActions";
import { PriceSparkline } from "@/components/PriceSparkline";
import { FormattedPrice } from "@/components/FormattedPrice";
import { TREND_TONE, TREND_ARROW, FRESHNESS_TONE } from "@/lib/listingDisplay";

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
  const trends = await getListingPriceTrends([listing.id]);
  const trend = trends[listing.id];
  const forecast = trend ? computePriceForecast(trend) : null;

  return (
    <div className="flex flex-1 flex-col px-5 pb-24 pt-6 md:px-10">
      <Header />
      <p className="mt-4 text-[12px] uppercase tracking-widest text-text-muted">
        {listing.category.sector.name} · {listing.category.name}
      </p>
      <h1 className="mt-1 font-display text-[24px] font-bold">{listing.name}</h1>
      <div className="mt-1 flex items-center gap-2">
        <ProviderLogo name={listing.provider.name} logoUrl={listing.provider.logoUrl} size={22} />
        <p className="text-[14px] text-text-secondary">{listing.provider.name}</p>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <p className="font-mono text-[28px] font-semibold">
          <FormattedPrice amount={Number(listing.price)} currency={listing.currency} />
        </p>
        <Badge tone={FRESHNESS_TONE[listing.freshnessStatus]}>{listing.freshnessStatus}</Badge>
      </div>
      <p className="mt-1 text-[11px] text-text-muted">
        Last verified {listing.lastVerifiedAt.toLocaleDateString()}
      </p>

      {trend && (
        <div className="mt-4 flex items-center justify-between gap-4 rounded-[var(--radius-card)] border border-border bg-bg-surface p-4">
          <div>
            <Badge tone={TREND_TONE[trend.direction]}>
              {TREND_ARROW[trend.direction]} {Math.abs(trend.changePercent)}% / {trend.periodDays}d
            </Badge>
            <p className="mt-2 text-[11px] text-text-muted">
              {trend.direction === "down" && "Price has been trending down."}
              {trend.direction === "up" && "Price has been trending up."}
              {trend.direction === "flat" && "Price has been stable."}
            </p>
          </div>
          <PriceSparkline points={trend.points} direction={trend.direction} />
        </div>
      )}

      {forecast && (
        <p className="mt-2 text-[11px] text-text-muted">
          At this rate, expect ~<FormattedPrice amount={forecast.projectedPrice} currency={listing.currency} /> in{" "}
          {forecast.projectionDays} days. Estimate based on the recent trend, not a guarantee.
        </p>
      )}

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
