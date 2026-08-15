import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/adminAudit";
import { privateJson } from "@/lib/apiResponse";

const patchSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  category: z.enum(["regulatory", "competitor", "macro"]).optional(),
  riskLevel: z.enum(["low", "medium", "high"]).optional(),
  reviewCycleDays: z.number().int().positive().max(3650).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  documentUrls: z.array(z.string().url()).max(20).optional(),
  sectorSlug: z.string().trim().max(40).nullable().optional(),
  assignedToUserId: z.string().uuid().nullable().optional(),
  // Sugar for the admin row's "assign to me" toggle, which has no way to
  // know its own user id client-side without threading it through every
  // row — resolved to the requesting admin's own id server-side instead.
  assignToSelf: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return privateJson({ error: "Not authorised" }, { status: 403 });

  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { assignToSelf, ...rest } = parsed.data;
  const data = assignToSelf === undefined ? rest : { ...rest, assignedToUserId: assignToSelf ? admin.id : null };

  const condition = await prisma.businessCondition.update({ where: { id }, data });

  await logAdminAction({
    adminEmail: admin.email,
    action: "business_condition_updated",
    targetType: "business_condition",
    targetId: condition.id,
    detail: `Updated "${condition.title}"`,
  });

  return privateJson({ condition });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return privateJson({ error: "Not authorised" }, { status: 403 });

  const { id } = await params;
  const condition = await prisma.businessCondition.delete({ where: { id } });

  await logAdminAction({
    adminEmail: admin.email,
    action: "business_condition_deleted",
    targetType: "business_condition",
    targetId: condition.id,
    detail: `Deleted "${condition.title}"`,
  });

  return privateJson({ ok: true });
}
