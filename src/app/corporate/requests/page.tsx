import { FileEdit } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireCorporateProvider } from "@/lib/corporateAuth";
import { Card } from "@/components/ui/Card";
import { CorporateTag } from "@/components/corporate/CorporateTag";
import { NotLinkedCard } from "@/components/corporate/NotLinkedCard";
import { SlaBadge } from "@/components/corporate/SlaBadge";
import { DownloadRequestPdfButton } from "@/components/corporate/DownloadRequestPdfButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateTime } from "@/lib/format";

const STATUS_TONE = {
  pending: "sky",
  approved: "teal",
  rejected: "coral",
} as const;

export default async function CorporateRequestsPage() {
  const result = await requireCorporateProvider();
  if ("notLinked" in result) return <NotLinkedCard />;
  const { provider } = result;

  const requests = await prisma.corporateRequest.findMany({
    where: { providerId: provider.id },
    include: { listing: { select: { name: true, price: true, currency: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1 className="font-display text-[20px] font-bold">Requests</h1>

      <div className="mt-4 grid gap-2.5">
        {requests.map((r) => {
          const proposed = r.proposedData as { name: string; price: number; currency: string };
          return (
            <Card key={r.id} className="!p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[13.5px] font-medium">
                  {r.type === "edit" ? `Edit "${r.listing?.name ?? proposed.name}"` : `New product "${proposed.name}"`}
                </p>
                <div className="flex items-center gap-1.5">
                  <SlaBadge dueAt={r.dueAt} status={r.status} />
                  <CorporateTag tone={STATUS_TONE[r.status]}>{r.status}</CorporateTag>
                </div>
              </div>
              <p className="mt-1.5 text-[12.5px] text-text-secondary">{r.reason}</p>
              {r.status === "rejected" && r.rejectionReason && (
                <p className="mt-1.5 text-[12.5px] text-accent-coral">Reviewer note: {r.rejectionReason}</p>
              )}
              {r.status === "approved" && r.reviewNote && (
                <p className="mt-1.5 text-[12.5px] text-text-secondary">Reviewer note: {r.reviewNote}</p>
              )}
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] text-text-muted">
                  Submitted {formatDateTime(r.createdAt)}
                  {r.reviewedAt && ` · Reviewed ${formatDateTime(r.reviewedAt)}`}
                </p>
                {r.status !== "pending" && (
                  <DownloadRequestPdfButton
                    data={{
                      id: r.id,
                      type: r.type,
                      providerName: provider.name,
                      listingName: r.listing?.name ?? proposed.name,
                      price: proposed.price,
                      currency: proposed.currency,
                      reason: r.reason,
                      status: r.status,
                      reviewedByEmail: r.reviewedByEmail,
                      reviewedAt: r.reviewedAt,
                      reviewNote: r.reviewNote,
                      rejectionReason: r.rejectionReason,
                      createdAt: r.createdAt,
                    }}
                  />
                )}
              </div>
            </Card>
          );
        })}
        {requests.length === 0 && (
          <EmptyState
            icon={FileEdit}
            title="No requests yet"
            description="Edits and new-product submissions you send from My Products show up here, along with their review status."
            action={{ label: "Request a new product", href: "/corporate/products/new" }}
          />
        )}
      </div>
    </div>
  );
}
