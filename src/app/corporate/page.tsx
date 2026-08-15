import Link from "next/link";
import { clsx } from "clsx";
import { BarChart3, TrendingDown, TrendingUp, ShieldAlert, Lightbulb, ShieldQuestion, Radar, Building2, LayoutGrid, Scale, Landmark, MessageCircle } from "lucide-react";
import { requireCorporateUser } from "@/lib/corporateAuth";
import { prisma } from "@/lib/prisma";
import { getMarketOverview, getCompetitorWatch } from "@/lib/catalog";
import { getProviderFeeComparison } from "@/lib/pricingIntelligence";
import { getActiveDiscountsMap, computeEffectivePrice } from "@/lib/discounts";
import { getLatestEconomicDrivers } from "@/lib/economicDrivers";
import { favorabilityTone, RISK_LEVEL_TONE } from "@/lib/tone";
import { getActiveBusinessConditions } from "@/lib/businessConditions";
import { ensureSentimentComputed, getSentimentSummary } from "@/lib/sentiment";
import { emailDomain } from "@/lib/orgVerification";
import { SECTORS, LIVE_SECTORS, type SectorSlug } from "@/lib/sectors";
import { Card } from "@/components/ui/Card";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { CorporateTag } from "@/components/corporate/CorporateTag";
import { CorporateStatCard } from "@/components/corporate/CorporateStatCard";
import { SectorTrendBar } from "@/components/corporate/SectorTrendBar";
import { DividedList } from "@/components/corporate/DividedList";

