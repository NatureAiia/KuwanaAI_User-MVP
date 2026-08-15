import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { privateJson } from "@/lib/apiResponse";
import { logAdminAction } from "@/lib/adminAudit";

const patchSchema = z.object({
  status: z.enum(["open", "in_progress", "resolved", "dismissed"]).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  outcome: z.enum(["none", "warning", "fine", "suspension"]).optional(),
  evidenceUrls: z.array(z.string().trim().url()).max(20).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return privateJson({ error: "Not authorised" }, { status: 403 });

  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return privateJson({ error: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.listingInvestigation.findUnique({
    where: { id },
    include: { listing: { select: { name: true } } },
  });
  if (!existing) {
    return privateJson({ error: "Not found" }, { status: 404 });
  }

  const closing = parsed.data.status === "resolved" || parsed.data.status === "dismissed";
  const investigation = await prisma.listingInvestigation.update({
    where: { id },
    data: {
      ...parsed.data,
      resolvedAt: closing ? new Date() : existing.resolvedAt,
    },
  });

  await logAdminAction({
    adminEmail: admin.email,
    action: "investigation_updated",
    targetType: "investigation",
    targetId: investigation.id,
    detail: `${existing.listing.name}: ${JSON.stringify(parsed.data)}`,
  });

  return privateJson({ investigation });
}
