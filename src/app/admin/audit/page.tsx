import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { Badge } from "@/components/ui/Card";
import { SearchableSection } from "@/components/admin/SearchableSection";

const ACTION_TONE: Record<string, "neutral" | "sky" | "teal" | "coral"> = {
  listing_approved: "teal",
  listing_rejected: "coral",
  listing_deleted: "coral",
  provider_linked: "sky",
  provider_unlinked: "neutral",
  user_role_changed: "sky",
};

export default async function AdminAuditPage() {
  const admin = await requireAdmin();
  if (!admin) notFound();

  const entries = await prisma.adminAuditLog.findMany({ orderBy: { createdAt: "desc" }, take: 200 });

  return (
    <div className="mx-auto max-w-[1080px] px-5 py-8 md:px-10">
      <h1 className="font-display text-[24px] font-bold">Audit log</h1>
      <p className="mt-1 text-[13px] text-text-secondary">
        Every admin approve/reject, provider link/unlink, and role change — most recent first. Tracking started
        2026-08-05; nothing before that was recorded.
      </p>

      <div className="mt-5">
      <SearchableSection placeholder="Search audit log…">
      <div className="flex flex-col gap-2">
        {entries.length === 0 && <p className="text-[13px] text-text-muted">No admin actions recorded yet.</p>}
        {entries.map((entry) => (
          <div
            key={entry.id}
            data-search-row
            className="flex items-start justify-between gap-3 rounded-[var(--radius-card)] border border-border bg-bg-surface p-3"
          >
            <div>
              <div className="flex items-center gap-2">
                <Badge tone={ACTION_TONE[entry.action] ?? "neutral"}>{entry.action.replace(/_/g, " ")}</Badge>
                <span className="text-[11px] text-text-muted">{entry.adminEmail}</span>
              </div>
              <p className="mt-1 text-[13px] text-text-secondary">{entry.detail}</p>
            </div>
            <span className="shrink-0 text-[11px] text-text-muted">
              {entry.createdAt.toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" })}
            </span>
          </div>
        ))}
      </div>
      </SearchableSection>
      </div>
    </div>
  );
}
