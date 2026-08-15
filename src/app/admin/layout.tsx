import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncBusinessConditionReviewNotifications, getReviewDueCount } from "@/lib/businessConditions";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminFooter } from "@/components/admin/AdminFooter";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  if (!admin) notFound();

  await syncBusinessConditionReviewNotifications(admin.id);

  const [pendingReviewCount, pendingScrapedCount, pendingCorporateRequestCount, unreviewedMentionCount, reviewDueCount] =
    await Promise.all([
      prisma.listing.count({ where: { status: "pending_review" } }),
      prisma.scrapedItem.count({ where: { status: "pending" } }),
      prisma.corporateRequest.count({ where: { status: "pending" } }),
      prisma.socialPriceMention.count({ where: { reviewed: false } }),
      getReviewDueCount(admin.id),
    ]);

  const username = admin.email;

  const pendingCounts: Record<string, number> = {
    "/admin/catalog": pendingReviewCount,
    "/admin/scraper": pendingScrapedCount,
    "/admin/corporate-requests": pendingCorporateRequestCount,
    "/admin/social-mentions": unreviewedMentionCount,
    "/admin/business-conditions": reviewDueCount,
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
