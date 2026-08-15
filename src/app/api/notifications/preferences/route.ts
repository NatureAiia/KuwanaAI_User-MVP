import { privateJson } from "@/lib/apiResponse";
import { requireUser } from "@/lib/auth";
import { getNotificationPreferences, setNotificationPreference } from "@/lib/notificationPreferences";
import type { NotificationType } from "@prisma/client";

const VALID_TYPES: NotificationType[] = [
  "price_drop",
  "listing_approved",
  "listing_rejected",
  "alert_threshold_crossed",
  "business_condition_review_due",
];

// Personal preference, not role-gated — any authenticated user can toggle any
// type; the settings page each role sees only ever renders the types
// relevant to that role's own notifications.
export async function GET(req: Request) {
  const user = await requireUser();
  if (!user) return privateJson({ error: "Not authenticated" }, { status: 401 });

  const requested = new URL(req.url).searchParams.get("types");
  const types = requested
    ? requested.split(",").filter((t): t is NotificationType => VALID_TYPES.includes(t as NotificationType))
    : VALID_TYPES;

  const preferences = await getNotificationPreferences(user.id, types);
  return privateJson({ preferences });
}

export async function PUT(req: Request) {
  const user = await requireUser();
  if (!user) return privateJson({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const type = body?.type as NotificationType | undefined;
  const enabled = body?.enabled;
  if (!type || !VALID_TYPES.includes(type) || typeof enabled !== "boolean") {
    return privateJson({ error: "Expected { type: NotificationType, enabled: boolean }" }, { status: 400 });
  }

  await setNotificationPreference(user.id, type, enabled);
  return privateJson({ ok: true });
}
