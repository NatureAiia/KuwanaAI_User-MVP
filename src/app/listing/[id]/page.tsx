import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getListingPriceTrends, getAlsoCompared } from "@/lib/catalog";
import { requireUser } from "@/lib/auth";
import { computePriceForecast } from "@/lib/priceTrend";
import { getListingRequirements, isRequirementAttribute } from "@/lib/eligibility";
import { BottomTabBar } from "@/components/BottomTabBar";
import { Header } from "@/components/Header";
import { ListingCoverArt } from "@/components/ListingCoverArt";
import { Badge } from "@/components/ui/Card";
import { ProviderLogo } from "@/components/ProviderLogo";
import { ListingActions } from "@/components/ListingActions";
import { CompareToggleButton } from "@/components/explore/CompareToggleButton";
import { CompareTrayBar } from "@/components/explore/CompareTrayBar";
import { PriceSparkline } from "@/components/PriceSparkline";
import { FormattedPrice } from "@/components/FormattedPrice";
import { TREND_TONE, TREND_ARROW, FRESHNESS_TONE } from "@/lib/listingDisplay";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  // Deliberately a small, separate query rather than reusing the fuller one
  // below — Prisma calls aren't request-deduped the way fetch() is, and
  // metadata only needs a handful of fields, not the full category/provider
  // includes the page body needs.
  const listing = await prisma.listing.findUnique({
    where: { id, status: "published" },
    select: { name: true, price: true, currency: true, provider: { select: { name: true } } },
  });
  if (!listing) return {};
  return {
    title: `${listing.name} — ${listing.provider.name} | Kuwana`,
    description: `${listing.name} from ${listing.provider.name}: ${listing.currency} ${Number(listing.price).toFixed(2)}. Compare against alternatives with a transparent decision score on Kuwana.`,
  };
}

export default async function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const listing = await prisma.listing.findUnique({
    where: { id },
    include: {
      provider: true,
      category: { include: { sector: true, attributeSchema: { orderBy: { sortOrder: "asc" } } } },
    },
  });
  // Public page — a draft/pending/rejected listing isn't published yet, so
  // it doesn't exist as far as a consumer visitor is concerned. Providers
  // view their own listings' status via /provider, not this page.
  if (!listing || listing.status !== "published") notFound();

  const attributes = listing.attributes as Record<string, unknown>;
  const attributeSchema = listing.category.attributeSchema.map((a) => ({
    key: a.key,
    label: a.label,
    dataType: a.dataType as "number" | "string" | "enum" | "boolean",
    unit: a.unit,
    isComparable: a.isComparable,
    sortOrder: a.sortOrder,
  }));
  const requirements = getListingRequirements({ attributes }, attributeSchema);
  const trends = await getListingPriceTrends([listing.id]);
  const trend = trends[listing.id];
  const forecast = trend ? computePriceForecast(trend) : null;
  const alsoCompared = await getAlsoCompared(listing.id);

  // Public page, so this can't require auth — just shows unsaved for
  // anonymous visitors instead of gating the page on login.
  const user = await requireUser();
  const initialSaved = user
    ? (await prisma.savedListing.findUnique({
        where: { userId_listingId: { userId: user.id, listingId: listing.id } },
      })) !== null
    : false;

  return (
    <div className="flex flex-1 flex-col px-5 pb-24 pt-6 md:px-10">
      <Header />
      <div className="relative mt-4 aspect-[16/9] w-full overflow-hidden rounded-[var(--radius-card)] border border-border sm:aspect-[21/9]">
        {listing.images[0] ? (
          // eslint-disable-next-line @next/next/no-img-element -- provider-uploaded, arbitrary aspect ratios not worth next/image's fixed-size ceremony here
          <img src={listing.images[0]} alt="" className="h-full w-full object-cover" />
        ) : (
          <ListingCoverArt seed={listing.id} className="h-full w-full" />
        )}
      </div>
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

      {requirements.length > 0 && (
        <div className="mt-6 rounded-[var(--radius-card)] border border-accent-sky/40 bg-accent-sky/5 p-5">
          <h2 className="font-display text-[15px] font-semibold">To qualify</h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {requirements.map((r) => (
              <Badge key={r.key} tone="sky">
                {r.label} {String(r.value)}
                {r.unit ? ` ${r.unit}` : ""}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 rounded-[var(--radius-card)] border border-border bg-bg-surface p-5">
        <h2 className="font-display text-[15px] font-semibold">Specifications</h2>
        <dl className="mt-3 space-y-2.5">
          {listing.category.attributeSchema
            .filter((attr) => !isRequirementAttribute(attr.key))
            .map((attr) => (
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

      {alsoCompared.length > 0 && (
        <div className="mt-6">
          <h2 className="font-display text-[15px] font-semibold">Others also compared</h2>
          <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
            {alsoCompared.map((other) => (
              <Link
                key={other.id}
                href={`/listing/${other.id}`}
                className="flex min-w-[200px] shrink-0 flex-col gap-2 rounded-[var(--radius-card)] border border-border bg-bg-surface p-3.5 hover:border-accent-sky/50"
              >
                <div className="flex items-center gap-2">
                  <ProviderLogo name={other.provider.name} logoUrl={other.provider.logoUrl} size={22} />
                  <p className="truncate text-[13px] font-medium">{other.name}</p>
                </div>
                <p className="font-mono text-[15px] font-semibold">
                  <FormattedPrice amount={other.price} currency={other.currency} />
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <CompareToggleButton
          listingId={listing.id}
          listingName={listing.name}
          providerName={listing.provider.name}
          providerLogoUrl={listing.provider.logoUrl}
          sectorSlug={listing.category.sector.slug}
          categoryId={listing.category.id}
          categoryName={listing.category.name}
        />
      </div>

      <ListingActions
        listingId={listing.id}
        sourceUrl={listing.sourceUrl}
        providerName={listing.provider.name}
        initialSaved={initialSaved}
      />

      <CompareTrayBar />
      <BottomTabBar />
    </div>
  );
}
