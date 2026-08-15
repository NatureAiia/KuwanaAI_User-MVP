import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { adminUserUpdateSchema } from "@/lib/adminUserSchema";
import { logAdminAction } from "@/lib/adminAudit";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const { id } = await params;
  const parsed = adminUserUpdateSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const before = await prisma.user.findUnique({ where: { id }, select: { role: true, accountStatus: true } });
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

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

  return NextResponse.json({ user });
}
