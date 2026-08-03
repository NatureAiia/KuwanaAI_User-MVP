import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { syncPriceDropNotifications } from "@/lib/notifications";

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

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
