import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { privateJson } from "@/lib/apiResponse";
import { requireOwnCorporateOrg } from "@/lib/corporateAuth";
import { createCorporateRequestSchema } from "@/lib/corporateRequestSchema";
import { computeRequestDueAt } from "@/lib/corporateRequestSla";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit";

// Only "new_listing" requests are created here — editing a listing the
// business already owns is a direct write (PATCH /api/corporate/listings/[id]),
// see corporateListingSchema.ts.
export async function POST(req: Request) {
  const auth = await requireOwnCorporateOrg();
  if ("response" in auth) return auth.response;

  const limited = await enforceRateLimit(`corporate-requests:${auth.provider.id}`, RATE_LIMITS.authedWrite);
  if (limited) return limited;

  const parsed = createCorporateRequestSchema.safeParse(await req.json());
  if (!parsed.success) return privateJson({ error: parsed.error.flatten() }, { status: 400 });

  const data = parsed.data;

  const request = await prisma.corporateRequest.create({
    data: {
      providerId: auth.provider.id,
      submittedByUserId: auth.user.id,
      type: data.type,
      categoryId: data.categoryId,
      proposedData: data.proposedData as Prisma.InputJsonValue,
      reason: data.reason,
      dueAt: computeRequestDueAt(),
    },
  });

  return privateJson({ request });
}
