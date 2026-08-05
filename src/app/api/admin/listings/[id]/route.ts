import { privateJson } from "@/lib/apiResponse";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { revalidateCatalog } from "@/lib/cacheTags";
import { requireAdmin } from "@/lib/auth";
import { boundedJsonRecord } from "@/lib/zodShared";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  attributes: boundedJsonRecord(50, 16_000).optional(),
  price: z.number().positive().max(100_000_000).optional(),
  currency: z.string().trim().length(3).optional(),
  sourceUrl: z.string().url().max(2000).nullable().optional(),
  freshnessStatus: z.enum(["fresh", "stale", "unverified"]).optional(),
  // The provider review queue: approve (-> published) or reject (with a
  // reason the provider sees on /provider) a pending_review submission.
  // Also usable by an admin to directly retire/unpublish any listing.
  status: z.enum(["draft", "pending_review", "published", "rejected"]).optional(),
  rejectionReason: z.string().trim().max(1000).nullable().optional(),
  // Editing any field is itself an act of verification — bump the clock
  // unless the admin explicitly wants to backdate it for some reason.
  markVerifiedNow: z.boolean().default(true),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return privateJson({ error: "Not authorized" }, { status: 403 });

  const { id } = await params;
  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) return privateJson({ error: parsed.error.flatten() }, { status: 400 });

  const { attributes, markVerifiedNow, ...rest } = parsed.data;

  const listing = await prisma.listing.update({
    where: { id },
    data: {
      ...rest,
      ...(attributes ? { attributes: attributes as Prisma.InputJsonValue } : {}),
      // Approving clears any stale rejection reason from a prior round.
      ...(rest.status === "published" ? { rejectionReason: null } : {}),
      ...(markVerifiedNow ? { lastVerifiedAt: new Date(), freshnessStatus: rest.freshnessStatus ?? "fresh" } : {}),
    },
  });

  // The catalog read cache is keyed by tag, not by TTL alone — without
  // this, an edited price keeps serving stale until the 5-minute backstop.
  revalidateCatalog();
  return privateJson({ listing });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return privateJson({ error: "Not authorized" }, { status: 403 });

  const { id } = await params;
  await prisma.listing.delete({ where: { id } });

  revalidateCatalog();
  return privateJson({ ok: true });
}
