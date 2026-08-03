import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { syncPriceDropNotifications } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { BottomTabBar } from "@/components/BottomTabBar";
import { Header } from "@/components/Header";
import { NotificationsList } from "@/components/NotificationsList";

export default async function NotificationsPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  await syncPriceDropNotifications(user.id);

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    include: { listing: { include: { provider: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-1 flex-col px-5 pb-24 pt-6 md:px-10">
      <Header />
      <h1 className="mt-4 font-display text-[22px] font-bold">Notifications</h1>
      <NotificationsList
        notifications={notifications.map((n) => ({
          id: n.id,
          message: n.message,
          read: n.read,
          createdAt: n.createdAt.toISOString(),
          listing: { id: n.listing.id, name: n.listing.name, provider: n.listing.provider.name },
        }))}
      />
      <BottomTabBar />
    </div>
  );
}
