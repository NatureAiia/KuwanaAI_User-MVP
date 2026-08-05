import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, Badge } from "@/components/ui/Card";

const ADMIN_LINKS = [
  { href: "/admin/catalog", label: "Catalog", blurb: "Providers and listings across every sector — create, edit, retire." },
  { href: "/admin/users", label: "Users", blurb: "The only way to grant Corporate/Regulator/Provider access." },
  { href: "/admin/social-mentions", label: "Social price mentions", blurb: "Review free-scanner posts that mention a price." },
];

const ROLE_LABELS: Record<string, string> = {
  consumer: "Consumer",
  corporate: "Corporate",
  regulator: "Regulator",
  provider: "Provider",
};

// The four portals this single app serves, in one place — the whole point
// of an admin overview is answering "how is each of the four doing" at a
// glance, not just linking off to separate management screens with no
// numbers attached.
export default async function AdminHubPage() {
  const admin = await requireAdmin();
  if (!admin) notFound();

  const [usersByRole, listingsByStatus, providerCount, linkedProviderCount, pendingReviewCount] = await Promise.all([
    prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
    prisma.listing.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.provider.count(),
    prisma.provider.count({ where: { ownerUserId: { not: null } } }),
    prisma.listing.count({ where: { status: "pending_review" } }),
  ]);

  const roleCounts: Record<string, number> = { consumer: 0, corporate: 0, regulator: 0, provider: 0 };
  for (const row of usersByRole) roleCounts[row.role] = row._count._all;

  const statusCounts: Record<string, number> = { draft: 0, pending_review: 0, published: 0, rejected: 0 };
  for (const row of listingsByStatus) statusCounts[row.status] = row._count._all;

  return (
    <div className="mx-auto max-w-[720px] px-5 py-8 md:px-10">
      <h1 className="font-display text-[24px] font-bold">Admin</h1>
      <p className="mt-1 text-[13px] text-text-secondary">Signed in as {admin.email}</p>

      <section className="mt-6">
        <h2 className="font-display text-[14px] font-semibold text-text-secondary">The four portals</h2>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Object.entries(ROLE_LABELS).map(([role, label]) => (
            <Card key={role}>
              <p className="text-[11px] text-text-muted">{label}</p>
              <p className="mt-1 font-mono text-[22px] font-semibold">{roleCounts[role] ?? 0}</p>
              <p className="text-[10.5px] text-text-muted">account{roleCounts[role] === 1 ? "" : "s"}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="font-display text-[14px] font-semibold text-text-secondary">Catalog</h2>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card>
            <p className="text-[11px] text-text-muted">Published</p>
            <p className="mt-1 font-mono text-[22px] font-semibold text-accent-teal">{statusCounts.published}</p>
          </Card>
          <Card className={pendingReviewCount > 0 ? "border-accent-sky/40" : undefined}>
            <p className="text-[11px] text-text-muted">Needs review</p>
            <p className="mt-1 font-mono text-[22px] font-semibold text-accent-sky">{statusCounts.pending_review}</p>
          </Card>
          <Card>
            <p className="text-[11px] text-text-muted">Draft</p>
            <p className="mt-1 font-mono text-[22px] font-semibold">{statusCounts.draft}</p>
          </Card>
          <Card>
            <p className="text-[11px] text-text-muted">Rejected</p>
            <p className="mt-1 font-mono text-[22px] font-semibold text-accent-coral">{statusCounts.rejected}</p>
          </Card>
        </div>
        <p className="mt-2 text-[12px] text-text-secondary">
          {linkedProviderCount} of {providerCount} provider(s) linked to a self-service account.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="font-display text-[14px] font-semibold text-text-secondary">Manage</h2>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {ADMIN_LINKS.map((link) => (
            <Link key={link.href} href={link.href}>
              <Card className="h-full transition-colors hover:border-accent-sky/50">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-display text-[15px] font-semibold">{link.label}</p>
                  {link.href === "/admin/catalog" && pendingReviewCount > 0 && (
                    <Badge tone="sky">{pendingReviewCount} pending</Badge>
                  )}
                </div>
                <p className="mt-1 text-[12.5px] text-text-secondary">{link.blurb}</p>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
