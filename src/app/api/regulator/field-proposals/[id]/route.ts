import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { privateJson } from "@/lib/apiResponse";
import { requireRegulatorApiUser } from "@/lib/regulatorAuth";
import { logAdminAction } from "@/lib/adminAudit";

const bodySchema = z.object({
  decision: z.enum(["approved", "rejected", "flagged"]),
  note: z.string().trim().max(1000).optional(),
});

/**
 * The regulator sign-off stage on a corporate's `new_field` proposal — sits
 * between submission (POST /api/corporate/requests) and the admin's final
 * approval (POST /api/admin/corporate-requests/[id]), which is gated on
 * regulatorDecision === "approved" (see that route). Any regulator account
 * can act on any pending proposal — same market-wide-oversight model as
 * /api/regulator/investigations/[id], not per-provider ownership.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRegulatorApiUser();
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return privateJson({ error: parsed.error.flatten() }, { status: 400 });

  const request = await prisma.corporateRequest.findUnique({ where: { id }, include: { provider: true } });
  if (!request) return privateJson({ error: "Not found" }, { status: 404 });
  if (request.type !== "new_field") {
    return privateJson({ error: "Only new_field proposals go through regulator review" }, { status: 400 });
  }
  if (request.regulatorDecision !== "pending") {
    return privateJson({ error: "Already reviewed by a regulator" }, { status: 409 });
  }

  const updated = await prisma.corporateRequest.update({
    where: { id },
    data: {
      regulatorDecision: parsed.data.decision,
      regulatorReviewedByEmail: auth.user.email ?? null,
      regulatorReviewedAt: new Date(),
      regulatorNote: parsed.data.note ?? null,
      // A rejection/flag ends the request outright — it never reaches the
      // admin queue. An approval leaves status "pending" so it now shows up
      // for admin's final sign-off.
      status: parsed.data.decision === "rejected" ? "rejected" : request.status,
      rejectionReason: parsed.data.decision === "rejected" ? (parsed.data.note ?? "Rejected by regulator") : null,
    },
  });

  if (auth.user.email) {
    await logAdminAction({
      adminEmail: auth.user.email,
      action: "corporate_field_proposal_regulator_reviewed",
      targetType: "corporate_request",
      targetId: id,
      detail: `${parsed.data.decision} field proposal from "${request.provider.name}"${parsed.data.note ? `: ${parsed.data.note}` : ""}`,
    });
  }

  return privateJson({ request: updated });
}
