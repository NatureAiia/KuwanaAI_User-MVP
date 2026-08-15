import Link from "next/link";
import { requireRegulatorUser } from "@/lib/regulatorAuth";
import { getMarketOverview, getComplianceActivity } from "@/lib/catalog";
import { getLatestEconomicDrivers } from "@/lib/economicDrivers";
import { getActiveBusinessConditions } from "@/lib/businessConditions";
import { SECTORS, LIVE_SECTORS, type SectorSlug } from "@/lib/sectors";
import { Card, Badge } from "@/components/ui/Card";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { TREND_TONE, TREND_ARROW } from "@/lib/listingDisplay";

export default async function RegulatorDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ sector?: string }>;
}) {
  await requireRegulatorUser();

  const { sector: sectorFilter } = await searchParams;
  const activeSector =
    sectorFilter && (LIVE_SECTORS as readonly string[]).includes(sectorFilter)
      ? (sectorFilter as SectorSlug)
      : undefined;

  const [{ bySector, anomalies, unverifiedListings }, complianceActivity, economicDrivers, businessConditions] =
    await Promise.all([
      getMarketOverview(activeSector),
      getComplianceActivity(activeSector),
      getLatestEconomicDrivers(),
      getActiveBusinessConditions(activeSector),
    ]);

  // Key Insights: which live sector currently carries the most compliance risk —
  // the one with the most unverified-provider listings — computed from the
  // same rollup already shown below, not a separate statistic.
  const riskiestSector = [...bySector].sort((a, b) => b.unverifiedCount - a.unverifiedCount)[0];
  const totalUnverified = bySector.reduce((sum, s) => sum + s.unverifiedCount, 0);

  return (
    <div>
      <p className="text-[13px] text-text-secondary">Regulator account</p>
      <h1 className="font-display text-[20px] font-bold">Compliance & Market Monitoring</h1>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/regulator"
          className={`tap-target rounded-full border px-4 py-2 text-[13px] font-medium ${
            !activeSector ? "border-accent-sky bg-accent-sky/15 text-accent-sky" : "border-border text-text-secondary"
          }`}
        >
          All sectors
        </Link>
        {LIVE_SECTORS.map((slug) => (
          <Link
            key={slug}
            href={`/regulator?sector=${slug}`}
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
          <h2 className="font-display text-[16px] font-semibold">Economic indicators</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {economicDrivers.map((driver) => (
              <Card key={driver.name}>
                <p className="text-[12px] text-text-muted">
                  {driver.name} ({driver.region}
                  {driver.currencyCode ? `, ${driver.currencyCode}` : ""})
                </p>
                <p className="mt-1 font-mono text-[22px] font-semibold">{driver.value}</p>
                <p className="text-[11px] text-text-muted">
                  as of {new Date(driver.period).toLocaleDateString("en-ZA", { dateStyle: "medium" })}
                  {driver.changePercent !== null &&
                    ` · ${driver.changePercent > 0 ? "↑" : driver.changePercent < 0 ? "↓" : "→"} ${Math.abs(driver.changePercent)}% vs. previous`}
                </p>
              </Card>
            ))}
          </div>
        </section>
      )}

      {businessConditions.length > 0 && (
        <section className="mt-6">
          <h2 className="font-display text-[16px] font-semibold">Business conditions being tracked</h2>
          <p className="mt-1 text-[12px] text-text-muted">
            Regulatory changes, competitor moves, and macro triggers — managed by admin at /admin/business-conditions.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {businessConditions.map((c) => (
              <Card key={c.id} className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-display text-[14px] font-semibold">{c.title}</p>
                  {c.notes && <p className="mt-0.5 text-[12px] text-text-secondary">{c.notes}</p>}
                </div>
                <Badge tone={c.riskLevel === "high" ? "coral" : c.riskLevel === "medium" ? "sky" : "neutral"}>
                  {c.riskLevel}
                </Badge>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section className="mt-6">
        <h2 className="font-display text-[16px] font-semibold">Key insights</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Card>
            <p className="text-[12px] text-text-muted">Unverified listings across {activeSector ? SECTORS[activeSector].name : "all live sectors"}</p>
            <p className="mt-1 font-mono text-[22px] font-semibold">{totalUnverified}</p>
          </Card>
          <Card>
            <p className="text-[12px] text-text-muted">Highest compliance risk</p>
            {riskiestSector && riskiestSector.unverifiedCount > 0 ? (
              <>
                <p className="mt-1 font-display text-[16px] font-semibold">{riskiestSector.sectorName}</p>
                <p className="text-[11px] text-text-muted">{riskiestSector.unverifiedCount} unverified listing(s)</p>
              </>
            ) : (
              <p className="mt-1 text-[13px] text-text-muted">No unverified listings in view.</p>
            )}
          </Card>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-[16px] font-semibold">Recommended actions</h2>
        <div className="mt-3 flex flex-col gap-2">
          {riskiestSector && riskiestSector.unverifiedCount > 0 && (
            <Card className="flex items-center justify-between gap-3">
              <p className="text-[13px]">
                Review {riskiestSector.unverifiedCount} unverified listing(s) in{" "}
                <strong>{riskiestSector.sectorName}</strong> before they influence a consumer recommendation.
              </p>
              <Link
                href={`/regulator?sector=${riskiestSector.sectorSlug}`}
                className="tap-target shrink-0 text-[12.5px] font-semibold text-accent-sky hover:underline"
              >
                Filter to sector
              </Link>
            </Card>
          )}
          {anomalies.length > 0 && (
            <Card className="flex items-center justify-between gap-3">
              <p className="text-[13px]">
                Investigate the largest recent price swing — <strong>{anomalies[0].listing.name}</strong> (
                {anomalies[0].sectorName}) moved {Math.abs(anomalies[0].trend.changePercent)}% in{" "}
                {anomalies[0].trend.periodDays} days.
              </p>
              <Link
                href={anomalies[0].listing.sourceUrl ?? "#"}
                target={anomalies[0].listing.sourceUrl ? "_blank" : undefined}
                rel="noopener noreferrer"
                className="tap-target shrink-0 text-[12.5px] font-semibold text-accent-sky hover:underline"
              >
                View source
              </Link>
            </Card>
          )}
          {(!riskiestSector || riskiestSector.unverifiedCount === 0) && anomalies.length === 0 && (
            <p className="text-[13px] text-text-muted">
              No compliance risks or notable price movement in this view — nothing needs action right now.
            </p>
          )}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-[16px] font-semibold">Largest recent price swings</h2>
        <div className="mt-3 flex flex-col gap-2">
          {anomalies.length === 0 && <p className="text-[13px] text-text-muted">No notable price movement yet.</p>}
          {anomalies.map(({ listing, sectorName, categoryName, trend }) => (
            <Card key={listing.id} className="flex items-center justify-between gap-3">
              <div>
                <p className="font-display text-[14px] font-semibold">{listing.name}</p>
                <p className="text-[11px] text-text-muted">
                  {sectorName} · {categoryName} · {listing.provider.name}
                </p>
              </div>
              <Badge tone={TREND_TONE[trend.direction]}>
                {TREND_ARROW[trend.direction]} {Math.abs(trend.changePercent)}% / {trend.periodDays}d
              </Badge>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-[16px] font-semibold">Unverified provider listings</h2>
          {unverifiedListings.length > 0 && (
            <ExportCsvButton
              filename={`kuwana-unverified-listings${activeSector ? `-${activeSector}` : ""}.csv`}
              headers={["Listing", "Sector", "Category", "Provider", "Price", "Currency"]}
              rows={unverifiedListings.map(({ listing, sectorName, categoryName }) => [
                listing.name,
                sectorName,
                categoryName,
                listing.provider.name,
                listing.price,
                listing.currency,
              ])}
            />
          )}
        </div>
        <div className="mt-3 flex flex-col gap-2">
          {unverifiedListings.length === 0 && (
            <p className="text-[13px] text-text-muted">Every live listing&apos;s provider is verified.</p>
          )}
          {unverifiedListings.map(({ listing, sectorName, categoryName }) => (
            <Card key={listing.id} className="flex items-center justify-between gap-3">
              <div>
                <p className="font-display text-[14px] font-semibold">{listing.name}</p>
                <p className="text-[11px] text-text-muted">
                  {sectorName} · {categoryName} · {listing.provider.name}
                </p>
              </div>
              <Badge tone="coral">Unverified</Badge>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-[16px] font-semibold">Recent compliance actions</h2>
          {complianceActivity.length > 0 && (
            <ExportCsvButton
              filename={`kuwana-compliance-activity${activeSector ? `-${activeSector}` : ""}.csv`}
              headers={["Listing", "Sector", "Category", "Provider", "Rejection reason", "Rejected date"]}
              rows={complianceActivity.map(({ listing, sectorName, categoryName, rejectionReason, rejectedAt }) => [
                listing.name,
                sectorName,
                categoryName,
                listing.provider.name,
                rejectionReason ?? "",
                new Date(rejectedAt).toLocaleDateString("en-ZA", { dateStyle: "medium" }),
              ])}
            />
          )}
        </div>
        <p className="mt-1 text-[12px] text-text-muted">
          Listings an admin rejected on review, most recent first — the trail of what got pulled and why.
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {complianceActivity.length === 0 && (
            <p className="text-[13px] text-text-muted">No rejected listings in this view.</p>
          )}
          {complianceActivity.map(({ listing, sectorName, categoryName, rejectionReason, rejectedAt }) => (
            <Card key={listing.id} className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display text-[14px] font-semibold">{listing.name}</p>
                <p className="text-[11px] text-text-muted">
                  {sectorName} · {categoryName} · {listing.provider.name}
                </p>
                {rejectionReason && <p className="mt-1 text-[12px] text-accent-coral">Reason: {rejectionReason}</p>}
              </div>
              <span className="shrink-0 text-[11px] text-text-muted">
                {new Date(rejectedAt).toLocaleDateString("en-ZA", { dateStyle: "medium" })}
              </span>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
