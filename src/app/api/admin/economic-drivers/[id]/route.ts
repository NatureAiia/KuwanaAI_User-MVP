import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/adminAudit";
import { privateJson } from "@/lib/apiResponse";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return privateJson({ error: "Not authorised" }, { status: 403 });

  const { id } = await params;
  const economicDriver = await prisma.economicDriver.delete({ where: { id } });

  await logAdminAction({
    adminEmail: admin.email,
    action: "economic_driver_deleted",
    targetType: "economic_driver",
    targetId: economicDriver.id,
    detail: `${economicDriver.name} (${economicDriver.region}): ${Number(economicDriver.value)}`,
  });

  return privateJson({ ok: true });
}
