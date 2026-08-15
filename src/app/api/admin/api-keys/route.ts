import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { privateJson } from "@/lib/apiResponse";
import { logAdminAction } from "@/lib/adminAudit";
import { generateApiKey } from "@/lib/bi/keys";
import { BI_SCOPES } from "@/lib/bi/scopes";

const bodySchema = z
  .object({
    label: z.string().trim().min(1).max(120),
    providerId: z.string().uuid().nullable().optional(),
    scopes: z.array(z.enum(BI_SCOPES)).min(1),
  })
  .refine((data) => !data.scopes.includes("read:account") || data.providerId, {
    message: "read:account requires a linked provider",
    path: ["scopes"],
  });

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return privateJson({ error: "Not authorised" }, { status: 403 });

  const keys = await prisma.apiKey.findMany({
    include: { provider: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return privateJson({ keys });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return privateJson({ error: "Not authorised" }, { status: 403 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { label, providerId, scopes } = parsed.data;

  if (providerId) {
    const provider = await prisma.provider.findUnique({ where: { id: providerId }, select: { id: true } });
    if (!provider) return privateJson({ error: "Unknown provider" }, { status: 400 });
  }

  const { plaintextKey, hashedKey } = generateApiKey();
  const apiKey = await prisma.apiKey.create({
    data: { label, providerId: providerId ?? null, hashedKey, scopes },
  });

  await logAdminAction({
    adminEmail: admin.email,
    action: "api_key_created",
    targetType: "api_key",
    targetId: apiKey.id,
    detail: `Created "${label}" (${scopes.join(", ")})${providerId ? ` scoped to provider ${providerId}` : ""}`,
  });

  // The only response that will ever carry the plaintext key — it is not
  // recoverable after this (see hashApiKey), only re-issuable as a new key.
  return privateJson({ apiKey: { id: apiKey.id, label: apiKey.label, scopes: apiKey.scopes }, plaintextKey });
}
