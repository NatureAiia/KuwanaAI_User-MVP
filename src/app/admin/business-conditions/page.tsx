import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/Card";
import { BusinessConditionForm } from "@/components/admin/BusinessConditionForm";
import { BusinessConditionRowActions } from "@/components/admin/BusinessConditionRowActions";
import { SearchableSection } from "@/components/admin/SearchableSection";
import { SECTORS, type SectorSlug } from "@/lib/sectors";
import { RISK_LEVEL_TONE } from "@/lib/tone";

const CATEGORY_LABEL = { regulatory: "Regulatory", competitor: "Competitor", macro: "Macro" } as const;

export default async function AdminBusinessConditionsPage() {
  const admin = await requireAdmin();
  if (!admin) notFound();

  const conditions = await prisma.businessCondition.findMany({
    include: { assignedTo: { select: { email: true } } },
    orderBy: [{ riskLevel: "desc" }, { createdAt: "desc" }],
  });

  return (
    <div className="mx-auto max-w-[1100px] px-5 py-8 md:px-10">
      <h1 className="font-display text-[24px] font-bold">Business conditions</h1>
      <p className="mt-1 text-[13px] text-text-secondary">
        {conditions.length} condition(s) tracked. Surfaced read-only on the regulator and corporate
        dashboards — this is the only place they&apos;re managed.
      </p>

      <div className="mt-6">
        <BusinessConditionForm />
      </div>

      <div className="mt-6">
        <SearchableSection placeholder="Search conditions…">
          <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border">
            <table className="w-full min-w-[760px] border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-border bg-bg-surface-raised text-left">
                  <th className="p-3 font-medium text-text-muted">Title</th>
                  <th className="p-3 font-medium text-text-muted">Category</th>
                  <th className="p-3 font-medium text-text-muted">Sector</th>
                  <th className="p-3 font-medium text-text-muted">Review cycle</th>
                  <th className="p-3 font-medium text-text-muted">Assigned to</th>
                  <th className="p-3 font-medium text-text-muted">Risk</th>
                  <th className="p-3 font-medium text-text-muted">Actions</th>
                </tr>
              </thead>
              <tbody>
                {conditions.map((c) => (
                  <tr key={c.id} data-search-row className="border-b border-border last:border-0">
                    <td className="p-3">
                      <p className="font-medium">{c.title}</p>
                      {c.notes && <p className="mt-0.5 max-w-[320px] truncate text-[11.5px] text-text-muted">{c.notes}</p>}
                    </td>
                    <td className="p-3 text-text-secondary">
                      <Badge tone="neutral">{CATEGORY_LABEL[c.category]}</Badge>
                    </td>
                    <td className="p-3 text-text-secondary">
                      {c.sectorSlug ? (SECTORS[c.sectorSlug as SectorSlug]?.name ?? c.sectorSlug) : "All sectors"}
                    </td>
                    <td className="p-3 text-text-secondary">{c.reviewCycleDays ? `${c.reviewCycleDays}d` : "—"}</td>
                    <td className="p-3 text-text-secondary">{c.assignedTo?.email ?? "Unassigned"}</td>
                    <td className="p-3">
                      <Badge tone={RISK_LEVEL_TONE[c.riskLevel]}>{c.riskLevel}</Badge>
                    </td>
                    <td className="p-3">
                      <BusinessConditionRowActions
                        id={c.id}
                        riskLevel={c.riskLevel}
                        assignedToCurrentAdmin={c.assignedToUserId === admin.id}
                      />
                    </td>
                  </tr>
                ))}
                {conditions.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-text-muted">
                      Nothing tracked yet.
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
