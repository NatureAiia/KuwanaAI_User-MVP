import { z } from "zod";
import { privateJson } from "@/lib/apiResponse";
import { prisma } from "@/lib/prisma";
import { requireOwnProvider } from "@/lib/providerAuth";

const inviteSchema = z.object({ email: z.string().trim().email() });

export async function GET() {
  const auth = await requireOwnProvider();
  if ("response" in auth) return auth.response;

  const members = await prisma.providerMember.findMany({
    where: { providerId: auth.provider.id },
    include: { user: { select: { email: true } } },
    orderBy: { createdAt: "asc" },
  });

  return privateJson({
    isOwner: auth.isOwner,
    members: members.map((m) => ({ userId: m.userId, email: m.user.email, createdAt: m.createdAt })),
  });
}

export async function POST(req: Request) {
  const auth = await requireOwnProvider();
  if ("response" in auth) return auth.response;
  if (!auth.isOwner) {
    return privateJson({ error: "Only the account that created this business can invite teammates." }, { status: 403 });
  }

  const parsed = inviteSchema.safeParse(await req.json());
  if (!parsed.success) return privateJson({ error: parsed.error.flatten() }, { status: 400 });

  const target = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, role: true },
  });
  if (!target) {
    return privateJson(
      { error: "No account found with that email — ask them to sign up as a Provider first." },
      { status: 404 },
    );
  }
  if (target.id === auth.user.id) {
    return privateJson({ error: "That's your own account." }, { status: 400 });
  }
  if (target.role !== "provider") {
    return privateJson({ error: "That account isn't a Provider account yet." }, { status: 409 });
  }

  // Unlike corporate's domain-match, a provider person belongs to at most
  // one small business — reject if they already own or belong to any
  // Provider (including this one), rather than silently moving them.
  const [ownsAnother, memberOfAnother] = await Promise.all([
    prisma.provider.findUnique({ where: { ownerUserId: target.id }, select: { id: true } }),
    prisma.providerMember.findUnique({ where: { userId: target.id }, select: { id: true } }),
  ]);
  if (ownsAnother || memberOfAnother) {
    return privateJson(
      { error: "That account is already linked to a different business." },
      { status: 409 },
    );
  }

  const member = await prisma.providerMember.create({
    data: { providerId: auth.provider.id, userId: target.id },
  });

  return privateJson({ member: { userId: member.userId, email: parsed.data.email, createdAt: member.createdAt } });
}
