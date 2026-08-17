import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { privateJson } from "@/lib/apiResponse";
import { logAdminAction } from "@/lib/adminAudit";

/** Revokes a key (soft — sets revokedAt, never deletes the row) so requireApiKey rejects it immediately. */
export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return privateJson({ error: "Not authorised" }, { status: 403 });

  // Never select hashedKey — same reasoning as the sibling GET in
  // api-keys/route.ts, this response must not carry key material back out.
  const select = { id: true, label: true, scopes: true, createdAt: true, lastUsedAt: true, revokedAt: true } as const;

  const { id } = await params;
  const apiKey = await prisma.apiKey.findUnique({ where: { id }, select });
  if (!apiKey) return privateJson({ error: "Not found" }, { status: 404 });
  if (apiKey.revokedAt) return privateJson({ apiKey });

  const revoked = await prisma.apiKey.update({ where: { id }, data: { revokedAt: new Date() }, select });

  await logAdminAction({
    adminEmail: admin.email,
    action: "api_key_revoked",
    targetType: "api_key",
    targetId: id,
    detail: `Revoked "${apiKey.label}"`,
  });

  return privateJson({ apiKey: revoked });
}
