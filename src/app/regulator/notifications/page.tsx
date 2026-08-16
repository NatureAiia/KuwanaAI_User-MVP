import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRegulatorUser } from "@/lib/regulatorAuth";
import { getPriceCapRulesWithBreaches, syncPriceCapNotifications } from "@/lib/priceCapAlerts";
import { NotificationInbox } from "@/components/NotificationInbox";
import { NotificationPreferenceToggle } from "@/components/NotificationPreferenceToggle";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function RegulatorNotificationsPage() {
  const user = await requireRegulatorUser();

  const rules = await getPriceCapRulesWithBreaches();
  await syncPriceCapNotifications(rules);

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id, type: "price_cap_breached" },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1 className="font-display text-[20px] font-bold">Notifications</h1>
      <p className="mt-1 text-[13px] text-text-secondary">
        Breached price caps from <Link href="/regulator/alerts" className="underline">Price Caps</Link> land here.
      </p>

      <div className="mt-4">
        <NotificationPreferenceToggle
          type="price_cap_breached"
          label="Price cap breached"
          description="Notify me here when a published listing crosses one of my price caps."
        />
      </div>

      <NotificationInbox
        notifications={notifications.map((n) => ({
          id: n.id,
          message: n.message,
          read: n.read,
          createdAt: n.createdAt.toISOString(),
        }))}
        emptyMessage={
          <EmptyState
            variant="inline"
            title="No price cap breaches"
            description="You'll be notified here when a published listing crosses one of your price caps."
          />
        }
      />
    </div>
  );
}
