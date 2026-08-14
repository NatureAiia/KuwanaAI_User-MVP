import { CorporateTag } from "@/components/corporate/CorporateTag";
import { getSlaState, getMsUntil } from "@/lib/corporateRequestSla";

function formatTimeLeft(ms: number): string {
  const totalHours = Math.floor(Math.abs(ms) / (60 * 60 * 1000));
  if (totalHours < 1) return "under 1h";
  if (totalHours < 24) return `${totalHours}h`;
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
}

/** Renders nothing once a request is no longer pending or has no dueAt (pre-SLA-field requests). */
export function SlaBadge({
  dueAt,
  status,
}: {
  dueAt: Date | string | null;
  status: "pending" | "approved" | "rejected";
}) {
  const due = dueAt ? new Date(dueAt) : null;
  const state = getSlaState(due, status);
  if (!state || !due) return null;

  const msLeft = getMsUntil(due);
  if (state === "overdue") {
    return <CorporateTag tone="coral">Overdue by {formatTimeLeft(msLeft)}</CorporateTag>;
  }
  if (state === "due_soon") {
    return <CorporateTag tone="coral">Due in {formatTimeLeft(msLeft)}</CorporateTag>;
  }
  return <CorporateTag tone="neutral">Due in {formatTimeLeft(msLeft)}</CorporateTag>;
}
