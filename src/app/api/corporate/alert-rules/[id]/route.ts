import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { privateJson } from "@/lib/apiResponse";
import { requireOwnCorporateOrg } from "@/lib/corporateAuth";

const patchSchema = z.object({ enabled: z.boolean() });

async function loadOwnRule(id: string, providerId: string) {
  const rule = await prisma.alertRule.findUnique({ where: { id } });
  if (!rule || rule.providerId !== providerId) return null;
  return rule;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOwnCorporateOrg();
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return privateJson({ error: parsed.error.flatten() }, { status: 400 });

  const existing = await loadOwnRule(id, auth.provider.id);
  if (!existing) return privateJson({ error: "Not found" }, { status: 404 });

  const rule = await prisma.alertRule.update({ where: { id }, data: { enabled: parsed.data.enabled } });
  return privateJson({ rule });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOwnCorporateOrg();
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const existing = await loadOwnRule(id, auth.provider.id);
  if (!existing) return privateJson({ error: "Not found" }, { status: 404 });

  await prisma.alertRule.delete({ where: { id } });
  return privateJson({ ok: true });
}
