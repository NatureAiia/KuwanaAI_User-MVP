import { privateJson } from "@/lib/apiResponse";
import { prisma } from "@/lib/prisma";
import { requireOwnProvider } from "@/lib/providerAuth";

export async function DELETE(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const auth = await requireOwnProvider();
  if ("response" in auth) return auth.response;
  if (!auth.isOwner) {
    return privateJson({ error: "Only the account that created this business can remove teammates." }, { status: 403 });
  }

  const { userId } = await params;
  const member = await prisma.providerMember.findUnique({ where: { userId } });
  if (!member || member.providerId !== auth.provider.id) {
    return privateJson({ error: "That teammate isn't part of your business." }, { status: 404 });
  }

  await prisma.providerMember.delete({ where: { userId } });
  return privateJson({ ok: true });
}
