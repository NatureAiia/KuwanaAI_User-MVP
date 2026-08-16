import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { syncPriceDropNotifications } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { BottomTabBar } from "@/components/BottomTabBar";
import { Header } from "@/components/Header";
import { NotificationsList } from "@/components/NotificationsList";
import { BackButton } from "@/components/ui/BackButton";

export default async function NotificationsPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  await syncPriceDropNotifications(user.id);

  // Consumer notifications (price_drop, listing_approved, listing_rejected)
  // always carry a listing — the listing-less types (alert_threshold_crossed,
  // business_condition_review_due) only ever get written for corporate/admin
  // users — so this filter also protects the non-null listing access below.
  const notifications = await prisma.notification.findMany({
    where: { userId: user.id, listingId: { not: null } },
    include: { listing: { include: { provider: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div id="main-content" tabIndex={-1} className="flex flex-1 flex-col px-5 pb-24 pt-6 md:px-10">
      <Header />
      <div className="mt-4 flex items-center gap-2">
        <BackButton />
        <h1 className="font-display text-[22px] font-bold">Notifications</h1>
      </div>
      <NotificationsList
        notifications={notifications.map((n) => ({
          id: n.id,
          // Cast is safe here for the same reason as the listing assertion
          // below: the query only ever returns the three listing-backed
          // types, but Prisma's type is the full (now 5-member) enum.
          type: n.type as "price_drop" | "listing_approved" | "listing_rejected",
          message: n.message,
          read: n.read,
          createdAt: n.createdAt.toISOString(),
          // Non-null assertion is safe here: the `listingId: { not: null }`
          // filter above guarantees it at runtime, Prisma's types just can't
          // express that narrowing.
          listing: { id: n.listing!.id, name: n.listing!.name, provider: n.listing!.provider.name },
        }))}
      />
      <BottomTabBar />
    </div>
  );
}
