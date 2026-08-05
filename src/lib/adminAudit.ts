import { prisma } from "@/lib/prisma";

type AdminAuditAction =
  | "listing_approved"
  | "listing_rejected"
  | "listing_deleted"
  | "provider_linked"
  | "provider_unlinked"
  | "user_role_changed";

/**
 * Records who (an admin email, not a userId — the whole point is a record
 * that survives even if the admin's own account changes) did what to which
 * row. No FK to the target: an audit entry for listing_deleted has to
 * outlive the listing it's about.
 */
export async function logAdminAction(params: {
  adminEmail: string;
  action: AdminAuditAction;
  targetType: "listing" | "provider" | "user";
  targetId: string;
  detail: string;
}): Promise<void> {
  await prisma.adminAuditLog.create({ data: params });
}
