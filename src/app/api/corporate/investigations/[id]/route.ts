import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { privateJson } from "@/lib/apiResponse";
import { requireOwnCorporateOrg } from "@/lib/corporateAuth";

const patchSchema = z.object({
  status: z.enum(["open", "in_progress", "resolved", "dismissed"]).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOwnCorporateOrg();
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return privateJson({ error: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.listingInvestigation.findUnique({ where: { id } });
  if (!existing || existing.providerId !== auth.provider.id) {
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

  return privateJson({ investigation });
}
