import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ExternalLink, ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getListingPriceTrends, getAlsoCompared, getClosestMatches, getCategoryAttributeMedians } from "@/lib/catalog";
import { requireUser } from "@/lib/auth";
import { computePriceForecast } from "@/lib/priceTrend";
import { getListingRequirements, isRequirementAttribute } from "@/lib/eligibility";
import { describeMarketPosition } from "@/lib/attributeDirection";
import { resolveFieldLabel } from "@/lib/fieldLabels";
import { BottomTabBar } from "@/components/BottomTabBar";
import { Header } from "@/components/Header";
import { BackButton } from "@/components/ui/BackButton";
import { ListingCoverArt } from "@/components/ListingCoverArt";
import { Badge } from "@/components/ui/Card";
import { ProviderLogo } from "@/components/ProviderLogo";
import { RatingStars } from "@/components/RatingStars";
import { ListingRatingWidget } from "@/components/ListingRatingWidget";
import { ListingActions } from "@/components/ListingActions";
import { ReportPriceButton } from "@/components/ReportPriceButton";
import { CompareToggleButton } from "@/components/explore/CompareToggleButton";
import { CompareTrayBar } from "@/components/explore/CompareTrayBar";
import { PriceSparkline } from "@/components/PriceSparkline";
import { FormattedPrice } from "@/components/FormattedPrice";
import { TREND_TONE, TREND_ARROW, FRESHNESS_TONE, PROVENANCE_LABEL, resolveProviderLink, NOT_A_RESELLER_NOTICE } from "@/lib/listingDisplay";

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
    consumerLabel: a.consumerLabel,
    qualityAxis: a.qualityAxis,
    synonyms: a.synonyms,
    isComparable: a.isComparable,
    sortOrder: a.sortOrder,
  }));
  const requirements = getListingRequirements({ attributes }, attributeSchema);
  const trends = await getListingPriceTrends([listing.id]);
  const trend = trends[listing.id];
  const forecast = trend ? computePriceForecast(trend) : null;
  const attributeMedians = await getCategoryAttributeMedians(listing.category.id);
  const alsoCompared = await getAlsoCompared(listing.id);
  const closestMatches = await getClosestMatches(listing.id);
  const hasSavings = trend && trend.direction === "down" && trend.earliestPrice > Number(listing.price);
  const rating = listing.rating === null ? null : Number(listing.rating);

  // Public page, so this can't require auth — just shows unsaved for
  // anonymous visitors instead of gating the page on login.
  const user = await requireUser();
  const initialSaved = user
    ? (await prisma.savedListing.findUnique({
        where: { userId_listingId: { userId: user.id, listingId: listing.id } },
      })) !== null
    : false;
  const existingRatingRows = user
    ? await prisma.listingQualityRating.findMany({
        where: { listingId: listing.id, userId: user.id },
        select: { axis: true, score: true },
      })
    : [];
  const existingRatings = Object.fromEntries(existingRatingRows.map((r) => [r.axis, r.score]));

  return (
    <div id="main-content" tabIndex={-1} className="flex flex-1 flex-col px-5 pb-24 pt-6 md:px-10">
      <Header />

      <div className="mt-4 flex items-center gap-2">
        <BackButton fallbackHref="/explore" />
        <p className="text-[12px] uppercase tracking-widest text-text-muted">
          {listing.category.sector.name} · {listing.category.name}
        </p>
      </div>

      <div className="mt-4 grid gap-6 md:grid-cols-[1fr_360px] md:items-start md:gap-8">
        {/* Main column */}
        <div className="min-w-0">
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-[var(--radius-card)] border border-border sm:aspect-[21/9]">
            {listing.images[0] ? (
              // eslint-disable-next-line @next/next/no-img-element -- provider-uploaded, arbitrary aspect ratios not worth next/image's fixed-size ceremony here
              <img src={listing.images[0]} alt="" loading="lazy" className="h-full w-full object-cover" />
            ) : (
              <ListingCoverArt seed={listing.id} className="h-full w-full" />
            )}
          </div>

          <h1 className="mt-4 font-display text-[24px] font-bold leading-tight">{listing.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <RatingStars rating={rating} reviewCount={listing.reviewCount} />
            <span className="hidden h-3 w-px bg-border sm:block" />
            <div className="flex items-center gap-1.5 text-[13px] text-text-secondary">
              <ProviderLogo name={listing.provider.name} logoUrl={listing.provider.logoUrl} size={18} />
              {listing.provider.name}
              {listing.provider.verified && <ShieldCheck size={13} className="text-accent-teal" />}
            </div>
          </div>

          {listing.description && (
            <div className="mt-6 rounded-[var(--radius-card)] border border-border bg-bg-surface p-5">
              <h2 className="font-display text-[15px] font-semibold">About this listing</h2>
              <p className="mt-2 whitespace-pre-line text-[13.5px] leading-[1.7] text-text-secondary">
                {listing.description}
              </p>
            </div>
          )}

          {requirements.length > 0 && (
            <div className="mt-6 rounded-[var(--radius-card)] border border-accent-sky/40 bg-accent-sky/5 p-5">
              <h2 className="font-display text-[15px] font-semibold">To qualify</h2>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {requirements.map((r) => (
                  <Badge key={r.key} tone="sky">
                    {resolveFieldLabel(r, "consumer")} {String(r.value)}
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
                .map((attr) => {
                  const median = attributeMedians[attr.key];
                  const value = attributes[attr.key];
                  const position =
                    attr.dataType === "number" && attr.isComparable && median !== undefined && typeof value === "number"
                      ? describeMarketPosition(value, median, attr.key)
                      : null;
                  return (
                    <div key={attr.key} className="flex items-center justify-between text-[13px]">
                      <dt className="text-text-secondary">{resolveFieldLabel(attr, "consumer")}</dt>
                      <dd className="flex items-center gap-1.5 font-medium">
                        {position && position.tone !== "neutral" && (
                          <Badge tone={position.tone}>{position.label}</Badge>
                        )}
                        {typeof value === "boolean" ? (value ? "Yes" : "No") : `${value ?? "—"}${attr.unit ? ` ${attr.unit}` : ""}`}
                      </dd>
                    </div>
                  );
                })}
            </dl>
          </div>

          <ListingRatingWidget listingId={listing.id} isSignedIn={!!user} existingRatings={existingRatings} />

          {alsoCompared.length > 0 && (
            <div className="mt-6">
              <h2 className="font-display text-[15px] font-semibold">Others also compared</h2>
              <p className="mt-0.5 text-[11.5px] text-text-muted">
                Real prices from listings people put side-by-side with this one.
              </p>
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
                    <RatingStars rating={other.rating} reviewCount={other.reviewCount} size={11} />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {closestMatches.length > 0 && (
            <div className="mt-6">
              <h2 className="font-display text-[15px] font-semibold">Closest matches from other providers</h2>
              <p className="mt-0.5 text-[11.5px] text-text-muted">
                Computed from matching specs, not usage — the nearest substitutes by attributes.
              </p>
              <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
                {closestMatches.map((match) => (
                  <Link
                    key={match.id}
                    href={`/listing/${match.id}`}
                    className="flex min-w-[200px] shrink-0 flex-col gap-2 rounded-[var(--radius-card)] border border-border bg-bg-surface p-3.5 hover:border-accent-teal/50"
                  >
                    <div className="flex items-center gap-2">
                      <ProviderLogo name={match.provider.name} logoUrl={match.provider.logoUrl} size={22} />
                      <p className="truncate text-[13px] font-medium">{match.name}</p>
                    </div>
                    <p className="font-mono text-[15px] font-semibold">
                      <FormattedPrice amount={match.price} currency={match.currency} />
                    </p>
                    <RatingStars rating={match.rating} reviewCount={match.reviewCount} size={11} />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar: price, trust, and where-to-find-it — sticky on desktop so
            it stays visible while reading a long description/specs list. */}
        <div className="md:sticky md:top-20">
          <div className="rounded-[var(--radius-card)] border border-border bg-bg-surface p-5">
            <div className="flex items-baseline gap-2">
              <p className="font-mono text-[28px] font-semibold">
                <FormattedPrice amount={Number(listing.price)} currency={listing.currency} />
              </p>
              {hasSavings && (
                <p className="font-mono text-[13px] text-text-muted line-through">
                  <FormattedPrice amount={trend!.earliestPrice} currency={listing.currency} />
                </p>
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge tone={FRESHNESS_TONE[listing.freshnessStatus]}>{listing.freshnessStatus}</Badge>
              {trend && trend.direction !== "flat" && (
                <Badge tone={TREND_TONE[trend.direction]}>
                  {TREND_ARROW[trend.direction]} {Math.abs(trend.changePercent)}% / {trend.periodDays}d
                </Badge>
              )}
            </div>
            <p className="mt-1.5 text-[11px] text-text-muted">
              Last updated by{" "}
              {listing.lastUpdateSource === "corporate" ? listing.provider.name : PROVENANCE_LABEL[listing.lastUpdateSource]},{" "}
              {listing.lastVerifiedAt.toLocaleDateString()}
            </p>

            {trend && trend.points.length >= 2 && (
              <div className="mt-3 border-t border-border pt-3">
                <PriceSparkline points={trend.points} direction={trend.direction} width={280} height={48} />
                {forecast && (
                  <p className="mt-2 text-[11px] text-text-muted">
                    At this rate, expect ~
                    <FormattedPrice amount={forecast.projectedPrice} currency={listing.currency} /> in{" "}
                    {forecast.projectionDays} days. Estimate, not a guarantee.
                  </p>
                )}
              </div>
            )}

            <ListingActions
              listingId={listing.id}
              sourceUrl={listing.sourceUrl}
              providerName={listing.provider.name}
              initialSaved={initialSaved}
            />
            <ReportPriceButton listingId={listing.id} />
            <div className="mt-3">
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
          </div>

          {/* "Where to find it" — the supplier/trust card: who's actually
              behind this listing and how directly it's been verified. */}
          <div className="mt-4 rounded-[var(--radius-card)] border border-border bg-bg-surface p-5">
            <h2 className="font-display text-[13px] font-semibold uppercase tracking-wide text-text-muted">
              Where to find it
            </h2>
            <div className="mt-2.5 flex items-center gap-2.5">
              <ProviderLogo name={listing.provider.name} logoUrl={listing.provider.logoUrl} size={32} />
              <div>
                <p className="flex items-center gap-1 text-[14px] font-semibold">
                  {listing.provider.name}
                  {listing.provider.verified && <ShieldCheck size={13} className="text-accent-teal" />}
                </p>
                <p className="text-[11.5px] text-text-muted">
                  {listing.provider.verified ? "Verified provider on Kuwana" : "Not yet verified by Kuwana"}
                </p>
              </div>
            </div>
            {(() => {
              const link = resolveProviderLink(listing);
              return (
                link && (
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="tap-target mt-3 flex items-center gap-1.5 text-[12.5px] font-semibold text-accent-sky hover:underline"
                  >
                    <ExternalLink size={13} />
                    {listing.sourceUrl ? "View the original listing" : `Visit ${listing.provider.name}`}
                  </a>
                )
              );
            })()}
            <p className="mt-2 text-[11px] leading-snug text-text-muted">{NOT_A_RESELLER_NOTICE}</p>
          </div>
        </div>
      </div>

      <CompareTrayBar />
      <BottomTabBar />
    </div>
  );
}
