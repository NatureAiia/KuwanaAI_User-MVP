import { requireRegulatorUser } from "@/lib/regulatorAuth";
import { getComplaintQueue } from "@/lib/complaints";
import { Card, Badge } from "@/components/ui/Card";
import { ComplaintRowActions } from "@/components/regulator/ComplaintRowActions";
import { formatDateTime } from "@/lib/format";

const STATUS_TONE = { open: "coral", reviewing: "sky", resolved: "teal", dismissed: "neutral" } as const;
const STATUS_LABEL = { open: "Open", reviewing: "Reviewing", resolved: "Resolved", dismissed: "Dismissed" } as const;

export default async function RegulatorComplaintsPage() {
  await requireRegulatorUser();

  const complaints = await getComplaintQueue();

  return (
    <div>
      <h1 className="font-display text-[20px] font-bold">Consumer complaints</h1>
      <p className="mt-1 text-[13px] text-text-secondary">
        Price/service issues reported directly by consumers — promote a listing-tied complaint into an enforcement
        case when it&apos;s worth investigating.
      </p>

      <div className="mt-6 flex flex-col gap-2">
        {complaints.map((c) => (
          <Card key={c.id} className="flex flex-wrap items-start justify-between gap-3 !p-3.5">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-[13.5px] font-medium">
                  {c.listingName ? `${c.listingName} (${c.providerName})` : "General complaint"}
                </p>
                <Badge tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Badge>
              </div>
              <p className="mt-1 text-[12px] text-text-secondary">{c.description}</p>
              <p className="mt-1.5 text-[11px] text-text-muted">
                {c.submitterEmail} · {formatDateTime(c.createdAt)}
              </p>
            </div>
            <ComplaintRowActions
              id={c.id}
              status={c.status}
              listingId={c.listingId}
              linkedInvestigationId={c.linkedInvestigationId}
            />
          </Card>
        ))}
        {complaints.length === 0 && <p className="text-[13px] text-text-muted">No complaints reported yet.</p>}
      </div>
    </div>
  );
}
