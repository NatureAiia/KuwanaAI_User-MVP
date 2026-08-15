import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { privateJson } from "@/lib/apiResponse";

/**
 * A "provider" role account only ever acts on the one Provider record it's
 * attached to — either being the account that created the business
 * (Provider.ownerUserId, set at signup or by an admin at /admin/catalog) or
 * being a teammate the owner invited afterward (ProviderMember, see
 * /provider/team) — never both, since ProviderMember.userId is unique and an
 * owner never also rows themself into their own provider_members. `isOwner`
 * lets a route/page gate owner-only actions (inviting/removing a teammate)
 * without a second query. Shared by requireOwnProvider (API routes) and
 * every /provider/** page, which does its own requireUser()/role redirect
 * first and just needs the provider lookup — never resolve this any other
 * way (e.g. a page's own `prisma.provider.findUnique({ where: {
 * ownerUserId } })`), or an invited teammate silently can't reach anything.
 */
export async function resolveOwnProvider(
  userId: string,
): Promise<{ id: string; name: string; isOwner: boolean } | null> {
  const [owned, membership] = await Promise.all([
    prisma.provider.findUnique({ where: { ownerUserId: userId }, select: { id: true, name: true } }),
    prisma.providerMember.findUnique({
      where: { userId },
      select: { provider: { select: { id: true, name: true } } },
    }),
  ]);
  const provider = owned ?? membership?.provider;
  return provider ? { ...provider, isOwner: !!owned } : null;
}

export async function requireOwnProvider(): Promise<
  | {
      user: NonNullable<Awaited<ReturnType<typeof requireUser>>>;
      provider: { id: string; name: string };
      isOwner: boolean;
    }
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

  const provider = await resolveOwnProvider(user.id);
  if (!provider) {
    return {
      response: privateJson(
        { error: "Your account isn't linked to a provider yet — ask an admin to link it." },
        { status: 404 },
      ),
    };
  }

  const { isOwner, ...providerRest } = provider;
  return { user, provider: providerRest, isOwner };
}
