import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getProviderFeeComparison } from "@/lib/pricingIntelligence";
import { Header } from "@/components/Header";
import { BottomTabBar } from "@/components/BottomTabBar";
import { Card } from "@/components/ui/Card";
import { priceStanding, PriceStandingBadge } from "@/components/provider/PriceStandingBadge";

export default async function ProviderInsightsPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { role: true } });
  if (dbUser?.role !== "provider") redirect("/dashboard");

  const provider = await prisma.provider.findUnique({ where: { ownerUserId: user.id } });
  if (!provider) redirect("/provider");

  const feeComparison = await getProviderFeeComparison(provider.id);

  const counts = { below: 0, typical: 0, above: 0, unknown: 0 };
  for (const f of feeComparison) {
    counts[priceStanding(f.price, f.peerMedian, f.sampleSize)] += 1;
  }

  return (
    <div id="main-content" tabIndex={-1} className="flex flex-1 flex-col px-5 pb-24 pt-6 md:px-10">
      <Header />
      <Link
        href="/provider"
        className="tap-target -ml-2 mt-4 flex w-fit items-center gap-1 text-[13px] font-medium text-text-secondary"
      >
        <ArrowLeft size={16} /> Back to products
      </Link>

      <h1 className="mt-3 font-display text-[24px] font-bold">Insights</h1>
      <p className="mt-1 text-[13px] text-text-secondary">
        How your prices compare to other listings in the same category on Kuwana.
      </p>

      {feeComparison.length === 0 ? (
        <Card className="mt-5">
          <p className="text-[13px] text-text-secondary">
            Once you have a published product, you&apos;ll see how its price compares to similar listings here.
          </p>
        </Card>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <Card className="!p-3">
              <p className="font-mono text-[20px] font-bold text-accent-teal">{counts.below}</p>
              <p className="text-[11px] text-text-muted">Below typical</p>
            </Card>
            <Card className="!p-3">
              <p className="font-mono text-[20px] font-bold text-accent-sky">{counts.typical}</p>
              <p className="text-[11px] text-text-muted">Typical price</p>
            </Card>
            <Card className="!p-3">
              <p className="font-mono text-[20px] font-bold text-accent-coral">{counts.above}</p>
              <p className="text-[11px] text-text-muted">Above typical</p>
            </Card>
            <Card className="!p-3">
              <p className="font-mono text-[20px] font-bold text-text-muted">{counts.unknown}</p>
              <p className="text-[11px] text-text-muted">Not enough data</p>
            </Card>
          </div>

          <div className="mt-5 flex flex-col gap-2.5">
            {feeComparison.map((f) => (
              <Card key={f.listingId} className="flex flex-wrap items-center justify-between gap-3 !p-3.5">
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-medium">{f.listingName}</p>
                  <p className="mt-0.5 text-[11px] text-text-muted">{f.categoryName}</p>
                  <p className="mt-1 font-mono text-[13px]">
                    {f.currency} {f.price.toFixed(2)}
                    {f.sampleSize >= 5 && (
                      <span className="text-text-muted"> · typical {f.currency} {f.peerMedian.toFixed(2)}</span>
                    )}
                  </p>
                </div>
                <PriceStandingBadge standing={priceStanding(f.price, f.peerMedian, f.sampleSize)} />
              </Card>
            ))}
          </div>
        </>
      )}

      <BottomTabBar />
    </div>
  );
}
