import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { privateJson } from "@/lib/apiResponse";
import { requireOwnCorporateOrg } from "@/lib/corporateAuth";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  logoUrl: z.string().url().max(2000).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
});

// The company's own profile — not the price-correction scenario
// logListingUpdate exists for, so no log entry here.
export async function PATCH(req: Request) {
  const auth = await requireOwnCorporateOrg();
  if ("response" in auth) return auth.response;

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) return privateJson({ error: parsed.error.flatten() }, { status: 400 });

  const provider = await prisma.provider.update({ where: { id: auth.provider.id }, data: parsed.data });
  return privateJson({ provider });
}
