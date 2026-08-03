import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMarketOverview } from "@/lib/catalog";
import { Header } from "@/components/Header";
import { Card, Badge } from "@/components/ui/Card";
import { LogoutButton } from "@/components/LogoutButton";
import { TREND_TONE, TREND_ARROW } from "@/lib/listingDisplay";

export default async function RegulatorDashboardPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { role: true } });
  if (dbUser?.role !== "regulator") redirect("/dashboard");

  const { anomalies, unverifiedListings } = await getMarketOverview();

  return (
    <div className="flex flex-1 flex-col px-5 pb-12 pt-6 md:px-10">
      <Header />
      <div className="mt-4 flex items-center justify-between">
        <div>
          <p className="text-[13px] text-text-secondary">Regulator account</p>
          <h1 className="font-display text-[24px] font-bold">Compliance & Market Monitoring</h1>
        </div>
        <LogoutButton />
      </div>

      <section className="mt-6">
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
        <h2 className="font-display text-[16px] font-semibold">Unverified provider listings</h2>
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
    </div>
  );
}
