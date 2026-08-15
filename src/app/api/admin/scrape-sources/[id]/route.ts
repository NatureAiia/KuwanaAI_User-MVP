import { z } from "zod";
import { privateJson } from "@/lib/apiResponse";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAdminAction } from "@/lib/adminAudit";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  url: z.string().url().max(2000).optional(),
  categoryId: z.string().uuid().nullable().optional(),
  enabled: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return privateJson({ error: "Not authorized" }, { status: 403 });

  const { id } = await params;
  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) return privateJson({ error: parsed.error.flatten() }, { status: 400 });

  const source = await prisma.scrapeSource.update({ where: { id }, data: parsed.data });

  await logAdminAction({
    adminEmail: admin.email,
    action: "scrape_source_updated",
    targetType: "scrape_source",
    targetId: source.id,
    detail: `Updated "${source.name}"`,
  });

  return privateJson({ source });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return privateJson({ error: "Not authorized" }, { status: 403 });

  const { id } = await params;
  const source = await prisma.scrapeSource.delete({ where: { id } });

  await logAdminAction({
    adminEmail: admin.email,
    action: "scrape_source_deleted",
    targetType: "scrape_source",
    targetId: id,
    detail: `Deleted "${source.name}"`,
  });

  return privateJson({ ok: true });
}
