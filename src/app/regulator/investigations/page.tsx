import Link from "next/link";
import { Search } from "lucide-react";
import { requireRegulatorUser } from "@/lib/regulatorAuth";
import { getSectorPricingSummary } from "@/lib/pricingIntelligence";
import { getAllInvestigations, getActivelyInvestigatedListingIdsGlobal } from "@/lib/investigations";
import { SECTORS, LIVE_SECTORS, type SectorSlug } from "@/lib/sectors";
import { Card, Badge } from "@/components/ui/Card";
import { FlagForInvestigationButton } from "@/components/regulator/FlagForInvestigationButton";
import { InvestigationRowActions } from "@/components/regulator/InvestigationRowActions";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { formatDateTime } from "@/lib/format";

const STATUS_TONE = { open: "coral", in_progress: "sky", resolved: "teal", dismissed: "neutral" } as const;
const STATUS_LABEL = { open: "Open", in_progress: "In progress", resolved: "Resolved", dismissed: "Dismissed" } as const;
const OUTCOME_LABEL = { none: "No outcome yet", warning: "Warning issued", fine: "Fine issued", suspension: "Provider suspended" } as const;

export default async function RegulatorInvestigationsPage({
  searchParams,
}: {
  searchParams: Promise<{ sector?: string }>;
}) {
  await requireRegulatorUser();

  const { sector: sectorFilter } = await searchParams;
  const activeSector =
    sectorFilter && (LIVE_SECTORS as readonly string[]).includes(sectorFilter) ? (sectorFilter as SectorSlug) : undefined;

  const [{ outliers }, investigations, investigatedListingIds] = await Promise.all([
    getSectorPricingSummary(activeSector),
    getAllInvestigations({ sectorSlug: activeSector }),
    getActivelyInvestigatedListingIdsGlobal(),
  ]);

  const unflaggedOutliers = outliers.filter((o) => !investigatedListingIds.has(o.listingId));

  return (
    <div>
      <h1 className="font-display text-[20px] font-bold">Investigations</h1>
      <p className="mt-1 text-[13px] text-text-secondary">
        Open and track enforcement cases against any provider&apos;s listings, market-wide.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/regulator/investigations"
          className={`tap-target rounded-full border px-4 py-2 text-[13px] font-medium ${
            !activeSector ? "border-accent-sky bg-accent-sky/15 text-accent-sky" : "border-border text-text-secondary"
          }`}
        >
          All sectors
        </Link>
        {LIVE_SECTORS.map((slug) => (
          <Link
            key={slug}
            href={`/regulator/investigations?sector=${slug}`}
            className={`tap-target rounded-full border px-4 py-2 text-[13px] font-medium ${
              activeSector === slug ? "border-accent-sky bg-accent-sky/15 text-accent-sky" : "border-border text-text-secondary"
            }`}
          >
            {SECTORS[slug].name}
          </Link>
        ))}
      </div>

      {unflaggedOutliers.length > 0 && (
        <section className="mt-6">
          <h2 className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-text-muted">
            <Search size={13} strokeWidth={2.25} /> Worth a look
          </h2>
          <div className="mt-2 flex flex-col gap-2">
            {unflaggedOutliers.map((o) => (
              <Card key={o.listingId} className="flex flex-wrap items-center justify-between gap-3 !p-3.5">
                <div>
                  <p className="text-[13.5px] font-medium">{o.listingName}</p>
                  <p className="text-[11px] text-text-muted">
                    {o.sectorName} · {o.categoryName} · {o.providerName} · {o.currency} {o.price.toFixed(2)} (z{" "}
                    {o.zScore.toFixed(2)})
                  </p>
                </div>
                <FlagForInvestigationButton
                  listingId={o.listingId}
                  reason={`z-score ${o.zScore.toFixed(2)} vs. category peer median in ${o.sectorName}`}
                />
              </Card>
            ))}
          </div>
        </section>
      )}

      <section className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[12px] font-semibold uppercase tracking-wide text-text-muted">Cases</h2>
          {investigations.length > 0 && (
            <ExportCsvButton
              filename={`kuwana-regulator-cases${activeSector ? `-${activeSector}` : ""}.csv`}
              headers={["Listing", "Sector", "Provider", "Reason", "Status", "Outcome", "Opened", "Closed"]}
              rows={investigations.map((inv) => [
                inv.listingName,
                inv.sectorName,
                inv.providerName,
                inv.reason,
                STATUS_LABEL[inv.status],
                OUTCOME_LABEL[inv.outcome],
                formatDateTime(inv.createdAt),
                inv.resolvedAt ? formatDateTime(inv.resolvedAt) : "",
              ])}
            />
          )}
        </div>
        <div className="mt-2 flex flex-col gap-2">
          {investigations.map((inv) => (
            <Card key={inv.id} className="flex flex-wrap items-start justify-between gap-3 !p-3.5">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-[13.5px] font-medium">{inv.listingName}</p>
                  <Badge tone={STATUS_TONE[inv.status]}>{STATUS_LABEL[inv.status]}</Badge>
                  {inv.outcome !== "none" && <Badge tone="coral">{OUTCOME_LABEL[inv.outcome]}</Badge>}
                </div>
                <p className="mt-1 text-[12px] text-text-secondary">
                  {inv.sectorName} · {inv.providerName}
                </p>
                <p className="mt-1 text-[12px] text-text-secondary">{inv.reason}</p>
                {inv.notes && <p className="mt-1 text-[12px] text-text-muted">Note: {inv.notes}</p>}
                <p className="mt-1.5 text-[11px] text-text-muted">
                  Opened {formatDateTime(inv.createdAt)}
                  {inv.resolvedAt && ` · Closed ${formatDateTime(inv.resolvedAt)}`}
                </p>
              </div>
              <InvestigationRowActions
                id={inv.id}
                status={inv.status}
                notes={inv.notes}
                outcome={inv.outcome}
                evidenceUrls={inv.evidenceUrls}
              />
            </Card>
          ))}
          {investigations.length === 0 && <p className="text-[13px] text-text-muted">No cases yet.</p>}
        </div>
      </section>
    </div>
  );
}
