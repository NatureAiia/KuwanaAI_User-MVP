import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/adminAudit";
import { privateJson } from "@/lib/apiResponse";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return privateJson({ error: "Not authorised" }, { status: 403 });

  const { id } = await params;
  const discountRule = await prisma.discountRule.delete({
    where: { id },
    include: { provider: true, category: true, listing: true },
  });

  await logAdminAction({
    adminEmail: admin.email,
    action: "discount_rule_deleted",
    targetType: "discount_rule",
    targetId: discountRule.id,
    detail: `${discountRule.provider.name}: ${Number(discountRule.percentOff)}% off ${discountRule.scope === "category" ? discountRule.category?.name : discountRule.listing?.name}`,
  });

  return privateJson({ ok: true });
}
