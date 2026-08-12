import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/adminAudit";
import { privateJson } from "@/lib/apiResponse";

const patchSchema = z.object({ active: z.boolean() });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return privateJson({ error: "Not authorised" }, { status: 403 });

  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const advert = await prisma.advert.update({ where: { id }, data: { active: parsed.data.active } });

  await logAdminAction({
    adminEmail: admin.email,
    action: "advert_updated",
    targetType: "advert",
    targetId: advert.id,
    detail: `${advert.sponsorName}: active → ${advert.active}`,
  });

  return privateJson({ advert });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return privateJson({ error: "Not authorised" }, { status: 403 });

  const { id } = await params;
  const advert = await prisma.advert.delete({ where: { id } });

  await logAdminAction({
    adminEmail: admin.email,
    action: "advert_deleted",
    targetType: "advert",
    targetId: advert.id,
    detail: `${advert.sponsorName}: "${advert.tagline}"`,
  });

  return privateJson({ ok: true });
}
