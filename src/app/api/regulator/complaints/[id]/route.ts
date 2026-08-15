import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { privateJson } from "@/lib/apiResponse";
import { requireRegulatorApiUser } from "@/lib/regulatorAuth";
import { promoteComplaintToInvestigation } from "@/lib/complaints";
import { logAdminAction } from "@/lib/adminAudit";

const patchSchema = z.object({
  status: z.enum(["open", "reviewing", "resolved", "dismissed"]).optional(),
  promote: z.literal(true).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRegulatorApiUser();
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return privateJson({ error: parsed.error.flatten() }, { status: 400 });

  if (parsed.data.promote) {
    const result = await promoteComplaintToInvestigation(id, auth.user.id);
    if ("error" in result) return privateJson({ error: result.error }, { status: 400 });

    if (auth.user.email) {
      // Two distinct events worth a durable record: a new case was opened
      // (investigation_flagged, same action a directly-opened case logs),
      // and specifically that it originated from this complaint rather than
      // an outlier scan.
      await logAdminAction({
        adminEmail: auth.user.email,
        action: "investigation_flagged",
        targetType: "investigation",
        targetId: result.investigationId,
        detail: `Promoted from complaint ${id}`,
      });
      await logAdminAction({
        adminEmail: auth.user.email,
        action: "complaint_promoted",
        targetType: "complaint",
        targetId: id,
        detail: `Promoted to investigation ${result.investigationId}`,
      });
    }

    return privateJson(result);
  }

  const existing = await prisma.consumerComplaint.findUnique({ where: { id } });
  if (!existing) return privateJson({ error: "Not found" }, { status: 404 });

  const complaint = await prisma.consumerComplaint.update({
    where: { id },
    data: { status: parsed.data.status },
  });
  return privateJson({ complaint });
}
