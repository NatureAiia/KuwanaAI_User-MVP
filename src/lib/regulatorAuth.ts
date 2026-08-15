import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { privateJson } from "@/lib/apiResponse";

/**
 * Auth+role check shared by every regulator page — redirects (rather than
 * returning a JSON response) on failure, since pages can't return a
 * NextResponse the way API routes do. Mirrors requireCorporateUser() in
 * corporateAuth.ts. Unlike a corporate account, a regulator isn't linked to
 * one Provider — it oversees all of them, so there's no provider-resolution
 * counterpart to requireCorporateProvider() here.
 */
export async function requireRegulatorUser() {
  const user = await requireUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { role: true } });
  if (dbUser?.role !== "regulator") redirect("/dashboard");

  return user;
}

/** API-route counterpart to requireRegulatorUser() — returns a response instead of redirecting. */
export async function requireRegulatorApiUser() {
  const user = await requireUser();
  if (!user) {
    return { response: privateJson({ error: "Not authenticated" }, { status: 401 }) };
  }

  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { role: true } });
  if (dbUser?.role !== "regulator") {
    return { response: privateJson({ error: "This feature is for regulator accounts" }, { status: 403 }) };
  }

  return { user };
}
