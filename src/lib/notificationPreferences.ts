import { prisma } from "@/lib/prisma";
import type { NotificationType } from "@prisma/client";

// "inapp" is the only channel with any delivery infra (see schema.prisma's
// NotificationPreference comment) — every call site here hardcodes it rather
// than threading a channel param through for a choice that doesn't exist yet.
const CHANNEL = "inapp";

/** No row = never toggled = on by default, so a fresh user sees every type enabled. */
export async function isNotificationEnabled(userId: string, type: NotificationType): Promise<boolean> {
  const pref = await prisma.notificationPreference.findUnique({
    where: { userId_type_channel: { userId, type, channel: CHANNEL } },
  });
  return pref?.enabled ?? true;
}

export async function getNotificationPreferences(
  userId: string,
  types: NotificationType[],
): Promise<Record<string, boolean>> {
  const prefs = await prisma.notificationPreference.findMany({
    where: { userId, type: { in: types }, channel: CHANNEL },
  });
  const overrides = new Map(prefs.map((p) => [p.type, p.enabled]));
  return Object.fromEntries(types.map((t) => [t, overrides.get(t) ?? true]));
}

export async function setNotificationPreference(
  userId: string,
  type: NotificationType,
  enabled: boolean,
): Promise<void> {
  await prisma.notificationPreference.upsert({
    where: { userId_type_channel: { userId, type, channel: CHANNEL } },
    update: { enabled },
    create: { userId, type, channel: CHANNEL, enabled },
  });
}
