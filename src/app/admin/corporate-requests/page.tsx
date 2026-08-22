import { notFound } from "next/navigation";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/Card";
import { CorporateRequestReview } from "@/components/admin/CorporateRequestReview";
import { CorporateStatCard } from "@/components/corporate/CorporateStatCard";
import { SearchableSection } from "@/components/admin/SearchableSection";

export default async function AdminCorporateRequestsPage() {
  const admin = await requireAdmin();
  if (!admin) notFound();

  const [pendingRequests, confirmedRequests, statusCounts] = await Promise.all([
    prisma.corporateRequest.findMany({
      where: { status: "pending" },
      include: {
        provider: { select: { name: true } },
        listing: { select: { id: true, name: true, price: true, currency: true } },
        category: { select: { name: true, sector: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    // "Confirmed pricing records" — approved requests, the finalized decisions
    // that already landed on the live catalog. No separate model: this is
    // just the same table filtered to status: approved.
    prisma.corporateRequest.findMany({
      where: { status: "approved" },
      include: { provider: { select: { name: true } }, listing: { select: { name: true } } },
      orderBy: { reviewedAt: "desc" },
      take: 20,
    }),
    prisma.corporateRequest.groupBy({ by: ["status"], _count: true }),
  ]);

  const countByStatus = Object.fromEntries(statusCounts.map((s) => [s.status, s._count])) as Record<
    "pending" | "approved" | "rejected",
    number
  >;
  const totalReviewed = (countByStatus.approved ?? 0) + (countByStatus.rejected ?? 0);
  const approvalRate = totalReviewed > 0 ? Math.round(((countByStatus.approved ?? 0) / totalReviewed) * 100) : null;

  return (
    <div className="mx-auto max-w-[1100px] px-5 py-8 md:px-10">
      <h1 className="font-display text-[24px] font-bold">Corporate requests</h1>
      <p className="mt-1 text-[13px] text-text-secondary">
        Price/product changes submitted by corporate accounts (banks, telcos, insurers, etc. via
        /corporate/products) — nothing here reaches the catalog until it&apos;s approved below.
      </p>

      <div className="mt-5 grid gap-2.5 sm:grid-cols-3">
        <CorporateStatCard icon={Clock} tone="sky" label="Pending review">
          <p className="font-mono text-[20px] font-semibold">{countByStatus.pending ?? 0}</p>
        </CorporateStatCard>
        <CorporateStatCard icon={CheckCircle2} tone="teal" label="Approved (all time)">
          <p className="font-mono text-[20px] font-semibold">{countByStatus.approved ?? 0}</p>
        </CorporateStatCard>
        <CorporateStatCard icon={XCircle} tone="coral" label="Approval rate">
          <p className="font-mono text-[20px] font-semibold">{approvalRate === null ? "—" : `${approvalRate}%`}</p>
          <p className="text-[11px] text-text-muted">{totalReviewed} reviewed</p>
        </CorporateStatCard>
      </div>

      <section className="mt-6">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-[16px] font-semibold">Review queue</h2>
          {pendingRequests.length > 0 && <Badge tone="sky">{pendingRequests.length} pending</Badge>}
        </div>
        <div className="mt-3">
        <SearchableSection placeholder="Search requests…">
        <div className="space-y-3">
          {pendingRequests.map((r) => (
            <div key={r.id} data-search-row>
              <CorporateRequestReview
                request={{
                  id: r.id,
                  type: r.type,
                  reason: r.reason,
                  provider: r.provider,
                  proposedData: r.proposedData as
                    | { name: string; description?: string | null; price: number; currency: string }
                    | {
                        key: string;
                        label: string;
                        consumerLabel?: string | null;
                        dataType: string;
                        unit?: string | null;
                        qualityAxis?: string | null;
                        sampleValue?: unknown;
                      },
                  listing: r.listing,
                  category: r.category,
                  dueAt: r.dueAt,
                  regulatorDecision: r.regulatorDecision,
                  regulatorReviewedByEmail: r.regulatorReviewedByEmail,
                  regulatorNote: r.regulatorNote,
                  changePercent: r.changePercent,
                  riskLevel: r.riskLevel,
                }}
              />
            </div>
          ))}
          {pendingRequests.length === 0 && (
            <p className="text-[13px] text-text-muted">Nothing pending right now.</p>
          )}
        </div>
        </SearchableSection>
        </div>
      </section>

      {confirmedRequests.length > 0 && (
        <section className="mt-6">
          <h2 className="font-display text-[16px] font-semibold">Confirmed pricing records</h2>
          <p className="mt-1 text-[12.5px] text-text-secondary">The most recently approved changes, already live on the catalog.</p>
          <div className="mt-3 overflow-hidden rounded-[var(--radius-card)] border border-border">
            {confirmedRequests.map((r, i) => {
              const proposed = r.proposedData as { name: string; price: number; currency: string };
              return (
                <div key={r.id} className={`flex flex-wrap items-center justify-between gap-2 bg-bg-surface p-3.5 ${i > 0 ? "border-t border-border" : ""}`}>
                  <div>
                    <p className="text-[13px] font-medium">{r.listing?.name ?? proposed.name}</p>
                    <p className="text-[11px] text-text-muted">{r.provider.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-[13px]">
                      {proposed.currency} {Number(proposed.price).toFixed(2)}
                    </p>
                    <p className="text-[11px] text-text-muted">
                      {r.reviewedAt?.toISOString().slice(0, 10)} · {r.reviewedByEmail}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
