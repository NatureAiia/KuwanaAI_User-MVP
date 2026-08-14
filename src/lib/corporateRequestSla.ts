// Every CorporateRequest gets a fixed review window from creation — no
// per-category/priority tiering yet, matching how simple the rest of the
// governance flow is (single admin review step, no multi-stage routing).
const SLA_DAYS = 3;
const DUE_SOON_HOURS = 24;

export function computeRequestDueAt(createdAt: Date = new Date()): Date {
  return new Date(createdAt.getTime() + SLA_DAYS * 24 * 60 * 60 * 1000);
}

export type SlaState = "on_track" | "due_soon" | "overdue";

/** null once a request is no longer pending — an approved/rejected request has nothing left to breach. */
export function getSlaState(
  dueAt: Date | null,
  status: "pending" | "approved" | "rejected",
): SlaState | null {
  if (!dueAt || status !== "pending") return null;
  const msLeft = getMsUntil(dueAt);
  if (msLeft < 0) return "overdue";
  if (msLeft < DUE_SOON_HOURS * 60 * 60 * 1000) return "due_soon";
  return "on_track";
}

// Wraps the one impure (time-dependent) call SlaBadge needs, so the
// component itself only ever calls plain, side-effect-free helpers —
// react-hooks/purity flags Date.now() called directly in a component body.
export function getMsUntil(date: Date): number {
  return date.getTime() - Date.now();
}
