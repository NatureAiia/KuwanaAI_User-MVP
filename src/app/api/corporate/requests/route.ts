import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { privateJson } from "@/lib/apiResponse";
import { requireOwnCorporateOrg } from "@/lib/corporateAuth";
import { createCorporateRequestSchema } from "@/lib/corporateRequestSchema";
import { computeRequestDueAt } from "@/lib/corporateRequestSla";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit";

// Only "new_listing" and "new_field" requests are created here — editing a
// listing the business already owns is a direct write (PATCH
// /api/corporate/listings/[id]), see corporateListingSchema.ts.
export async function POST(req: Request) {
  const auth = await requireOwnCorporateOrg();
  if ("response" in auth) return auth.response;

  const limited = await enforceRateLimit(`corporate-requests:${auth.provider.id}`, RATE_LIMITS.authedWrite);
  if (limited) return limited;

  const parsed = createCorporateRequestSchema.safeParse(await req.json());
  if (!parsed.success) return privateJson({ error: parsed.error.flatten() }, { status: 400 });

  const data = parsed.data;

  if (data.type === "new_field") {
    const clash = await prisma.attributeSchemaField.findUnique({
      where: { categoryId_key: { categoryId: data.categoryId, key: data.proposedData.key } },
      select: { id: true },
    });
    if (clash) return privateJson({ error: `Field key "${data.proposedData.key}" already exists on this category` }, { status: 409 });
  }

  const request = await prisma.corporateRequest.create({
    data: {
      providerId: auth.provider.id,
      submittedByUserId: auth.user.id,
      type: data.type,
      categoryId: data.categoryId,
      proposedData: data.proposedData as Prisma.InputJsonValue,
      reason: data.reason,
      dueAt: computeRequestDueAt(),
      // A new field can move consumer-facing rankings once it's marked
      // comparable — send it to a regulator first, unlike new_listing.
      // "medium" risk when it's tagged to feed a BCI axis (it can shift
      // rankings), "low" otherwise (display-only data). No previousValue to
      // diff against — this is a brand-new field, not a changed one.
      regulatorDecision: data.type === "new_field" ? "pending" : "not_required",
      riskLevel: data.type === "new_field" ? (data.proposedData.qualityAxis ? "medium" : "low") : null,
    },
  });

  return privateJson({ request });
}
