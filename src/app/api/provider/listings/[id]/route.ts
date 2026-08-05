import { NextResponse } from "next/server";
import { privateJson } from "@/lib/apiResponse";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { revalidateCatalog } from "@/lib/cacheTags";
import { requireOwnProvider } from "@/lib/providerAuth";
import { providerUpdateListingSchema } from "@/lib/providerListingSchema";

// Editable only while draft/pending_review (still pre-review) or rejected
// (fix and resend). A published listing is live, consumer-facing data —
// changing it here would bypass the whole point of the review workflow, so
// this route deliberately can't touch one; that requires a future
// "propose an edit" flow, not a plain PATCH.
const EDITABLE_STATUSES = ["draft", "pending_review", "rejected"] as const;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOwnProvider();
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const existing = await prisma.listing.findUnique({ where: { id } });
  if (!existing || existing.providerId !== auth.provider.id) {
    return privateJson({ error: "Listing not found" }, { status: 404 });
  }
  if (!EDITABLE_STATUSES.includes(existing.status as (typeof EDITABLE_STATUSES)[number])) {
    return NextResponse.json(
      { error: "This listing is published and can no longer be edited here" },
      { status: 409 },
    );
  }

  const parsed = providerUpdateListingSchema.safeParse(await req.json());
  if (!parsed.success) return privateJson({ error: parsed.error.flatten() }, { status: 400 });

  const { attributes, ...rest } = parsed.data;
  const listing = await prisma.listing.update({
    where: { id },
    data: {
      ...rest,
      ...(attributes ? { attributes: attributes as Prisma.InputJsonValue } : {}),
      // Any edit while rejected clears the now-stale reason, whether or not
      // this request also moves status back to pending_review.
      ...(existing.status === "rejected" ? { rejectionReason: null } : {}),
    },
  });
  // The catalog read cache is keyed by tag, not by TTL alone — without
  // this, an edited price keeps serving stale until the 5-minute backstop.
  revalidateCatalog();
  return privateJson({ listing });
}
