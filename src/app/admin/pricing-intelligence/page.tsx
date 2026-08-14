import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { Card, Badge } from "@/components/ui/Card";
import { SearchableSection } from "@/components/admin/SearchableSection";
import { getSectorPricingSummary, generateSectorNarrative } from "@/lib/pricingIntelligence";

export default async function AdminPricingIntelligencePage() {
  const admin = await requireAdmin();
  if (!admin) notFound();

  const { bySector, outliers } = await getSectorPricingSummary();

  // One narrative call per sector that actually has something to explain —
  // a quiet sector with zero outliers doesn't need an AI call to say so.
  const narrativeEntries = await Promise.all(
    bySector
      .filter((s) => s.outlierCount > 0)
      .map(async (s) => [s.sectorSlug, await generateSectorNarrative(s, outliers)] as const),
  );
  const narrativesBySector = new Map(narrativeEntries);

  return (
    <div className="mx-auto max-w-[1080px] px-5 py-8 md:px-10">
      <h1 className="font-display text-[24px] font-bold">Pricing intelligence</h1>
      <p className="mt-1 text-[13px] text-text-secondary">
        Outlier pricing and sector-wide fee comparison across every category — a listing is flagged when its price
        sits more than 2 standard deviations from its category peers&apos; distribution. Statistical signal, not a
        margin calculation: there&apos;s no cost data behind these numbers.
      </p>

      <section className="mt-6">
        <h2 className="font-display text-[14px] font-semibold text-text-secondary">By sector</h2>
        {bySector.length === 0 && <p className="mt-2 text-[13px] text-text-muted">No live listings yet.</p>}
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {bySector.map((s) => {
            const narrative = narrativesBySector.get(s.sectorSlug);
            return (
              <Card key={s.sectorSlug}>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-display text-[15px] font-semibold">{s.sectorName}</p>
                  {s.outlierCount > 0 && <Badge tone="coral">{s.outlierCount} outlier(s)</Badge>}
                </div>
                <p className="mt-1 text-[12.5px] text-text-secondary">
                  {s.listingCount} published listing(s) · {s.belowPeerMedianCount} below peer median
                </p>
                {narrative && (
                  <div className="mt-2 border-t border-border pt-2">
                    <p className="text-[12.5px] font-medium">{narrative.headline}</p>
                    <ul className="mt-1 list-disc pl-4 text-[12px] text-text-secondary">
                      {narrative.insights.map((insight, i) => (
                        <li key={i}>{insight}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="font-display text-[14px] font-semibold text-text-secondary">
          Outlier listings ({outliers.length})
        </h2>
        <div className="mt-2">
          <SearchableSection placeholder="Search outliers…">
            <div className="flex flex-col gap-2">
              {outliers.length === 0 && (
                <p className="text-[13px] text-text-muted">No outlier pricing detected right now.</p>
              )}
              {outliers.map((o) => (
                <div
                  key={o.listingId}
                  data-search-row
                  className="flex items-start justify-between gap-3 rounded-[var(--radius-card)] border border-border bg-bg-surface p-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-[13.5px] font-medium">{o.listingName}</p>
                      <Badge tone={o.belowPeerMedian ? "coral" : "sky"}>z {o.zScore.toFixed(2)}</Badge>
                    </div>
                    <p className="mt-1 text-[12px] text-text-secondary">
                      {o.providerName} · {o.sectorName} / {o.categoryName}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-[13px]">
                    {o.currency} {o.price.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </SearchableSection>
        </div>
      </section>
    </div>
  );
}
