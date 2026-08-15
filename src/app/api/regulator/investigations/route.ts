import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { privateJson } from "@/lib/apiResponse";
import { requireRegulatorApiUser } from "@/lib/regulatorAuth";
import { logAdminAction } from "@/lib/adminAudit";

const bodySchema = z.object({
  listingId: z.string().uuid(),
  reason: z.string().trim().min(1).max(500),
});

export async function POST(req: Request) {
  const auth = await requireRegulatorApiUser();
  if ("response" in auth) return auth.response;

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return privateJson({ error: parsed.error.flatten() }, { status: 400 });

  // A regulator can open a case against any provider's listing — unlike the
  // corporate route, there's no ownership check here, only that the listing
  // exists at all.
  const listing = await prisma.listing.findUnique({
    where: { id: parsed.data.listingId },
    select: { providerId: true, name: true },
  });
  if (!listing) {
    return privateJson({ error: "Listing not found" }, { status: 404 });
  }

  const investigation = await prisma.listingInvestigation.create({
    data: {
      listingId: parsed.data.listingId,
      listingName: listing.name,
      providerId: listing.providerId,
      reason: parsed.data.reason,
      assignedToUserId: auth.user.id,
    },
  });

  if (auth.user.email) {
    await logAdminAction({
      adminEmail: auth.user.email,
      action: "investigation_flagged",
      targetType: "investigation",
      targetId: investigation.id,
      detail: `${listing.name}: ${parsed.data.reason}`,
    });
  }

  return privateJson({ investigation });
}
