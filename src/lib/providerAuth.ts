import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { privateJson } from "@/lib/apiResponse";

/**
 * A "provider" role account only ever acts on the one Provider record an
 * admin linked it to (Provider.ownerUserId, set via /admin/catalog) — never
 * an arbitrary providerId a client might pass. Every provider-scoped route
 * should resolve the caller's own provider through this, not trust a
 * providerId in the request body.
 */
export async function requireOwnProvider(): Promise<
  | { user: NonNullable<Awaited<ReturnType<typeof requireUser>>>; provider: { id: string; name: string } }
  | { response: NextResponse }
> {
  const user = await requireUser();
  if (!user) {
    return { response: privateJson({ error: "Not authenticated" }, { status: 401 }) };
  }

  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { role: true } });
  if (dbUser?.role !== "provider") {
    return {
      response: privateJson({ error: "This feature is for provider accounts" }, { status: 403 }),
    };
  }

  const provider = await prisma.provider.findUnique({
    where: { ownerUserId: user.id },
    select: { id: true, name: true },
  });
  if (!provider) {
    return {
      response: privateJson(
        { error: "Your account isn't linked to a provider yet — ask an admin to link it." },
        { status: 404 },
      ),
    };
  }

  return { user, provider };
}
