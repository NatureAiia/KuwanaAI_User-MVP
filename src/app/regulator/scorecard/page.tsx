import Link from "next/link";
import { requireRegulatorUser } from "@/lib/regulatorAuth";
import { getProviderScorecards } from "@/lib/complianceScorecard";
import { SECTORS, LIVE_SECTORS, type SectorSlug } from "@/lib/sectors";
import { Badge } from "@/components/ui/Card";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { SearchableSection } from "@/components/admin/SearchableSection";

export default async function RegulatorScorecardPage({
  searchParams,
}: {
  searchParams: Promise<{ sector?: string }>;
}) {
  await requireRegulatorUser();

  const { sector: sectorFilter } = await searchParams;
  const activeSector =
    sectorFilter && (LIVE_SECTORS as readonly string[]).includes(sectorFilter) ? (sectorFilter as SectorSlug) : undefined;

  const scorecards = await getProviderScorecards(activeSector);

  return (
    <div>
      <h1 className="font-display text-[20px] font-bold">Provider compliance scorecard</h1>
      <p className="mt-1 text-[13px] text-text-secondary">
        Every provider ranked by open enforcement activity — rolled up from listing status, case history, and
        verification, nothing tracked separately.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/regulator/scorecard"
          className={`tap-target rounded-full border px-4 py-2 text-[13px] font-medium ${
            !activeSector ? "border-accent-sky bg-accent-sky/15 text-accent-sky" : "border-border text-text-secondary"
          }`}
        >
          All sectors
        </Link>
        {LIVE_SECTORS.map((slug) => (
          <Link
            key={slug}
            href={`/regulator/scorecard?sector=${slug}`}
            className={`tap-target rounded-full border px-4 py-2 text-[13px] font-medium ${
              activeSector === slug ? "border-accent-sky bg-accent-sky/15 text-accent-sky" : "border-border text-text-secondary"
            }`}
          >
            {SECTORS[slug].name}
          </Link>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-text-muted">
          {scorecards.length} provider(s)
        </p>
        {scorecards.length > 0 && (
          <ExportCsvButton
            filename={`kuwana-compliance-scorecard${activeSector ? `-${activeSector}` : ""}.csv`}
            headers={[
              "Provider",
              "Verified",
              "Published listings",
              "Rejected listings",
              "Open cases",
              "In progress",
              "Resolved",
              "Dismissed",
              "Avg. resolution (days)",
              "Warnings",
              "Fines",
              "Suspensions",
            ]}
            rows={scorecards.map((s) => [
              s.providerName,
              s.verified ? "Yes" : "No",
              s.publishedListingCount,
              s.rejectedListingCount,
              s.openCases,
              s.inProgressCases,
              s.resolvedCases,
              s.dismissedCases,
              s.avgResolutionDays ?? "",
              s.warningCount,
              s.fineCount,
              s.suspensionCount,
            ])}
          />
        )}
      </div>

      <div className="mt-2">
        <SearchableSection placeholder="Search providers…">
          <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border">
            <table className="w-full min-w-[860px] border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-border bg-bg-surface-raised text-left">
                  <th className="p-3 font-medium text-text-muted">Provider</th>
                  <th className="p-3 font-medium text-text-muted">Listings</th>
                  <th className="p-3 font-medium text-text-muted">Open cases</th>
                  <th className="p-3 font-medium text-text-muted">Closed cases</th>
                  <th className="p-3 font-medium text-text-muted">Avg. resolution</th>
                  <th className="p-3 font-medium text-text-muted">Enforcement</th>
                </tr>
              </thead>
              <tbody>
                {scorecards.map((s) => (
                  <tr key={s.providerId} data-search-row className="border-b border-border last:border-0">
                    <td className="p-3">
                      <p className="font-medium">{s.providerName}</p>
                      <Badge tone={s.verified ? "teal" : "coral"}>{s.verified ? "Verified" : "Unverified"}</Badge>
                    </td>
                    <td className="p-3 text-text-secondary">
                      {s.publishedListingCount} published
                      {s.rejectedListingCount > 0 && (
                        <span className="text-accent-coral"> · {s.rejectedListingCount} rejected</span>
                      )}
                    </td>
                    <td className="p-3">
                      {s.openCases + s.inProgressCases === 0 ? (
                        <span className="text-text-muted">None</span>
                      ) : (
                        <Badge tone="coral">
                          {s.openCases} open{s.inProgressCases > 0 && ` · ${s.inProgressCases} in progress`}
                        </Badge>
                      )}
                    </td>
                    <td className="p-3 text-text-secondary">
                      {s.resolvedCases + s.dismissedCases === 0
                        ? "—"
                        : `${s.resolvedCases} resolved · ${s.dismissedCases} dismissed`}
                    </td>
                    <td className="p-3 font-mono text-text-secondary">
                      {s.avgResolutionDays !== null ? `${s.avgResolutionDays}d` : "—"}
                    </td>
                    <td className="p-3 text-text-secondary">
                      {s.warningCount + s.fineCount + s.suspensionCount === 0 ? (
                        "—"
                      ) : (
                        <>
                          {s.warningCount > 0 && `${s.warningCount} warning(s)`}
                          {s.fineCount > 0 && `${s.warningCount > 0 ? " · " : ""}${s.fineCount} fine(s)`}
                          {s.suspensionCount > 0 &&
                            `${s.warningCount + s.fineCount > 0 ? " · " : ""}${s.suspensionCount} suspension(s)`}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {scorecards.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-text-muted">
                      No providers with listings in this view.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SearchableSection>
      </div>
    </div>
  );
}
