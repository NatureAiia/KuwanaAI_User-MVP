import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { privateJson } from "@/lib/apiResponse";
import { adminUserUpdateSchema } from "@/lib/adminUserSchema";
import { logAdminAction } from "@/lib/adminAudit";
import { revalidateCatalog } from "@/lib/cacheTags";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return privateJson({ error: "Not authorized" }, { status: 403 });

  const { id } = await params;
  const parsed = adminUserUpdateSchema.safeParse(await req.json());
  if (!parsed.success) return privateJson({ error: parsed.error.flatten() }, { status: 400 });

  const before = await prisma.user.findUnique({ where: { id }, select: { role: true, accountStatus: true } });
  if (!before) return privateJson({ error: "Not found" }, { status: 404 });

  const suspending = parsed.data.accountStatus === "suspended";
  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(parsed.data.role !== undefined && { role: parsed.data.role }),
      ...(parsed.data.accountStatus !== undefined && {
        accountStatus: parsed.data.accountStatus,
        suspendedAt: suspending ? new Date() : null,
        suspendedReason: suspending ? (parsed.data.suspendedReason ?? null) : null,
      }),
    },
    select: { id: true, email: true, role: true, accountStatus: true, suspendedReason: true },
  });

  if (parsed.data.role !== undefined && before.role !== user.role) {
    await logAdminAction({
      adminEmail: admin.email,
      action: "user_role_changed",
      targetType: "user",
      targetId: user.id,
      detail: `Changed ${user.email}'s role: ${before.role} → ${user.role}`,
    });
  }

  if (parsed.data.accountStatus !== undefined && before.accountStatus !== user.accountStatus) {
    await logAdminAction({
      adminEmail: admin.email,
      action: user.accountStatus === "suspended" ? "user_suspended" : "user_reactivated",
      targetType: "user",
      targetId: user.id,
      detail:
        user.accountStatus === "suspended"
          ? `Deactivated ${user.email}${user.suspendedReason ? `: ${user.suspendedReason}` : ""}`
          : `Reactivated ${user.email}`,
    });
  }

  // "Permanent" deactivation (see UserStatusToggle's popup) — the account's
  // provider, if any, has every one of its listings hard-deleted alongside
  // the suspension. Same prisma.listing.delete() semantics admin/catalog's
  // own DELETE route already uses, just batched — no soft-delete/"archived"
  // status exists in this schema to fall back to instead.
  if (suspending && parsed.data.listingAction === "remove") {
    const provider = await prisma.provider.findUnique({ where: { ownerUserId: user.id }, select: { id: true, name: true } });
    if (provider) {
      const { count } = await prisma.listing.deleteMany({ where: { providerId: provider.id } });
      if (count > 0) {
        await logAdminAction({
          adminEmail: admin.email,
          action: "provider_listings_removed",
          targetType: "provider",
          targetId: provider.id,
          detail: `Removed ${count} listing(s) for ${provider.name} (account deactivated)`,
        });
        revalidateCatalog();
      }

      // A permanent deactivation blocks the app itself via requireUser(),
      // but a BI API key (src/lib/bi/auth.ts's requireApiKey) is validated
      // purely against its own revokedAt — untouched by accountStatus — so
      // without this, a deactivated provider's existing key would keep
      // pulling data indefinitely after the "permanent" choice was made.
      const { count: revokedCount } = await prisma.apiKey.updateMany({
        where: { providerId: provider.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (revokedCount > 0) {
        await logAdminAction({
          adminEmail: admin.email,
          action: "api_key_revoked",
          targetType: "api_key",
          targetId: provider.id,
          detail: `Revoked ${revokedCount} API key(s) for ${provider.name} (account deactivated)`,
        });
      }
    }
  }

  return privateJson({ user });
}
