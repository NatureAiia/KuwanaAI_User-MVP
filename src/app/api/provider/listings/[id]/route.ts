import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { revalidateCatalog } from "@/lib/cacheTags";
import { requireOwnProvider } from "@/lib/providerAuth";
import { providerUpdateListingSchema } from "@/lib/providerListingSchema";
import { recordPriceChange } from "@/lib/catalog";

// A plain edit while draft/pending_review (still pre-review) or rejected
// (fix and resend) just updates the row. Editing a *published* listing is
// allowed directly for anything except price — description/images/specs
// apply in place and the listing stays live. A price change is the one
// edit that drops the row back to pending_review (and off every
// consumer-facing read, which all filter status: "published") until an
// admin re-approves it: price is the one field a shopper's decision
// actually rests on, so it's the one that still needs a human to confirm
// before it goes live again — there's no separate staging copy, so this is
// the only way to change a live price without bypassing the review
// workflow it exists for.
const PATCH_ALLOWED_STATUSES = ["draft", "pending_review", "rejected", "published"] as const;
// DELETE stays narrower: a provider can only withdraw something that was
// never (or is no longer, post-rejection) publicly visible. Deleting a
// published listing is admin-only (/api/admin/listings/[id]).
const DELETE_ALLOWED_STATUSES = ["draft", "pending_review", "rejected"] as const;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOwnProvider();
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const existing = await prisma.listing.findUnique({ where: { id } });
  if (!existing || existing.providerId !== auth.provider.id) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }
  if (!PATCH_ALLOWED_STATUSES.includes(existing.status as (typeof PATCH_ALLOWED_STATUSES)[number])) {
    return NextResponse.json({ error: "This listing can't be edited here" }, { status: 409 });
  }

  const parsed = providerUpdateListingSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { attributes, ...rest } = parsed.data;
  const priceChanged = rest.price !== undefined && Number(existing.price) !== rest.price;

  const listing = await prisma.listing.update({
    where: { id },
    data: {
      ...rest,
      ...(attributes ? { attributes: attributes as Prisma.InputJsonValue } : {}),
      // Any edit while rejected clears the now-stale reason, whether or not
      // this request also moves status back to pending_review.
      ...(existing.status === "rejected" ? { rejectionReason: null } : {}),
      // Only a price change sends a published listing back for review —
      // never left "published" with an unreviewed price live, but never
      // pulled for a description/image/spec tweak either. Never whatever
      // status (if any) the client asked for.
      ...(existing.status === "published" && priceChanged ? { status: "pending_review" } : {}),
    },
  });

  if (priceChanged) {
    await recordPriceChange(id, Number(existing.price));
  }

  // The catalog read cache is tag-keyed, not TTL-only — without this an
  // edited listing keeps serving stale until the backstop expires.
  revalidateCatalog();
  return NextResponse.json({ listing });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOwnProvider();
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const existing = await prisma.listing.findUnique({ where: { id } });
  if (!existing || existing.providerId !== auth.provider.id) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }
  if (!DELETE_ALLOWED_STATUSES.includes(existing.status as (typeof DELETE_ALLOWED_STATUSES)[number])) {
    return NextResponse.json(
      { error: "This listing is published and can't be deleted here — ask an admin." },
      { status: 409 },
    );
  }

  await prisma.listing.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
