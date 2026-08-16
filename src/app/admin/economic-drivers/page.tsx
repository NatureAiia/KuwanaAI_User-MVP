import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EconomicDriverForm } from "@/components/admin/EconomicDriverForm";
import { EconomicDriverRowActions } from "@/components/admin/EconomicDriverRowActions";
import { SearchableSection } from "@/components/admin/SearchableSection";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function AdminEconomicDriversPage() {
  const admin = await requireAdmin();
  if (!admin) notFound();

  const economicDrivers = await prisma.economicDriver.findMany({
    orderBy: [{ name: "asc" }, { period: "desc" }],
  });

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-8 md:px-10">
      <h1 className="font-display text-[24px] font-bold">Economic drivers</h1>
      <p className="mt-1 text-[13px] text-text-secondary">
        {economicDrivers.length} reading(s). Surfaced as read-only pricing context on the corporate and regulator
        dashboards — never used to convert or adjust a listing&apos;s price.
      </p>

      <div className="mt-6">
        <EconomicDriverForm />
      </div>

      <div className="mt-6">
        <SearchableSection placeholder="Search economic drivers…">
          <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border">
            <table className="w-full min-w-[720px] border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-border bg-bg-surface-raised text-left">
                  <th className="p-3 font-medium text-text-muted">Name</th>
                  <th className="p-3 font-medium text-text-muted">Region</th>
                  <th className="p-3 font-medium text-text-muted">Period</th>
                  <th className="p-3 font-medium text-text-muted">Value</th>
                  <th className="p-3 font-medium text-text-muted">Previous</th>
                  <th className="p-3 font-medium text-text-muted">Currency</th>
                  <th className="p-3 font-medium text-text-muted">Actions</th>
                </tr>
              </thead>
              <tbody>
                {economicDrivers.map((row) => (
                  <tr key={row.id} data-search-row className="border-b border-border last:border-0">
                    <td className="p-3 font-medium">{row.name}</td>
                    <td className="p-3 text-text-secondary">{row.region}</td>
                    <td className="p-3 text-text-secondary">
                      {row.period.toLocaleDateString("en-ZA", { dateStyle: "medium" })}
                    </td>
                    <td className="p-3 font-mono">{Number(row.value)}</td>
                    <td className="p-3 font-mono text-text-secondary">
                      {row.previousValue !== null ? Number(row.previousValue) : "—"}
                    </td>
                    <td className="p-3 text-text-secondary">{row.currencyCode ?? "—"}</td>
                    <td className="p-3">
                      <EconomicDriverRowActions economicDriverId={row.id} />
                    </td>
                  </tr>
                ))}
                {economicDrivers.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-6">
                      <EmptyState
                        variant="inline"
                        title="No economic driver readings yet."
                        description="Add one using the form above to surface it as pricing context on the corporate and regulator dashboards."
                      />
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
