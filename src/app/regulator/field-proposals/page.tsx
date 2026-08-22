import { requireRegulatorUser } from "@/lib/regulatorAuth";
import { prisma } from "@/lib/prisma";
import { Card, Badge } from "@/components/ui/Card";
import { FieldProposalRowActions } from "@/components/regulator/FieldProposalRowActions";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateTime } from "@/lib/format";

type ProposedField = {
  key: string;
  label: string;
  consumerLabel?: string | null;
  dataType: string;
  unit?: string | null;
  qualityAxis?: string | null;
  sampleValue?: unknown;
};

const RISK_TONE = { low: "neutral", medium: "sky", high: "coral" } as const;

/**
 * The regulator sign-off queue for corporate `new_field` proposals — sits
 * between a corporate account submitting one (see /corporate/products'
 * "Add field" flow) and admin's final approval (/admin/corporate-requests,
 * gated on this decision). Mirrors /regulator/investigations' shape: any
 * regulator account can act on any pending proposal, market-wide.
 */
export default async function RegulatorFieldProposalsPage() {
  await requireRegulatorUser();

  const proposals = await prisma.corporateRequest.findMany({
    where: { type: "new_field", regulatorDecision: "pending" },
    include: { provider: { select: { name: true } }, category: { select: { name: true, sector: { select: { name: true } } } } },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  const reviewed = await prisma.corporateRequest.findMany({
    where: { type: "new_field", regulatorDecision: { in: ["approved", "rejected", "flagged"] } },
    include: { provider: { select: { name: true } }, category: { select: { name: true, sector: { select: { name: true } } } } },
    orderBy: { regulatorReviewedAt: "desc" },
    take: 20,
  });

  return (
    <div>
      <h1 className="font-display text-[20px] font-bold">Field proposals</h1>
      <p className="mt-1 text-[13px] text-text-secondary">
        Corporate accounts proposing a new comparison field for their sector — sign off here before it reaches admin
        for final approval. Nothing here is visible to consumers until admin explicitly marks it comparable.
      </p>

      <section className="mt-6">
        <h2 className="text-[12px] font-semibold uppercase tracking-wide text-text-muted">
          Pending ({proposals.length})
        </h2>
        <div className="mt-2 flex flex-col gap-2">
          {proposals.map((p) => {
            const field = p.proposedData as ProposedField;
            return (
              <Card key={p.id} className="flex flex-wrap items-start justify-between gap-3 !p-3.5">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[13.5px] font-medium">
                      {field.label}
                      {field.consumerLabel && ` / ${field.consumerLabel}`}
                    </p>
                    {p.riskLevel && <Badge tone={RISK_TONE[p.riskLevel]}>{p.riskLevel} risk</Badge>}
                  </div>
                  <p className="mt-1 text-[12px] text-text-secondary">
                    {p.provider.name} · {p.category ? `${p.category.sector.name} / ${p.category.name}` : "—"} ·{" "}
                    <span className="font-mono">{field.key}</span> ({field.dataType}
                    {field.unit ? `, ${field.unit}` : ""})
                    {field.qualityAxis && ` · feeds ${field.qualityAxis} axis`}
                  </p>
                  <p className="mt-1 text-[12px] text-text-secondary">{p.reason}</p>
                  <p className="mt-1.5 text-[11px] text-text-muted">Submitted {formatDateTime(p.createdAt)}</p>
                </div>
                <FieldProposalRowActions id={p.id} />
              </Card>
            );
          })}
          {proposals.length === 0 && (
            <EmptyState title="Nothing pending" description="No field proposals are waiting on regulator review." />
          )}
        </div>
      </section>

      {reviewed.length > 0 && (
        <section className="mt-6">
          <h2 className="text-[12px] font-semibold uppercase tracking-wide text-text-muted">Recently reviewed</h2>
          <div className="mt-2 flex flex-col gap-2">
            {reviewed.map((p) => {
              const field = p.proposedData as ProposedField;
              return (
                <Card key={p.id} className="flex flex-wrap items-center justify-between gap-3 !p-3.5">
                  <div>
                    <p className="text-[13px] font-medium">
                      {field.label} — {p.provider.name}
                    </p>
                    {p.regulatorNote && <p className="mt-0.5 text-[12px] text-text-secondary">{p.regulatorNote}</p>}
                  </div>
                  <Badge
                    tone={p.regulatorDecision === "approved" ? "teal" : p.regulatorDecision === "flagged" ? "sky" : "coral"}
                  >
                    {p.regulatorDecision}
                  </Badge>
                </Card>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
