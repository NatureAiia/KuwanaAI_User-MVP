import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMarketOverview } from "@/lib/catalog";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/Card";
import { LogoutButton } from "@/components/LogoutButton";

export default async function CorporateDashboardPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { role: true } });
  if (dbUser?.role !== "corporate") redirect("/dashboard");

  const { bySector } = await getMarketOverview();

  return (
    <div className="flex flex-1 flex-col px-5 pb-12 pt-6 md:px-10">
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

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
      </div>
    </div>
  );
}
