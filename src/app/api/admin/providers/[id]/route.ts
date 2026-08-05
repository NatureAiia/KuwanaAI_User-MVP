import { NextResponse } from "next/server";
import { privateJson } from "@/lib/apiResponse";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { revalidateCatalog } from "@/lib/cacheTags";
import { requireAdmin } from "@/lib/auth";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  logoUrl: z.string().url().max(2000).nullable().optional(),
  verified: z.boolean().optional(),
  // Look up by email rather than accepting a raw userId — an admin knows
  // the provider contact's email, not their internal user id. Pass null to
  // unlink. Resolved to ownerUserId server-side below.
  ownerEmail: z.string().email().nullable().optional(),
});

// No DELETE here deliberately — Provider -> Listing is onDelete: Cascade,
// so deleting a provider silently wipes every one of its listings. That's
// a decision an admin should make explicitly per-listing, not something
// a single API call should do as a side effect.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return privateJson({ error: "Not authorized" }, { status: 403 });

  const { id } = await params;
  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) return privateJson({ error: parsed.error.flatten() }, { status: 400 });

  const { ownerEmail, ...rest } = parsed.data;

  let ownerUserId: string | null | undefined;
  if (ownerEmail === null) {
    ownerUserId = null;
  } else if (ownerEmail) {
    const owner = await prisma.user.findUnique({ where: { email: ownerEmail } });
    if (!owner) {
      return privateJson({ error: `No user found with email ${ownerEmail}` }, { status: 404 });
    }
    const alreadyLinked = await prisma.provider.findUnique({ where: { ownerUserId: owner.id } });
    if (alreadyLinked && alreadyLinked.id !== id) {
      return NextResponse.json(
        { error: `${ownerEmail} already owns another provider (${alreadyLinked.name})` },
        { status: 409 },
      );
    }
    ownerUserId = owner.id;
  }

  const provider = await prisma.provider.update({
    where: { id },
    data: { ...rest, ...(ownerUserId !== undefined ? { ownerUserId } : {}) },
  });
  // The catalog read cache is keyed by tag, not by TTL alone — without
  // this, an edited price keeps serving stale until the 5-minute backstop.
  revalidateCatalog();
  return privateJson({ provider });
}
