import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { privateJson } from "@/lib/apiResponse";
import { requireOwnCorporateOrg } from "@/lib/corporateAuth";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit";

const bodySchema = z.object({
  metric: z.enum(["avg_price", "listing_count", "trending_down", "trending_up"]),
  direction: z.enum(["above", "below"]),
  threshold: z.number().positive(),
});

export async function POST(req: Request) {
  const auth = await requireOwnCorporateOrg();
  if ("response" in auth) return auth.response;

  const limited = await enforceRateLimit(`corporate-alert-rules:${auth.provider.id}`, RATE_LIMITS.authedWrite);
  if (limited) return limited;

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return privateJson({ error: parsed.error.flatten() }, { status: 400 });

  const rule = await prisma.alertRule.create({
    data: {
      providerId: auth.provider.id,
      createdByUserId: auth.user.id,
      metric: parsed.data.metric,
      direction: parsed.data.direction,
      threshold: parsed.data.threshold,
    },
  });

  return privateJson({ rule });
}
