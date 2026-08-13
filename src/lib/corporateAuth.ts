import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { privateJson } from "@/lib/apiResponse";
import { emailDomain } from "@/lib/orgVerification";

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
