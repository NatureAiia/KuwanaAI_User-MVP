import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminFooter } from "@/components/admin/AdminFooter";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  if (!admin) notFound();

  const [dbUser, pendingReviewCount, pendingScrapedCount, pendingCorporateRequestCount] = await Promise.all([
    prisma.user.findUnique({ where: { id: admin.id }, select: { username: true } }),
    prisma.listing.count({ where: { status: "pending_review" } }),
    prisma.scrapedItem.count({ where: { status: "pending" } }),
    prisma.corporateRequest.count({ where: { status: "pending" } }),
  ]);

  // Falls back to the allowlist path (see requireAdmin) where an operator's
  // email grants access before their User row exists at all.
  const username = dbUser?.username ?? admin.email;

  const pendingCounts: Record<string, number> = {
    "/admin/catalog": pendingReviewCount,
    "/admin/scraper": pendingScrapedCount,
    "/admin/corporate-requests": pendingCorporateRequestCount,
  };

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <AdminSidebar username={username} pendingCounts={pendingCounts} />
      <div className="flex min-h-screen flex-1 flex-col">
        <AdminHeader />
        <div className="flex-1">{children}</div>
        <AdminFooter />
      </div>
    </div>
  );
}
