import { BarChart2, CheckCircle2, Percent, ShieldAlert, TrendingUp } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireCorporateProvider } from "@/lib/corporateAuth";
import { getProviderFeeComparison } from "@/lib/pricingIntelligence";
import { getActiveDiscountsForProvider } from "@/lib/discounts";
import { getListingPriceTrends } from "@/lib/catalog";
import { computePriceForecast } from "@/lib/priceTrend";
import { NotLinkedCard } from "@/components/corporate/NotLinkedCard";
import { CorporateStatCard } from "@/components/corporate/CorporateStatCard";
import { SectorTrendBar } from "@/components/corporate/SectorTrendBar";
import { CorporateTag } from "@/components/corporate/CorporateTag";

/**
 * Cross-module rollup: change-request throughput, discount activity, and
 * pricing tier mix in one place — everything here is re-derived from data
 * the individual corporate pages (Requests, Market Intelligence) already
 * fetch, not a new statistic of its own.
 */
export default async function CorporateAnalyticsPage() {
  const result = await requireCorporateProvider();
  if ("notLinked" in result) return <NotLinkedCard />;
  const { provider } = result;

  const [requestCounts, activeDiscounts, feeComparison, myListings] = await Promise.all([
    prisma.corporateRequest.groupBy({ by: ["status"], where: { providerId: provider.id }, _count: true }),
    getActiveDiscountsForProvider(provider.id),
    getProviderFeeComparison(provider.id),
    prisma.listing.findMany({
      where: { providerId: provider.id, status: "published" },
      select: { id: true, name: true, price: true, currency: true },
    }),
  ]);

  // Forecasting: the same linear-projection primitive already used on the
  // consumer listing page (computePriceForecast) — a trend extrapolation of
  // what already happened, not a predictive model. Skips any listing with
  // too little history to fit a line (computePriceForecast returns null).
  const trendsByListingId = await getListingPriceTrends(myListings.map((l) => l.id));
  const forecasts = myListings
    .map((l) => {
      const trend = trendsByListingId[l.id];
      const forecast = trend ? computePriceForecast(trend) : null;
      return forecast ? { listing: l, trend: trend!, forecast } : null;
    })
    .filter((f): f is NonNullable<typeof f> => f !== null);

  const countByStatus = Object.fromEntries(requestCounts.map((s) => [s.status, s._count])) as Record<
    "pending" | "approved" | "rejected",
    number
  >;
  const totalReviewed = (countByStatus.approved ?? 0) + (countByStatus.rejected ?? 0);
  const approvalRate = totalReviewed > 0 ? Math.round(((countByStatus.approved ?? 0) / totalReviewed) * 100) : null;

  const outlierCount = feeComparison.filter((f) => f.isOutlier).length;
  const normalCount = feeComparison.length - outlierCount;

  return (
    <div>
      <h1 className="font-display text-[20px] font-bold">Analytics</h1>
      <p className="mt-1 text-[13px] text-text-secondary">
        A cross-module rollup of your pricing, discounts, and change-request activity on Kuwana.
      </p>

      <section className="mt-6">
        <h2 className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-text-muted">
          <BarChart2 size={13} strokeWidth={2.25} /> Change request throughput
        </h2>
        <div className="mt-2 grid gap-2.5 sm:grid-cols-3">
          <CorporateStatCard icon={CheckCircle2} tone="teal" label="Approved (all time)">
            <p className="font-mono text-[20px] font-semibold">{countByStatus.approved ?? 0}</p>
          </CorporateStatCard>
          <CorporateStatCard icon={ShieldAlert} tone="coral" label="Rejected (all time)">
            <p className="font-mono text-[20px] font-semibold">{countByStatus.rejected ?? 0}</p>
          </CorporateStatCard>
          <CorporateStatCard icon={BarChart2} tone="sky" label="Approval rate">
            <p className="font-mono text-[20px] font-semibold">{approvalRate === null ? "—" : `${approvalRate}%`}</p>
            <p className="text-[11px] text-text-muted">{totalReviewed} reviewed</p>
          </CorporateStatCard>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-text-muted">
          <Percent size={13} strokeWidth={2.25} /> Discount activity
        </h2>
        <div className="mt-2 grid gap-2.5 sm:grid-cols-2">
          <CorporateStatCard icon={Percent} tone="teal" label="Active discount rules">
            <p className="font-mono text-[20px] font-semibold">{activeDiscounts.length}</p>
          </CorporateStatCard>
          <CorporateStatCard icon={Percent} tone="neutral" label="Average markdown">
            <p className="font-mono text-[20px] font-semibold">
              {activeDiscounts.length > 0
                ? `${(activeDiscounts.reduce((sum, d) => sum + Number(d.percentOff), 0) / activeDiscounts.length).toFixed(1)}%`
                : "—"}
            </p>
          </CorporateStatCard>
        </div>
      </section>

      {forecasts.length > 0 && (
        <section className="mt-6">
          <h2 className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-text-muted">
            <TrendingUp size={13} strokeWidth={2.25} /> Pricing forecast
          </h2>
          <p className="mt-1 text-[12px] text-text-secondary">
            A linear projection from each listing&apos;s own price history — what continues if the current trend
            holds, not a prediction.
          </p>
          <div className="mt-2 overflow-hidden rounded-[var(--radius-card)] border border-border">
            {forecasts.map(({ listing, trend, forecast }, i) => (
              <div
                key={listing.id}
                className={`flex flex-wrap items-center justify-between gap-2 bg-bg-surface p-3.5 ${i > 0 ? "border-t border-border" : ""}`}
              >
                <p className="text-[13.5px] font-medium">{listing.name}</p>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[13.5px]">
                    {listing.currency} {trend.currentPrice.toFixed(2)}
                  </span>
                  <span className="text-text-muted">→</span>
                  <span className="font-mono text-[13.5px]">
                    {listing.currency} {forecast.projectedPrice.toFixed(2)}
                  </span>
                  <CorporateTag tone={trend.direction === "down" ? "teal" : trend.direction === "up" ? "coral" : "neutral"}>
                    in {forecast.projectionDays}d
                  </CorporateTag>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {feeComparison.length > 0 && (
        <section className="mt-6">
          <h2 className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-text-muted">
            <ShieldAlert size={13} strokeWidth={2.25} /> Pricing tier mix
          </h2>
          <div className="mt-2 rounded-[var(--radius-card)] border border-border bg-bg-surface p-3.5">
            <div className="flex items-center justify-between text-[13px]">
              <p>
                <span className="font-mono font-semibold">{normalCount}</span> in line with peers
              </p>
              <p>
                <span className="font-mono font-semibold">{outlierCount}</span> worth a look
              </p>
            </div>
            <SectorTrendBar down={normalCount} up={outlierCount} />
            <p className="mt-2.5 text-[11px] text-text-muted">
              Based on {feeComparison.length} published listing(s) against their category peer median.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
