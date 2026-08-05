import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireOwnProvider } from "@/lib/providerAuth";
import { providerUpdateListingSchema } from "@/lib/providerListingSchema";

// A plain edit while draft/pending_review (still pre-review) or rejected
// (fix and resend) just updates the row. Editing a *published* listing is
// the "propose an edit" flow: allowed, but the row drops back to
// pending_review (and off every consumer-facing read, which all filter
// status: "published") until an admin re-approves it — there's no separate
// staging copy, so this is the only way to change live data without
// bypassing the review workflow it exists for.
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
  const listing = await prisma.listing.update({
    where: { id },
    data: {
      ...rest,
      ...(attributes ? { attributes: attributes as Prisma.InputJsonValue } : {}),
      // Any edit while rejected clears the now-stale reason, whether or not
      // this request also moves status back to pending_review.
      ...(existing.status === "rejected" ? { rejectionReason: null } : {}),
      // Editing a published listing always sends it back for review —
      // never left as "published" with unreviewed changes live, and never
      // whatever status (if any) the client asked for.
      ...(existing.status === "published" ? { status: "pending_review" } : {}),
    },
  });
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
