import { NextResponse } from "next/server";
import { auth } from "@/lib/nextAuth";
import { prisma } from "@/lib/prisma";
import { privateJson } from "@/lib/apiResponse";

/**
 * The single choke point almost every page/API route calls through (directly
 * or via requireConsumer/requireAdmin/etc. below) — so gating a suspended
 * account here (see AccountStatus on User) blocks it everywhere at once,
 * rather than needing every call site updated individually. A suspended
 * account is treated exactly like "not signed in": callers already handle
 * null by redirecting to /login or returning 401, which is accurate enough
 * (they can't do anything either way) even though the underlying reason
 * differs — see api/auth/account-status/route.ts for the one place that
 * needs to tell the two apart, to show login a clear message instead of a
 * silent redirect loop.
 *
 * Unverified email is gated here for the same reason, and it matters that it
 * is here rather than at the routes: eleven routes call requireUser()
 * directly with no role check on top, and one of them is wallet top-up. A
 * per-route check would have had to be right eleven times.
 */
export async function requireUser(opts?: { allowUnverifiedEmail?: boolean }) {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || !user.email) return null;

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { accountStatus: true, emailVerifiedAt: true },
  });
  if (dbUser?.accountStatus === "suspended") return null;

  // `/api/auth/register` creates the row up front, before onboarding ever
  // runs, so a mid-signup account has a real row with emailVerifiedAt still
  // null. Only the onboarding route itself — which does its own explicit
  // verification check against the emailed code — passes
  // allowUnverifiedEmail; every other caller is refused here.
  if (!opts?.allowUnverifiedEmail && dbUser && !dbUser.emailVerifiedAt) return null;

  return { id: user.id, email: user.email };
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
 * role: admin (see scripts/migrate-admin-role.ts). Drop this once every
 * operator account has been migrated. Exported (not just used by
 * requireAdmin) so any other admin-detection call site — e.g.
 * api/notifications/route.ts, which reads the role directly instead of going
 * through requireAdmin() — stays allowlist-aware too, instead of disagreeing
 * with requireAdmin() about who counts as admin.
 */
/**
 * The raw allowlist, lowercased — exported so callers that need every admin
 * address (rather than a single yes/no check) can reuse the same parsing
 * instead of re-reading `process.env.ADMIN_EMAILS` themselves. See
 * notifyAdminNewApplication in src/lib/notifications.ts, which needs the
 * whole list to find every admin User row to notify.
 */
export function adminEmailAllowlist(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowlistedAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmailAllowlist().includes(email.toLowerCase());
}

export async function requireAdmin(): Promise<
  (NonNullable<Awaited<ReturnType<typeof requireUser>>> & { email: string }) | null
> {
  const user = await requireUser();
  if (!user?.email) return null;
  const isAllowlisted = isAllowlistedAdmin(user.email);
  const isAdminRole = !isAllowlisted && (await getUserRole(user.id)) === "admin";
  // The `!user?.email` check above already guarantees email is a string —
  // this cast just reflects that in the type once, instead of every call
  // site that reads admin.email needing its own non-null assertion.
  return isAllowlisted || isAdminRole ? (user as typeof user & { email: string }) : null;
}
