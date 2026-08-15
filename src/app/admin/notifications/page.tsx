import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NotificationInbox } from "@/components/NotificationInbox";
import { NotificationPreferenceToggle } from "@/components/NotificationPreferenceToggle";

export default async function AdminNotificationsPage() {
  const admin = await requireAdmin();
  if (!admin) notFound();

  // admin/layout.tsx already ran syncBusinessConditionReviewNotifications for
  // this admin on this request, so this just reads what it wrote.
  const notifications = await prisma.notification.findMany({
    where: { userId: admin.id, type: "business_condition_review_due" },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-[760px] px-5 py-8 md:px-10">
      <h1 className="font-display text-[24px] font-bold">Notifications</h1>
      <p className="mt-1 text-[13px] text-text-secondary">
        Business conditions assigned to you (see{" "}
        <Link href="/admin/business-conditions" className="underline">
          Business conditions
        </Link>
        ) surface here once their review cycle elapses.
      </p>

      <div className="mt-4">
        <NotificationPreferenceToggle
          type="business_condition_review_due"
          label="Business condition review due"
          description="Notify me here when a condition assigned to me is due for review."
        />
      </div>

      <NotificationInbox
        notifications={notifications.map((n) => ({
          id: n.id,
          message: n.message,
          read: n.read,
          createdAt: n.createdAt.toISOString(),
        }))}
        emptyMessage="Nothing due for review right now."
      />
    </div>
  );
}
