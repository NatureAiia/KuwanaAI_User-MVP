import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { privateJson } from "@/lib/apiResponse";
import { emailDomain } from "@/lib/orgVerification";
import type { Provider } from "@prisma/client";

/**
 * A "corporate" role account never owns a Provider one-to-one the way
 * "provider" accounts do (Provider.ownerUserId, requireOwnProvider()) — a
 * corporate account is a formal business with many employee logins sharing
 * one company (e.g. every @cbz.co.zw address). The link is resolved by email
 * domain against Provider.corporateDomain instead, set once by an admin —
 * the same domain-match pattern orgVerification.ts already uses for
 * REGULATORS, applied here as live data instead of a hardcoded list.
 */
export async function requireOwnCorporateOrg(): Promise<
  | { user: NonNullable<Awaited<ReturnType<typeof requireUser>>>; provider: { id: string; name: string } }
  | { response: NextResponse }
> {
  const user = await requireUser();
  if (!user) {
    return { response: privateJson({ error: "Not authenticated" }, { status: 401 }) };
  }

  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { role: true } });
  if (dbUser?.role !== "corporate") {
    return {
      response: privateJson({ error: "This feature is for corporate accounts" }, { status: 403 }),
    };
  }

  const domain = user.email ? emailDomain(user.email) : null;
  const provider = domain
    ? await prisma.provider.findFirst({ where: { corporateDomain: domain }, select: { id: true, name: true } })
    : null;
  if (!provider) {
    return {
      response: privateJson(
        { error: "Your company isn't linked to a product catalog yet — ask an admin to link it." },
        { status: 404 },
      ),
    };
  }

  return { user, provider };
}

/**
 * Auth+role check shared by every corporate page — redirects (rather than
 * returning a JSON response) on failure, since pages can't return a
 * NextResponse the way API routes do.
 */
export async function requireCorporateUser() {
  const user = await requireUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { role: true } });
  if (dbUser?.role !== "corporate") redirect("/dashboard");

  return user;
}

/**
 * Page-component counterpart to requireOwnCorporateOrg() above — same
 * user/role/domain resolution, but redirects on auth/role failure instead of
 * returning a JSON response. An unlinked account isn't an error case for a
 * page the way it is for an API route, so that case comes back as
 * `{ notLinked: true }` instead of redirecting, letting the caller render
 * its own "not linked" state. Pages where an unlinked account is fine (e.g.
 * the dashboard, which just hides provider-specific sections) should call
 * requireCorporateUser() and resolve the provider themselves instead.
 */
export async function requireCorporateProvider(): Promise<
  | { user: NonNullable<Awaited<ReturnType<typeof requireUser>>>; provider: Provider }
  | { notLinked: true }
> {
  const user = await requireCorporateUser();

  const domain = user.email ? emailDomain(user.email) : null;
  const provider = domain ? await prisma.provider.findFirst({ where: { corporateDomain: domain } }) : null;
  if (!provider) return { notLinked: true };

  return { user, provider };
}
