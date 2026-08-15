import { FileText } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireCorporateProvider } from "@/lib/corporateAuth";
import { getMarketOverview } from "@/lib/catalog";
import { getProviderFeeComparison } from "@/lib/pricingIntelligence";
import { NotLinkedCard } from "@/components/corporate/NotLinkedCard";
import { Card } from "@/components/ui/Card";
import {
  DownloadMarketIntelligenceReportButton,
  DownloadChangeRequestSummaryButton,
} from "@/components/corporate/DownloadReportButton";

export default async function CorporateReportsPage() {
  const result = await requireCorporateProvider();
  if ("notLinked" in result) return <NotLinkedCard />;
  const { provider } = result;

  const [{ bySector }, feeComparison, requests] = await Promise.all([
    getMarketOverview(),
    getProviderFeeComparison(provider.id),
    prisma.corporateRequest.findMany({
      where: { providerId: provider.id },
      include: { listing: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div>
      <h1 className="font-display text-[20px] font-bold">Reports</h1>
      <p className="mt-1 text-[13px] text-text-secondary">Download a snapshot of your Kuwana data as a PDF.</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Card className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-sky/10 text-accent-sky">
              <FileText size={16} strokeWidth={2} />
            </span>
            <p className="font-display text-[15px] font-semibold">Market Intelligence snapshot</p>
          </div>
          <p className="text-[12.5px] text-text-secondary">
            Sector-wide price rollups plus your fee comparison against category peers, as they stand right now.
          </p>
          <DownloadMarketIntelligenceReportButton
            data={{
              providerName: provider.name,
              bySector: bySector.map((s) => ({
                sectorName: s.sectorName,
                avgPrice: s.avgPrice,
                listingCount: s.listingCount,
                trendingDown: s.trendingDown,
                trendingUp: s.trendingUp,
              })),
              feeComparison: feeComparison.map((f) => ({
                listingName: f.listingName,
                categoryName: f.categoryName,
                price: f.price,
                currency: f.currency,
                peerMedian: f.peerMedian,
                isOutlier: f.isOutlier,
              })),
            }}
          />
        </Card>

        <Card className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-teal/10 text-accent-teal">
              <FileText size={16} strokeWidth={2} />
            </span>
            <p className="font-display text-[15px] font-semibold">Change requests summary</p>
          </div>
          <p className="text-[12.5px] text-text-secondary">
            Every price/product change you&apos;ve submitted, with its current status — {requests.length} total.
          </p>
          <DownloadChangeRequestSummaryButton
            providerName={provider.name}
            rows={requests.map((r) => {
              const proposed = r.proposedData as { name: string; price: number; currency: string };
              return {
                listingName: r.listing?.name ?? proposed.name,
                type: r.type,
                status: r.status,
                price: proposed.price,
                currency: proposed.currency,
                createdAt: r.createdAt,
                reviewedAt: r.reviewedAt,
              };
            })}
          />
        </Card>
      </div>
    </div>
  );
}
