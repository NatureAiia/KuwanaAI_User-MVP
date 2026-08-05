import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Same role lookup dashboard/corporate/regulator pages already do server-side — shared here for API routes. */
export async function getUserRole(userId: string) {
  const dbUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  return dbUser?.role ?? null;
}

/**
 * Comparisons, saved listings, footprint, gamification, chat — all
 * consumer-only concepts. The dashboard/corporate/regulator *pages* already
 * redirect non-consumer roles away from these, but the underlying API
 * routes had no equivalent check — a corporate/regulator account could hit
 * them directly. `"response" in result` narrows the union in one line at
 * each call site.
 */
export async function requireConsumer(): Promise<
  { user: NonNullable<Awaited<ReturnType<typeof requireUser>>> } | { response: NextResponse }
> {
  const user = await requireUser();
  if (!user) {
    return { response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  }
  const role = await getUserRole(user.id);
  if (role !== "consumer") {
    return {
      response: NextResponse.json({ error: "This feature is for consumer accounts" }, { status: 403 }),
    };
  }
  return { user };
}

/**
 * Notifications now cover two unrelated concepts (a consumer's saved-listing
 * price drops, a provider's listing approval/rejection) that share the same
 * table — so the read/mark-read routes need either role, unlike the
 * consumer-only routes above.
 */
export async function requireConsumerOrProvider(): Promise<
  { user: NonNullable<Awaited<ReturnType<typeof requireUser>>> } | { response: NextResponse }
> {
  const user = await requireUser();
  if (!user) {
    return { response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  }
  const role = await getUserRole(user.id);
  if (role !== "consumer" && role !== "provider") {
    return {
      response: NextResponse.json({ error: "This feature is for consumer or provider accounts" }, { status: 403 }),
    };
  }
  return { user };
}

/**
 * No "admin" role exists in the Role enum yet (consumer/corporate/regulator/
 * provider only — see schema.prisma) — adding one is a real decision (who
 * else can hold it, does it need its own onboarding) that shouldn't be
 * smuggled in via a migration for one review page. This checks against a
 * plain email allowlist instead; swap for a real role once one exists.
 */
export async function requireAdmin() {
  const user = await requireUser();
  if (!user?.email) return null;
  const allowlist = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes(user.email.toLowerCase()) ? user : null;
}
