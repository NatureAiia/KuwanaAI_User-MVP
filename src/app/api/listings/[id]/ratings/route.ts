import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { privateJson } from "@/lib/apiResponse";
import { requireConsumer } from "@/lib/auth";
import { recordEvent } from "@/lib/gamification/process-event";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { QUALITY_AXES } from "@/lib/bci";

const bodySchema = z.object({
  ratings: z
    .record(z.enum(QUALITY_AXES as [string, ...string[]]), z.number().int().min(1).max(5))
    .refine((r) => Object.keys(r).length > 0, "At least one axis rating required"),
});

/**
 * A consumer's 1-5 rating on one or more of the 5 BCI axes for a listing —
 * the subjective input side of src/lib/bci.ts's composite score (the
 * objective side, decision score etc., already existed). Consumer-only
 * (not corporate/provider — a business shouldn't be rating its own or a
 * competitor's listing), one rating per user per axis per listing,
 * re-submitting updates it rather than adding a new row (see
 * ListingQualityRating's @@unique in schema.prisma).
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireConsumer();
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const { id: listingId } = await params;

  const limited = await enforceRateLimit(`listing-rating:${user.id}`, RATE_LIMITS.authedWrite);
  if (limited) return limited;

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return privateJson({ error: parsed.error.flatten() }, { status: 400 });

  const listing = await prisma.listing.findUnique({
    where: { id: listingId, status: "published" },
    select: { id: true, category: { select: { sector: { select: { slug: true } } } } },
  });
  if (!listing) return privateJson({ error: "Listing not found" }, { status: 404 });

  const entries = Object.entries(parsed.data.ratings) as [string, number][];

  const { gamification } = await prisma.$transaction(async (tx) => {
    for (const [axis, score] of entries) {
      await tx.listingQualityRating.upsert({
        where: { listingId_userId_axis: { listingId, userId: user.id, axis: axis as never } },
        update: { score },
        create: { listingId, userId: user.id, axis: axis as never, score },
      });
    }
    const gam = await recordEvent(tx, {
      userId: user.id,
      eventType: "listing_rated",
      sector: listing.category.sector.slug as never,
    });
    return { gamification: gam };
  });

  return privateJson({ ok: true, gamification });
}
