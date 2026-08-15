import Link from "next/link";
import { requireCorporateProvider } from "@/lib/corporateAuth";
import { getAlertRulesWithStatus, syncAlertRuleNotifications } from "@/lib/alerts";
import { prisma } from "@/lib/prisma";
import { NotLinkedCard } from "@/components/corporate/NotLinkedCard";
import { NotificationInbox } from "@/components/NotificationInbox";
import { NotificationPreferenceToggle } from "@/components/NotificationPreferenceToggle";

export default async function CorporateNotificationsPage() {
  const result = await requireCorporateProvider();
  if ("notLinked" in result) return <NotLinkedCard />;
  const { user, provider } = result;

  const rules = await getAlertRulesWithStatus(provider.id);
  await syncAlertRuleNotifications(rules);

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id, type: "alert_threshold_crossed" },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1 className="font-display text-[20px] font-bold">Notifications</h1>
      <p className="mt-1 text-[13px] text-text-secondary">
        Triggered alert rules from <Link href="/corporate/alerts" className="underline">Alerts</Link> land here.
      </p>

      <div className="mt-4">
        <NotificationPreferenceToggle
          type="alert_threshold_crossed"
          label="Alert threshold crossed"
          description="Notify me here when one of my alert rules is triggered."
        />
      </div>

      <NotificationInbox
        notifications={notifications.map((n) => ({
          id: n.id,
          message: n.message,
          read: n.read,
          createdAt: n.createdAt.toISOString(),
        }))}
        emptyMessage="No alerts triggered yet."
      />
    </div>
  );
}
