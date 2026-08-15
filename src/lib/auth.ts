import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { privateJson } from "@/lib/apiResponse";

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
 * Comparisons, saved listings, footprint, gamification — all consumer-only
 * concepts. The dashboard/corporate/regulator *pages* already redirect
 * non-consumer roles away from these, but the underlying API routes had no
 * equivalent check — a corporate/regulator account could hit them directly.
 * `"response" in result` narrows the union in one line at each call site.
 */
export async function requireConsumer(): Promise<
  { user: NonNullable<Awaited<ReturnType<typeof requireUser>>> } | { response: NextResponse }
> {
  // privateJson, not NextResponse.json: an auth denial is per-caller and
  // must never be stored by a shared cache. Without it, a CDN could serve
  // one user's 401 to another request — or, worse, cache the 401 and keep
  // serving it after the user signs in.
  const user = await requireUser();
  if (!user) {
    return { response: privateJson({ error: "Not authenticated" }, { status: 401 }) };
  }
  const role = await getUserRole(user.id);
  if (role !== "consumer") {
    return {
      response: privateJson({ error: "This feature is for consumer accounts" }, { status: 403 }),
    };
  }
  return { user };
}

/**
 * Chat is available to both consumer accounts (grounded in their own saved
 * listings/wallet) and corporate accounts (grounded in their own provider's
 * listings/alerts/investigations) — see api/chat/route.ts, which branches
 * grounding on the returned role.
 */
export async function requireConsumerOrCorporate(): Promise<
  | { user: NonNullable<Awaited<ReturnType<typeof requireUser>>>; role: "consumer" | "corporate" }
  | { response: NextResponse }
> {
  const user = await requireUser();
  if (!user) {
    return { response: privateJson({ error: "Not authenticated" }, { status: 401 }) };
  }
  const role = await getUserRole(user.id);
  if (role !== "consumer" && role !== "corporate") {
    return {
      response: privateJson({ error: "This feature is for consumer or corporate accounts" }, { status: 403 }),
    };
  }
  return { user, role };
}

/**
 * `admin` is now a real Role (see schema.prisma), but the original
 * ADMIN_EMAILS allowlist stays as a fallback during the transition — any
 * email in it is treated as admin even before its User row is migrated to
 * role: admin (see scripts/migrate-admin-role.ts). Drop the allowlist check
 * once every operator account has been migrated.
 */
export async function requireAdmin(): Promise<
  (NonNullable<Awaited<ReturnType<typeof requireUser>>> & { email: string }) | null
> {
  const user = await requireUser();
  if (!user?.email) return null;
  const allowlist = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const isAllowlisted = allowlist.includes(user.email.toLowerCase());
  const isAdminRole = !isAllowlisted && (await getUserRole(user.id)) === "admin";
  // The `!user?.email` check above already guarantees email is a string —
  // this cast just reflects that in the type once, instead of every call
  // site that reads admin.email needing its own non-null assertion.
  return isAllowlisted || isAdminRole ? (user as typeof user & { email: string }) : null;
}
