import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { privateJson } from "@/lib/apiResponse";
import { requireRegulatorApiUser } from "@/lib/regulatorAuth";
import { logAdminAction } from "@/lib/adminAudit";

const patchSchema = z.object({ enabled: z.boolean() });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRegulatorApiUser();
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return privateJson({ error: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.priceCapRule.findUnique({ where: { id }, include: { category: { select: { name: true } } } });
  if (!existing) return privateJson({ error: "Not found" }, { status: 404 });

  // Any regulator account can toggle/delete any rule — market-wide oversight,
  // not per-user ownership, same precedent as the regulator investigations
  // route.
  const rule = await prisma.priceCapRule.update({ where: { id }, data: { enabled: parsed.data.enabled } });

  if (auth.user.email) {
    await logAdminAction({
      adminEmail: auth.user.email,
      action: "price_cap_rule_updated",
      targetType: "price_cap_rule",
      targetId: rule.id,
      detail: `${existing.category.name}: ${parsed.data.enabled ? "enabled" : "paused"}`,
    });
  }

  return privateJson({ rule });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRegulatorApiUser();
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const existing = await prisma.priceCapRule.findUnique({ where: { id }, include: { category: { select: { name: true } } } });
  if (!existing) return privateJson({ error: "Not found" }, { status: 404 });

  await prisma.priceCapRule.delete({ where: { id } });

  if (auth.user.email) {
    await logAdminAction({
      adminEmail: auth.user.email,
      action: "price_cap_rule_deleted",
      targetType: "price_cap_rule",
      targetId: id,
      detail: `${existing.category.name}: capped at ${existing.currency} ${Number(existing.capValue)}`,
    });
  }

  return privateJson({ ok: true });
}
