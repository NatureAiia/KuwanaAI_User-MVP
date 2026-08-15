import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { privateJson } from "@/lib/apiResponse";

const patchSchema = z.object({ enabled: z.boolean() });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return privateJson({ error: "Not authorised" }, { status: 403 });

  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return privateJson({ error: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.adminAlertRule.findUnique({ where: { id } });
  if (!existing) return privateJson({ error: "Not found" }, { status: 404 });

  const rule = await prisma.adminAlertRule.update({ where: { id }, data: { enabled: parsed.data.enabled } });
  return privateJson({ rule });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return privateJson({ error: "Not authorised" }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.adminAlertRule.findUnique({ where: { id } });
  if (!existing) return privateJson({ error: "Not found" }, { status: 404 });

  await prisma.adminAlertRule.delete({ where: { id } });
  return privateJson({ ok: true });
}
