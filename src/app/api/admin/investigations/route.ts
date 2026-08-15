import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { privateJson } from "@/lib/apiResponse";
import { logAdminAction } from "@/lib/adminAudit";

const bodySchema = z.object({
  listingId: z.string().uuid(),
  reason: z.string().trim().min(1).max(500),
});

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return privateJson({ error: "Not authorised" }, { status: 403 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return privateJson({ error: parsed.error.flatten() }, { status: 400 });

  // Mirrors the regulator's route — an admin can open a case against any
  // provider's listing, no ownership check, just that the listing exists.
  const listing = await prisma.listing.findUnique({ where: { id: parsed.data.listingId }, select: { providerId: true, name: true } });
  if (!listing) {
    return privateJson({ error: "Listing not found" }, { status: 404 });
  }

  const investigation = await prisma.listingInvestigation.create({
    data: {
      listingId: parsed.data.listingId,
      providerId: listing.providerId,
      reason: parsed.data.reason,
      assignedToUserId: admin.id,
    },
  });

  await logAdminAction({
    adminEmail: admin.email,
    action: "investigation_flagged",
    targetType: "investigation",
    targetId: investigation.id,
    detail: `${listing.name}: ${parsed.data.reason}`,
  });

  return privateJson({ investigation });
}
