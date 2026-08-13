import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMarketOverview } from "@/lib/catalog";
import { SECTORS, LIVE_SECTORS, type SectorSlug } from "@/lib/sectors";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/Card";
import { LogoutButton } from "@/components/LogoutButton";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { CorporatePortalNav } from "@/components/corporate/CorporatePortalNav";

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

  return (
    <div id="main-content" tabIndex={-1} className="flex flex-1 flex-col px-5 pb-12 pt-6 md:px-10">
      <Header />
      <div className="mt-4 flex items-center justify-between">
        <div>
          <p className="text-[13px] text-text-secondary">Corporate account</p>
          <h1 className="font-display text-[24px] font-bold">Market Intelligence</h1>
        </div>
        <LogoutButton />
      </div>
      <p className="mt-2 text-[13px] text-text-secondary">
        Live pricing and trend rollups across every sector on Kuwana — computed from the same listing
        and price-history data consumers see.
      </p>

      <CorporatePortalNav active="/corporate" />

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
            <h2 className="font-display text-[16px] font-semibold">Key insights</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Card>
                <p className="text-[12px] text-text-muted">Best buyer-side movement</p>
                {bestOpportunity && bestOpportunity.trendingDown > 0 ? (
                  <>
                    <p className="mt-1 font-display text-[16px] font-semibold">{bestOpportunity.sectorName}</p>
                    <p className="text-[11px] text-text-muted">
                      {bestOpportunity.trendingDown} listing(s) trending down
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-[13px] text-text-muted">No downward movement in view.</p>
                )}
              </Card>
              <Card>
                <p className="text-[12px] text-text-muted">Most supplier risk</p>
                {mostRisk && mostRisk.unverifiedCount > 0 ? (
                  <>
                    <p className="mt-1 font-display text-[16px] font-semibold">{mostRisk.sectorName}</p>
                    <p className="text-[11px] text-text-muted">{mostRisk.unverifiedCount} unverified listing(s)</p>
                  </>
                ) : (
                  <p className="mt-1 text-[13px] text-text-muted">No unverified suppliers in view.</p>
                )}
              </Card>
            </div>
          </section>

          <section className="mt-8">
            <h2 className="font-display text-[16px] font-semibold">Recommended actions</h2>
            <div className="mt-3 flex flex-col gap-2">
              {bestOpportunity && bestOpportunity.trendingDown > 0 && (
                <Card className="flex items-center justify-between gap-3">
                  <p className="text-[13px]">
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
                <Card className="flex items-center justify-between gap-3">
                  <p className="text-[13px]">
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

      <section className="mt-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-[16px] font-semibold">By sector</h2>
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
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {bySector.map((s) => (
            <Card key={s.sectorSlug}>
              <p className="font-display text-[15px] font-semibold">{s.sectorName}</p>
              <p className="mt-1 font-mono text-[22px] font-semibold">${s.avgPrice.toFixed(2)}</p>
              <p className="text-[11px] text-text-muted">avg. price · {s.listingCount} listings</p>
              <div className="mt-3 flex gap-4 text-[12px]">
                <span className="text-accent-teal">↓ {s.trendingDown} trending down</span>
                <span className="text-accent-coral">↑ {s.trendingUp} trending up</span>
              </div>
              {s.unverifiedCount > 0 && (
                <p className="mt-2 text-[11px] text-accent-coral">{s.unverifiedCount} unverified provider listing(s)</p>
              )}
            </Card>
          ))}
          {bySector.length === 0 && <p className="text-[13px] text-text-muted">No live listings in this sector yet.</p>}
        </div>
      </section>
    </div>
  );
}
