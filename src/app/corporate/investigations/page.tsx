import { Search } from "lucide-react";
import { requireCorporateProvider } from "@/lib/corporateAuth";
import { getProviderFeeComparison } from "@/lib/pricingIntelligence";
import { getInvestigationsForProvider, getActivelyInvestigatedListingIds } from "@/lib/investigations";
import { NotLinkedCard } from "@/components/corporate/NotLinkedCard";
import { Card, Badge } from "@/components/ui/Card";
import { FlagForInvestigationButton } from "@/components/corporate/FlagForInvestigationButton";
import { InvestigationRowActions } from "@/components/corporate/InvestigationRowActions";
import { formatDateTime } from "@/lib/format";

const STATUS_TONE = { open: "coral", in_progress: "sky", resolved: "teal", dismissed: "neutral" } as const;
const STATUS_LABEL = { open: "Open", in_progress: "In progress", resolved: "Resolved", dismissed: "Dismissed" } as const;

export default async function CorporateInvestigationsPage() {
  const result = await requireCorporateProvider();
  if ("notLinked" in result) return <NotLinkedCard />;
  const { provider } = result;

  const [feeComparison, investigations, investigatedListingIds] = await Promise.all([
    getProviderFeeComparison(provider.id),
    getInvestigationsForProvider(provider.id),
    getActivelyInvestigatedListingIds(provider.id),
  ]);

  const unflaggedOutliers = feeComparison.filter((f) => f.isOutlier && !investigatedListingIds.has(f.listingId));

  return (
    <div>
      <h1 className="font-display text-[20px] font-bold">Investigations</h1>
      <p className="mt-1 text-[13px] text-text-secondary">
        Track and resolve flagged pricing issues on your own listings.
      </p>

      {unflaggedOutliers.length > 0 && (
        <section className="mt-6">
          <h2 className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-text-muted">
            <Search size={13} strokeWidth={2.25} /> Worth a look
          </h2>
          <div className="mt-2 flex flex-col gap-2">
            {unflaggedOutliers.map((f) => (
              <Card key={f.listingId} className="flex flex-wrap items-center justify-between gap-3 !p-3.5">
                <div>
                  <p className="text-[13.5px] font-medium">{f.listingName}</p>
                  <p className="text-[11px] text-text-muted">
                    {f.categoryName} · {f.currency} {f.price.toFixed(2)} vs. peer median {f.peerMedian.toFixed(2)} (z {f.zScore.toFixed(2)})
                  </p>
                </div>
                <FlagForInvestigationButton
                  listingId={f.listingId}
                  reason={`z-score ${f.zScore.toFixed(2)} vs. category peer median ${f.peerMedian.toFixed(2)}`}
                />
              </Card>
            ))}
          </div>
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-[12px] font-semibold uppercase tracking-wide text-text-muted">Investigations</h2>
        <div className="mt-2 flex flex-col gap-2">
          {investigations.map((inv) => (
            <Card key={inv.id} className="flex flex-wrap items-start justify-between gap-3 !p-3.5">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-[13.5px] font-medium">{inv.listingName}</p>
                  <Badge tone={STATUS_TONE[inv.status]}>{STATUS_LABEL[inv.status]}</Badge>
                </div>
                <p className="mt-1 text-[12px] text-text-secondary">{inv.reason}</p>
                {inv.notes && <p className="mt-1 text-[12px] text-text-muted">Note: {inv.notes}</p>}
                <p className="mt-1.5 text-[11px] text-text-muted">
                  Flagged {formatDateTime(inv.createdAt)}
                  {inv.resolvedAt && ` · Closed ${formatDateTime(inv.resolvedAt)}`}
                </p>
              </div>
              <InvestigationRowActions id={inv.id} status={inv.status} notes={inv.notes} />
            </Card>
          ))}
          {investigations.length === 0 && (
            <p className="text-[13px] text-text-muted">No investigations yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
