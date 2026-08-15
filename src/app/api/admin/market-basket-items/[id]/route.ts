import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/adminAudit";
import { privateJson } from "@/lib/apiResponse";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return privateJson({ error: "Not authorised" }, { status: 403 });

  const { id } = await params;
  const item = await prisma.marketBasketItem.delete({ where: { id } });

  await logAdminAction({
    adminEmail: admin.email,
    action: "market_basket_item_deleted",
    targetType: "market_basket_item",
    targetId: item.id,
    detail: `${item.basketName}: ${item.label}`,
  });

  return privateJson({ ok: true });
}
