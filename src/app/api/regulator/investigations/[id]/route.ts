import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { privateJson } from "@/lib/apiResponse";
import { requireRegulatorApiUser } from "@/lib/regulatorAuth";
import { logAdminAction } from "@/lib/adminAudit";

const patchSchema = z.object({
  status: z.enum(["open", "in_progress", "resolved", "dismissed"]).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  outcome: z.enum(["none", "warning", "fine", "suspension"]).optional(),
  evidenceUrls: z.array(z.string().trim().url()).max(20).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRegulatorApiUser();
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return privateJson({ error: parsed.error.flatten() }, { status: 400 });

  // Any regulator account can act on any case — a regulator's case queue is
  // market-wide oversight, not per-user ownership, unlike corporate's
  // provider-scoped PATCH route.
  const existing = await prisma.listingInvestigation.findUnique({ where: { id } });
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

  // Carries the enforcement outcome (warning/fine/suspension) when a
  // regulator sets one — the durable record of what enforcement action was
  // actually taken, since ListingInvestigation itself gets overwritten in
  // place rather than versioned.
  if (auth.user.email) {
    await logAdminAction({
      adminEmail: auth.user.email,
      action: "investigation_updated",
      targetType: "investigation",
      targetId: investigation.id,
      detail: `${existing.listingName}: ${JSON.stringify(parsed.data)}`,
    });
  }

  return privateJson({ investigation });
}
