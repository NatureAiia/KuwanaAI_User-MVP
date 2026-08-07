import { privateJson } from "@/lib/apiResponse";
import { prisma } from "@/lib/prisma";
import { requireConsumerOrProvider } from "@/lib/auth";
import { syncPriceDropNotifications } from "@/lib/notifications";

export async function GET() {
  const auth = await requireConsumerOrProvider();
  if ("response" in auth) return auth.response;
  const { user } = auth;

  // No-ops for a provider account (they have no SavedListing rows) — cheap
  // enough to call unconditionally rather than branching on role.
  await syncPriceDropNotifications(user.id);

  // One notification per saved listing per type, so this inherits the same
  // unbounded growth as /api/saved. The bell shows a count and a recent
  // list; nobody scrolls past 100.
  //
  // unreadCount is counted in the database rather than derived from the page
  // above — deriving it would silently under-report the moment a user has
  // more unread notifications than the page size, which is exactly when the
  // badge matters most.
  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id },
      include: { listing: { include: { provider: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.notification.count({ where: { userId: user.id, read: false } }),
  ]);

  return privateJson({
    notifications: notifications.map((n) => ({
      id: n.id,
      type: n.type,
      message: n.message,
      read: n.read,
      createdAt: n.createdAt,
      listing: { id: n.listing.id, name: n.listing.name, provider: n.listing.provider.name },
    })),
    unreadCount,
  });
}
