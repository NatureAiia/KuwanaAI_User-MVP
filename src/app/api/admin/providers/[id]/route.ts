import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { privateJson } from "@/lib/apiResponse";
import { logAdminAction } from "@/lib/adminAudit";
import { revalidateCatalog } from "@/lib/cacheTags";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  logoUrl: z.string().url().nullable().optional(),
  websiteUrl: z.string().url().max(2000).nullable().optional(),
  verified: z.boolean().optional(),
  // Look up by email rather than accepting a raw userId — an admin knows
  // the provider contact's email, not their internal user id. Pass null to
  // unlink. Resolved to ownerUserId server-side below.
  ownerEmail: z.string().email().nullable().optional(),
  // Links every "corporate" role user whose email domain matches (e.g.
  // "cbz.co.zw") to this Provider — see requireOwnCorporateOrg(). Pass null
  // to unlink. Unlike ownerEmail this isn't resolved to a user id: it's
  // matched live, per-request, against whichever corporate accounts exist
  // now or sign up later on that domain.
  corporateDomain: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, "Must be a domain, e.g. cbz.co.zw")
    .nullable()
    .optional(),
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

  const { ownerEmail, corporateDomain, ...rest } = parsed.data;

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
      return privateJson(
        { error: `${ownerEmail} already owns another provider (${alreadyLinked.name})` },
        { status: 409 },
      );
    }
    ownerUserId = owner.id;
  }

  try {
    const provider = await prisma.provider.update({
      where: { id },
      data: {
        ...rest,
        ...(ownerUserId !== undefined ? { ownerUserId } : {}),
        ...(corporateDomain !== undefined ? { corporateDomain } : {}),
      },
    });

    // Name, logo and the `verified` badge are embedded in every ListingDTO,
    // so this changes what the cached catalog reads return even when no
    // listing was touched. The sibling POST /api/admin/providers already did
    // this; the edit path was missed.
    revalidateCatalog();

    if (ownerUserId !== undefined) {
      await logAdminAction({
        adminEmail: admin.email,
        action: ownerUserId ? "provider_linked" : "provider_unlinked",
        targetType: "provider",
        targetId: provider.id,
        detail: ownerUserId
          ? `Linked ${ownerEmail} to "${provider.name}"`
          : `Unlinked the owner account from "${provider.name}"`,
      });
    }

    if (corporateDomain !== undefined) {
      await logAdminAction({
        adminEmail: admin.email,
        action: "corporate_domain_linked",
        targetType: "provider",
        targetId: provider.id,
        detail: corporateDomain
          ? `Linked corporate domain ${corporateDomain} to "${provider.name}"`
          : `Unlinked the corporate domain from "${provider.name}"`,
      });
    }

    return privateJson({ provider });
  } catch (err) {
    // The alreadyLinked check above is a look-then-act race — two concurrent
    // requests linking different providers to the same email could both pass
    // it before either write commits. The unique constraint on ownerUserId
    // is the real guard; this just turns its violation into the same
    // friendly response the pre-check already gives in the common case,
    // instead of a raw 500.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return privateJson(
        {
          error: corporateDomain
            ? `${corporateDomain} is already linked to another provider — try again`
            : `${ownerEmail} already owns another provider — try again`,
        },
        { status: 409 },
      );
    }
    throw err;
  }
}
