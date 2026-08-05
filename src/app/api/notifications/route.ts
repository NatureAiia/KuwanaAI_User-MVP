import { NextResponse } from "next/server";
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

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    include: { listing: { include: { provider: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    notifications: notifications.map((n) => ({
      id: n.id,
      type: n.type,
      message: n.message,
      read: n.read,
      createdAt: n.createdAt,
      listing: { id: n.listing.id, name: n.listing.name, provider: n.listing.provider.name },
    })),
    unreadCount: notifications.filter((n) => !n.read).length,
  });
}
