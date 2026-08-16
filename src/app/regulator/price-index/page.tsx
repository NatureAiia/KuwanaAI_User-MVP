import Link from "next/link";
import { requireRegulatorUser } from "@/lib/regulatorAuth";
import { getRealPriceMovers, DEFAULT_FX_DRIVER_NAME } from "@/lib/realPriceIndex";
import { getMarketBaskets, getBasketIndexTrend } from "@/lib/marketBasket";
import { SECTORS, LIVE_SECTORS, type SectorSlug } from "@/lib/sectors";
import { Card, Badge } from "@/components/ui/Card";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { TREND_TONE, TREND_ARROW } from "@/lib/listingDisplay";
import { EmptyState } from "@/components/ui/EmptyState";

// A listing only counts as "FX/inflation-driven" rather than a genuine
// real-terms move when its nominal swing is at least this many points larger
// than its real (deflated) swing — small gaps are just rounding noise, not a
// meaningful divergence worth calling out.
const DIVERGENCE_THRESHOLD_POINTS = 5;

export default async function RegulatorPriceIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ sector?: string; basket?: string }>;
}) {
  await requireRegulatorUser();

  const { sector: sectorFilter, basket: basketFilter } = await searchParams;
  const activeSector =
    sectorFilter && (LIVE_SECTORS as readonly string[]).includes(sectorFilter) ? (sectorFilter as SectorSlug) : undefined;

  const [movers, baskets] = await Promise.all([getRealPriceMovers(activeSector), getMarketBaskets()]);
  const withRealTrend = movers.filter((m) => m.real !== null);
  const hasDriverCoverage = withRealTrend.length > 0;

  const activeBasketName = basketFilter && baskets.some((b) => b.basketName === basketFilter) ? basketFilter : baskets[0]?.basketName;
  const basketTrend = activeBasketName ? await getBasketIndexTrend(activeBasketName) : null;

  return (
    <div>
      <h1 className="font-display text-[20px] font-bold">Real (FX-adjusted) price index</h1>
      <p className="mt-1 text-[13px] text-text-secondary">
        Nominal price moves vs. their real-terms equivalent, deflated by the &ldquo;{DEFAULT_FX_DRIVER_NAME}&rdquo;
        economic driver — a nominal hike driven by currency depreciation isn&apos;t the same as a genuine price
        increase.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/regulator/price-index"
          className={`tap-target rounded-full border px-4 py-2 text-[13px] font-medium ${
            !activeSector ? "border-accent-sky bg-accent-sky/15 text-accent-sky" : "border-border text-text-secondary"
          }`}
        >
          All sectors
        </Link>
        {LIVE_SECTORS.map((slug) => (
          <Link
            key={slug}
            href={`/regulator/price-index?sector=${slug}`}
            className={`tap-target rounded-full border px-4 py-2 text-[13px] font-medium ${
              activeSector === slug ? "border-accent-sky bg-accent-sky/15 text-accent-sky" : "border-border text-text-secondary"
            }`}
          >
            {SECTORS[slug].name}
          </Link>
        ))}
      </div>

      {!hasDriverCoverage && (
        <Card className="mt-6">
          <EmptyState
            variant="inline"
            title={`No "${DEFAULT_FX_DRIVER_NAME}" readings yet`}
            description={`This view needs period-by-period FX/CPI readings under the name "${DEFAULT_FX_DRIVER_NAME}" before nominal price moves can be adjusted to real terms. Nominal-only trends are shown below in the meantime.`}
            action={{ label: "Add economic driver readings", href: "/admin/economic-drivers" }}
          />
        </Card>
      )}

      <section className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[12px] font-semibold uppercase tracking-wide text-text-muted">Cost-of-living basket</h2>
          {baskets.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {baskets.map((b) => (
                <Link
                  key={b.basketName}
                  href={`/regulator/price-index?basket=${encodeURIComponent(b.basketName)}${activeSector ? `&sector=${activeSector}` : ""}`}
                  className={`tap-target rounded-full border px-3 py-1.5 text-[12px] font-medium ${
                    activeBasketName === b.basketName
                      ? "border-accent-sky bg-accent-sky/15 text-accent-sky"
                      : "border-border text-text-secondary"
                  }`}
                >
                  {b.basketName}
                </Link>
              ))}
            </div>
          )}
        </div>

        {!basketTrend ? (
          <Card className="mt-2">
            <EmptyState
              variant="inline"
              title="No basket curated yet"
              description="Curate a named cost-of-living basket (e.g. staple foods, fuel, data bundles) to track a composite index here."
              action={{ label: "Curate a basket", href: "/admin/market-baskets" }}
            />
          </Card>
        ) : (
          <Card className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[13.5px] font-medium">{basketTrend.basketName}</p>
              <p className="text-[11px] text-text-muted">
                {basketTrend.components.map((c) => c.label).join(" · ")}
              </p>
              {!basketTrend.nominal && <p className="mt-1 text-[12px] text-text-muted">Not enough shared price history yet.</p>}
            </div>
            {basketTrend.nominal && (
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wide text-text-muted">Nominal</p>
                  <Badge tone={TREND_TONE[basketTrend.nominal.direction]}>
                    {TREND_ARROW[basketTrend.nominal.direction]} {Math.abs(basketTrend.nominal.changePercent)}%
                  </Badge>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wide text-text-muted">Real</p>
                  {basketTrend.real ? (
                    <Badge tone={TREND_TONE[basketTrend.real.direction]}>
                      {TREND_ARROW[basketTrend.real.direction]} {Math.abs(basketTrend.real.changePercent)}%
                    </Badge>
                  ) : (
                    <EmptyState variant="inline" className="!text-right" title="No data" />
                  )}
                </div>
              </div>
            )}
          </Card>
        )}
      </section>

      <section className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[12px] font-semibold uppercase tracking-wide text-text-muted">
            Price movers ({movers.length})
          </h2>
          {movers.length > 0 && (
            <ExportCsvButton
              filename={`kuwana-real-price-index${activeSector ? `-${activeSector}` : ""}.csv`}
              headers={["Listing", "Sector", "Category", "Provider", "Nominal change %", "Real change %"]}
              rows={movers.map((m) => [
                m.listingName,
                m.sectorName,
                m.categoryName,
                m.providerName,
                m.nominal.changePercent,
                m.real?.changePercent ?? "",
              ])}
            />
          )}
        </div>

        <div className="mt-2 flex flex-col gap-2">
          {movers.length === 0 && (
            <EmptyState
              title="No price history to compare yet"
              description="Movers show up once a listing has at least two recorded price points to compare."
            />
          )}
          {movers.map((m) => {
            const divergent =
              m.real !== null &&
              Math.abs(m.nominal.changePercent) - Math.abs(m.real.changePercent) >= DIVERGENCE_THRESHOLD_POINTS;
            return (
              <Card key={m.listingId} className="flex flex-wrap items-center justify-between gap-3 !p-3.5">
                <div>
                  <p className="text-[13.5px] font-medium">{m.listingName}</p>
                  <p className="text-[11px] text-text-muted">
                    {m.sectorName} · {m.categoryName} · {m.providerName}
                  </p>
                  {divergent && (
                    <p className="mt-1 text-[11px] text-accent-sky">
                      Mostly currency-driven — real terms move is much smaller than nominal
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wide text-text-muted">Nominal</p>
                    <Badge tone={TREND_TONE[m.nominal.direction]}>
                      {TREND_ARROW[m.nominal.direction]} {Math.abs(m.nominal.changePercent)}%
                    </Badge>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wide text-text-muted">Real</p>
                    {m.real ? (
                      <Badge tone={TREND_TONE[m.real.direction]}>
                        {TREND_ARROW[m.real.direction]} {Math.abs(m.real.changePercent)}%
                      </Badge>
                    ) : (
                      <EmptyState variant="inline" className="!text-right" title="No data" />
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
