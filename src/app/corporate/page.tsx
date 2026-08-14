import Link from "next/link";
import { redirect } from "next/navigation";
import { clsx } from "clsx";
import { BarChart3, TrendingDown, TrendingUp, ShieldAlert, Lightbulb, ShieldQuestion, Radar, Building2, LayoutGrid } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMarketOverview, getCompetitorWatch } from "@/lib/catalog";
import { emailDomain } from "@/lib/orgVerification";
import { SECTORS, LIVE_SECTORS, type SectorSlug } from "@/lib/sectors";
import { Card } from "@/components/ui/Card";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { CorporateTag } from "@/components/corporate/CorporateTag";
import { CorporateStatCard } from "@/components/corporate/CorporateStatCard";
import { SectorTrendBar } from "@/components/corporate/SectorTrendBar";

export default async function CorporateDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ sector?: string }>;
}) {
  const user = await requireUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { role: true } });
  if (dbUser?.role !== "corporate") redirect("/dashboard");

  const { sector: sectorFilter } = await searchParams;
  const activeSector =
    sectorFilter && (LIVE_SECTORS as readonly string[]).includes(sectorFilter)
      ? (sectorFilter as SectorSlug)
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
    ? await prisma.provider.findFirst({ where: { corporateDomain: domain }, select: { id: true } })
    : null;
  const competitorWatch = provider ? await getCompetitorWatch(provider.id) : [];

  return (
    <div>
      <h1 className="font-display text-[20px] font-bold">Market Intelligence</h1>
      <p className="mt-1 text-[13px] text-text-secondary">
        Live pricing and trend rollups across every sector on Kuwana — computed from the same listing
        and price-history data consumers see.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/corporate"
          className={`tap-target rounded-full border px-4 py-2 text-[13px] font-medium ${
            !activeSector ? "border-accent-sky bg-accent-sky/15 text-accent-sky" : "border-border text-text-secondary"
          }`}
        >
          All sectors
        </Link>
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
          <div className="mt-2 overflow-hidden rounded-[var(--radius-card)] border border-border">
            {competitorWatch.map((entry, i) => {
              const cheapestCompetitor = entry.competitors[0];
              const delta = entry.myListing.price - cheapestCompetitor.price;
              const cheaper = delta < 0;
              return (
                <div
                  key={entry.myListing.id}
                  className={`bg-bg-surface p-3.5 ${i > 0 ? "border-t border-border" : ""}`}
                >
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
                      <CorporateTag tone={cheaper ? "teal" : "coral"}>
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
                </div>
              );
            })}
          </div>
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