export default async function CorporateDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ sector?: string }>;
}) {
  const user = await requireCorporateUser();
  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { primarySector: true } });
  const mySector = dbUser?.primarySector as SectorSlug | null | undefined;

  const { sector: sectorFilter } = await searchParams;
  // No ?sector= at all → default to the account's own industry (set at
  // corporate signup) rather than an unfiltered view. `?sector=all` is the
  // explicit "clear the default" escape hatch — otherwise every fresh visit
  // would just re-apply the default and the "All sectors" pill could never
  // actually show all sectors.
  const activeSector: SectorSlug | undefined =
    sectorFilter === "all"
      ? undefined
      : sectorFilter && (LIVE_SECTORS as readonly string[]).includes(sectorFilter)
        ? (sectorFilter as SectorSlug)
        : sectorFilter === undefined && mySector && (LIVE_SECTORS as readonly string[]).includes(mySector)
          ? mySector
          : undefined;

  const { bySector } = await getMarketOverview(activeSector);

  // Key Insights: which sector in view is moving most in the buyer's favor
  // (most listings trending down) vs. carries the most risk (most
  // unverified providers) — both derived from the rollup below, not a
  // separate calculation.
  const bestOpportunity = [...bySector].sort((a, b) => b.trendingDown - a.trendingDown)[0];
  const mostRisk = [...bySector].sort((a, b) => b.unverifiedCount - a.unverifiedCount)[0];

  // Competitor Watch is per-product, so it only applies once this account is
  // linked to a Provider (see requireOwnCorporateOrg's domain-match) — an
  // unlinked account still gets the sector-wide rollups above, just not this.
  const domain = user.email ? emailDomain(user.email) : null;
  const provider = domain
    ? await prisma.provider.findFirst({ where: { corporateDomain: domain }, select: { id: true, name: true } })
    : null;
  const competitorWatch = provider ? await getCompetitorWatch(provider.id) : [];
  const feeComparison = provider ? await getProviderFeeComparison(provider.id) : [];
  const discountsByListingId = await getActiveDiscountsMap(
    feeComparison.map((f) => ({ id: f.listingId, categoryId: f.categoryId })),
  );
  const economicDrivers = await getLatestEconomicDrivers();
  const businessConditions = await getActiveBusinessConditions(activeSector);

  // Sentiment is scoped to this provider's own name match, same join
  // getSocialMentionsForProvider uses — computed lazily here rather than at
  // scan time (see lib/sentiment.ts).
  let sentiment = null as Awaited<ReturnType<typeof getSentimentSummary>> | null;
  if (provider) {
    await ensureSentimentComputed({ matchedProvider: provider.name });
    sentiment = await getSentimentSummary({ matchedProvider: provider.name });
  }

  return (
    <div>
      <h1 className="font-display text-[20px] font-bold">Market Intelligence</h1>
      <p className="mt-1 text-[13px] text-text-secondary">
        Live pricing and trend rollups across every sector on Kuwana — computed from the same listing
        and price-history data consumers see.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/corporate?sector=all"
          className={`tap-target rounded-full border px-4 py-2 text-[13px] font-medium ${
            !activeSector ? "border-accent-sky bg-accent-sky/15 text-accent-sky" : "border-border text-text-secondary"
          }`}
        >
          All sectors
        </Link>
        {mySector && (
          <Link
            href={`/corporate?sector=${mySector}`}
            className={`tap-target rounded-full border px-4 py-2 text-[13px] font-medium ${
              activeSector === mySector
                ? "border-accent-sky bg-accent-sky/15 text-accent-sky"
                : "border-border text-text-secondary"
            }`}
          >
            My sector · {SECTORS[mySector].name}
          </Link>
        )}
        {LIVE_SECTORS.map((slug) => (
          <Link
            key={slug}
            href={`/corporate?sector=${slug}`}
            className={`tap-target rounded-full border px-4 py-2 text-[13px] font-medium ${
              activeSector === slug
                ? "border-accent-sky bg-accent-sky/15 text-accent-sky"
                : "border-border text-text-secondary"
            }`}
          >
            {SECTORS[slug].name}
          </Link>
        ))}
      </div>

      {economicDrivers.length > 0 && (
        <section className="mt-6">
          <h2 className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-text-muted">
            <Landmark size={13} strokeWidth={2.25} /> Economic context
          </h2>
          <div className="mt-2 grid gap-2.5 sm:grid-cols-3">
            {economicDrivers.map((driver) => (
              <CorporateStatCard key={driver.name} icon={Landmark} tone="neutral" label={driver.name}>
                <p className="font-mono text-[18px] font-semibold">
                  {driver.currencyCode ? `${driver.currencyCode} ` : ""}
                  {driver.value}
                </p>
                {driver.changePercent !== null && (
                  <p className="text-[11px] text-text-muted">
                    {driver.changePercent > 0 ? "↑" : driver.changePercent < 0 ? "↓" : "→"}{" "}
                    {Math.abs(driver.changePercent)}% vs. previous reading
                  </p>
                )}
              </CorporateStatCard>
            ))}
          </div>
        </section>
      )}

      {businessConditions.length > 0 && (
        <section className="mt-6">
          <h2 className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-text-muted">
            <ShieldAlert size={13} strokeWidth={2.25} /> Business conditions to watch
          </h2>
          <div className="mt-2 flex flex-col gap-2">
            {businessConditions.map((c) => (
              <Card key={c.id} className="flex items-center justify-between gap-3 !p-3.5">
                <div>
                  <p className="text-[13.5px] font-medium">{c.title}</p>
                  {c.notes && <p className="mt-0.5 text-[12px] text-text-secondary">{c.notes}</p>}
                </div>
                <CorporateTag tone={RISK_LEVEL_TONE[c.riskLevel]}>{c.riskLevel}</CorporateTag>
              </Card>
            ))}
          </div>
        </section>
      )}

      {bySector.length > 0 && (
        <>
          <section className="mt-6">
            <h2 className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-text-muted">
              <BarChart3 size={13} strokeWidth={2.25} /> Key insights
            </h2>
            <div className="mt-2 grid gap-2.5 sm:grid-cols-3">
              <CorporateStatCard icon={BarChart3} tone="sky" label="Sectors tracked">
                <p className="font-mono text-[20px] font-semibold">{bySector.length}</p>
              </CorporateStatCard>
              <CorporateStatCard icon={TrendingDown} tone="teal" label="Best buyer-side movement">
                {bestOpportunity && bestOpportunity.trendingDown > 0 ? (
                  <>
                    <p className="text-[14px] font-semibold">{bestOpportunity.sectorName}</p>
                    <p className="text-[11px] text-text-muted">{bestOpportunity.trendingDown} listing(s) trending down</p>
                  </>
                ) : (
                  <p className="text-[13px] text-text-muted">No downward movement in view.</p>
                )}
              </CorporateStatCard>
              <CorporateStatCard icon={ShieldAlert} tone="coral" label="Most supplier risk">
                {mostRisk && mostRisk.unverifiedCount > 0 ? (
                  <>
                    <p className="text-[14px] font-semibold">{mostRisk.sectorName}</p>
                    <p className="text-[11px] text-text-muted">{mostRisk.unverifiedCount} unverified listing(s)</p>
                  </>
                ) : (
                  <p className="text-[13px] text-text-muted">No unverified suppliers in view.</p>
                )}
              </CorporateStatCard>
            </div>
          </section>

          <section className="mt-6">
            <h2 className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-text-muted">
              <Lightbulb size={13} strokeWidth={2.25} /> Recommended actions
            </h2>
            <div className="mt-2 flex flex-col gap-2">
              {bestOpportunity && bestOpportunity.trendingDown > 0 && (
                <Card className="flex items-center gap-3 !p-3.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-teal/10 text-accent-teal">
                    <TrendingDown size={16} strokeWidth={2} />
                  </span>
                  <p className="flex-1 text-[13px]">
                    Re-quote <strong>{bestOpportunity.sectorName}</strong> now — {bestOpportunity.trendingDown}{" "}
                    listing(s) are trending down, so renewing at last quarter&apos;s rate may overpay.
                  </p>
                  <Link
                    href={`/explore/${bestOpportunity.sectorSlug}`}
                    className="tap-target shrink-0 text-[12.5px] font-semibold text-accent-sky hover:underline"
                  >
                    Explore listings
                  </Link>
                </Card>
              )}
              {mostRisk && mostRisk.unverifiedCount > 0 && (
                <Card className="flex items-center gap-3 !p-3.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-coral/10 text-accent-coral">
                    <ShieldQuestion size={16} strokeWidth={2} />
                  </span>
                  <p className="flex-1 text-[13px]">
                    Confirm supplier verification before committing spend in <strong>{mostRisk.sectorName}</strong> —{" "}
                    {mostRisk.unverifiedCount} listing(s) there are from an unverified provider.
                  </p>
                  <Link
                    href={`/explore/${mostRisk.sectorSlug}`}
                    className="tap-target shrink-0 text-[12.5px] font-semibold text-accent-sky hover:underline"
                  >
                    Explore listings
                  </Link>
                </Card>
              )}
              {(!bestOpportunity || bestOpportunity.trendingDown === 0) &&
                (!mostRisk || mostRisk.unverifiedCount === 0) && (
                  <p className="text-[13px] text-text-muted">
                    Pricing is stable and every provider in view is verified — nothing needs action right now.
                  </p>
                )}
            </div>
          </section>
        </>
      )}

      {feeComparison.length > 0 && (
        <section className="mt-6">
          <h2 className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-text-muted">
            <Scale size={13} strokeWidth={2.25} /> Fee comparison
          </h2>
          <p className="mt-1 text-[12px] text-text-secondary">
            Your listed price against the category peer median. A flagged listing sits far enough from its peers
            to be worth a second look — not a claim that it&apos;s wrong.
          </p>
          <DividedList
            className="mt-2"
            items={feeComparison}
            keyFor={(f) => f.listingId}
            itemClassName="flex flex-wrap items-center justify-between gap-2"
            renderItem={(f) => {
              const belowMedian = f.price < f.peerMedian;
              const discount = discountsByListingId.get(f.listingId);
              const percentOff = discount ? Number(discount.percentOff) : null;
              return (
                <>
                  <div>
                    <p className="text-[13.5px] font-medium">{f.listingName}</p>
                    <p className="text-[11px] text-text-muted">{f.categoryName}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {percentOff !== null ? (
                      <span className="font-mono text-[13.5px]">
                        <span className="text-text-muted line-through">{f.currency} {f.price.toFixed(2)}</span>{" "}
                        {f.currency} {computeEffectivePrice(f.price, percentOff).toFixed(2)}
                      </span>
                    ) : (
                      <span className="font-mono text-[13.5px]">
                        {f.currency} {f.price.toFixed(2)}
                      </span>
                    )}
                    {percentOff !== null && <CorporateTag tone="teal">{percentOff}% off active</CorporateTag>}
                    {f.sampleSize >= 5 ? (
                      <CorporateTag tone={favorabilityTone(belowMedian ? "favorable" : "unfavorable")}>
                        peer median {f.peerMedian.toFixed(2)}
                      </CorporateTag>
                    ) : (
                      <CorporateTag tone="neutral">too few peers to compare</CorporateTag>
                    )}
                    {f.isOutlier && <CorporateTag tone="coral">worth a look (z {f.zScore.toFixed(2)})</CorporateTag>}
                  </div>
                </>
              );
            }}
          />
        </section>
      )}

      {sentiment && sentiment.total > 0 && (
        <section className="mt-6">
          <h2 className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-text-muted">
            <MessageCircle size={13} strokeWidth={2.25} /> Social sentiment
          </h2>
          <p className="mt-1 text-[12px] text-text-secondary">
            Public Reddit/Telegram posts mentioning {provider!.name}, classified by AI — intelligence only, same
            posts admin reviews at Social mentions.
          </p>
          <Card className="mt-2 flex flex-wrap items-center gap-4 !p-3.5">
            {sentiment.positiveShare !== null ? (
              <div>
                <p className="font-mono text-[20px] font-semibold">{Math.round(sentiment.positiveShare * 100)}%</p>
                <p className="text-[11px] text-text-muted">positive</p>
              </div>
            ) : (
              <p className="text-[13px] text-text-muted">Not yet classified — check back shortly.</p>
            )}
            <div className="flex flex-wrap gap-1.5">
              <CorporateTag tone="teal">{sentiment.positive} positive</CorporateTag>
              <CorporateTag tone="coral">{sentiment.negative} negative</CorporateTag>
              <CorporateTag tone="neutral">{sentiment.neutral} neutral</CorporateTag>
              {sentiment.unclassified > 0 && (
                <CorporateTag tone="neutral">{sentiment.unclassified} pending</CorporateTag>
              )}
            </div>
          </Card>
        </section>
      )}

      {competitorWatch.length > 0 && (
        <section className="mt-6">
          <h2 className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-text-muted">
            <Radar size={13} strokeWidth={2.25} /> Competitor watch
          </h2>
          <p className="mt-1 text-[12px] text-text-secondary">
            Your products against the closest cross-provider substitute by price and spec — see{" "}
            <Link href="/corporate/products" className="text-accent-sky hover:underline">
              My Products
            </Link>{" "}
            to request a price change.
          </p>
          <DividedList
            className="mt-2"
            items={competitorWatch}
            keyFor={(entry) => entry.myListing.id}
            renderItem={(entry) => {
              const cheapestCompetitor = entry.competitors[0];
              const delta = entry.myListing.price - cheapestCompetitor.price;
              const cheaper = delta < 0;
              return (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={clsx(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                          cheaper ? "bg-accent-teal/10 text-accent-teal" : "bg-accent-coral/10 text-accent-coral",
                        )}
                      >
                        {cheaper ? <TrendingDown size={15} strokeWidth={2} /> : <TrendingUp size={15} strokeWidth={2} />}
                      </span>
                      <div>
                        <p className="text-[13.5px] font-medium">{entry.myListing.name}</p>
                        <p className="text-[11px] text-text-muted">
                          {entry.sectorName} / {entry.categoryName}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[13.5px]">
                        {entry.myListing.currency} {entry.myListing.price.toFixed(2)}
                      </span>
                      <CorporateTag tone={favorabilityTone(cheaper ? "favorable" : "unfavorable")}>
                        {cheaper ? "↓" : "↑"} {Math.abs(delta).toFixed(2)} vs. {cheapestCompetitor.provider.name}
                      </CorporateTag>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {entry.competitors.map((c) => (
                      <CorporateTag key={c.id} tone="neutral">
                        {c.provider.name}: {c.currency} {c.price.toFixed(2)}
                      </CorporateTag>
                    ))}
                  </div>
                </>
              );
            }}
          />
        </section>
      )}

      <section className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-text-muted">
            <LayoutGrid size={13} strokeWidth={2.25} /> By sector
          </h2>
          {bySector.length > 0 && (
            <ExportCsvButton
              filename={`kuwana-market-intelligence${activeSector ? `-${activeSector}` : ""}.csv`}
              headers={[
                "Sector",
                "Avg price (USD)",
                "Listing count",
                "Trending down",
                "Trending up",
                "Unverified provider listings",
              ]}
              rows={bySector.map((s) => [
                s.sectorName,
                s.avgPrice.toFixed(2),
                s.listingCount,
                s.trendingDown,
                s.trendingUp,
                s.unverifiedCount,
              ])}
            />
          )}
        </div>
        <div className="mt-2 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {bySector.map((s) => {
            const Icon = SECTORS[s.sectorSlug as SectorSlug]?.icon ?? Building2;
            return (
              <Card key={s.sectorSlug} className="!p-3.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent-sky/10 text-accent-sky">
                    <Icon size={15} strokeWidth={2} />
                  </span>
                  <p className="text-[13px] font-semibold">{s.sectorName}</p>
                </div>
                <p className="mt-2 font-mono text-[19px] font-semibold">${s.avgPrice.toFixed(2)}</p>
                <p className="text-[11px] text-text-muted">avg. price · {s.listingCount} listings</p>
                <SectorTrendBar down={s.trendingDown} up={s.trendingUp} />
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <CorporateTag tone="teal">↓ {s.trendingDown} down</CorporateTag>
                  <CorporateTag tone="coral">↑ {s.trendingUp} up</CorporateTag>
                  {s.unverifiedCount > 0 && (
                    <CorporateTag tone="neutral">{s.unverifiedCount} unverified</CorporateTag>
                  )}
                </div>
              </Card>
            );
          })}
          {bySector.length === 0 && <p className="text-[13px] text-text-muted">No live listings in this sector yet.</p>}
        </div>
      </section>
    </div>
  );
}
