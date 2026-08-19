import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createStorageClient } from "@/lib/storage/minio";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/components/provider/imageGallery";
import { enforceRateLimit, clientKey, RATE_LIMITS } from "@/lib/rateLimit";
import { fileMatchesDeclaredType } from "@/lib/uploadValidation";

// Prefix under the shared MinIO bucket (see src/lib/storage/minio.ts) — not a
// literal separate bucket, same "from(prefix)" scoping the listing-images
// route uses. Object keys land at verification-docs/{userId}/{uuid}.{ext}
// once authenticated, or verification-docs/draft-{draftId}/{uuid}.{ext}
// before that (see draftId below).
const PREFIX = "verification-docs";

// Client-generated (crypto.randomUUID()) once per signup attempt — see the
// comment on draftIdRef in src/app/signup/page.tsx. Validated against a
// narrow charset since it becomes part of an object key.
const DRAFT_ID_PATTERN = /^[a-zA-Z0-9-]{1,64}$/;

/**
 * Business registration / ID document upload for the corporate/provider/
 * regulator signup wizard's "verification" step (src/app/signup/page.tsx).
 *
 * Account creation for these three roles now happens only once the *entire*
 * application (org details/industry/applicationDetails/verification/
 * declarations) is filled in, from the "dataConsent" step's final submit —
 * so this route is reached pre-authentication, with no session and no user
 * id to scope the upload to yet. A client-supplied `draftId` (one per signup
 * attempt) takes the place of the userId in that case; once a session does
 * exist (any other caller, or a resumed session on this same route) the real
 * userId is used instead, same as before. `allowUnverifiedEmail` still
 * matters for the authenticated case: it mirrors /api/onboarding itself, so
 * this can be reached before an emailed verification code (if configured)
 * has been confirmed.
 *
 * Rate-limited by IP (like /api/auth/register) rather than requireUser()
 * alone now that an unauthenticated caller has no per-user budget to key
 * off; an authenticated caller still gets the original per-user key.
 *
 * Reuses the same JPEG/PNG/WebP allowlist + magic-byte check as the listing
 * image upload route (src/app/api/provider/listings/images/route.ts) rather
 * than adding PDF support — a photo/scan of the document is enough for now,
 * and uploadValidation.ts has no PDF signature to check against.
 */
export async function POST(req: Request) {
  const user = await requireUser({ allowUnverifiedEmail: true });

  const limited = user
    ? await enforceRateLimit(`verification-doc-upload:${user.id}`, RATE_LIMITS.mediaUpload)
    : await enforceRateLimit(`verification-doc-upload:${clientKey(req)}`, RATE_LIMITS.mediaUpload);
  if (limited) return limited;

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const draftIdRaw = formData.get("draftId");
  const draftId = typeof draftIdRaw === "string" && DRAFT_ID_PATTERN.test(draftIdRaw) ? draftIdRaw : null;
  if (!user && !draftId) {
    return NextResponse.json({ error: "Missing draftId" }, { status: 400 });
  }
  // Prefer the real userId whenever a session exists, even if a (now
  // meaningless) draftId was also sent — a signed-in caller always has a
  // stable id to scope under.
  const scope = user ? user.id : `draft-${draftId}`;

  const ext = ALLOWED_IMAGE_TYPES[file.type];
  if (!ext) {
    return NextResponse.json({ error: "Only JPEG, PNG, or WebP images are allowed" }, { status: 400 });
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "File must be 5MB or smaller" }, { status: 400 });
  }
  // `file.type` is the Content-Type the client declared, not a fact about the
  // bytes — same check the listing-images route runs, so a mislabeled upload
  // can't land in storage served from our own domain.
  if (!(await fileMatchesDeclaredType(file))) {
    return NextResponse.json({ error: "That file isn't a valid JPEG, PNG, or WebP image" }, { status: 400 });
  }

  let admin: ReturnType<typeof createStorageClient>;
  try {
    admin = createStorageClient();
  } catch {
    return NextResponse.json(
      { error: "Document uploads aren't configured yet — ask an admin to finish the MinIO setup." },
      { status: 503 },
    );
  }

  const objectPath = `${scope}/${crypto.randomUUID()}.${ext}`;
  const { error } = await admin.storage
    .from(PREFIX)
    .upload(objectPath, await file.arrayBuffer(), { contentType: file.type, upsert: false });

  if (error) {
    const message = /bucket/i.test(error.name) || /bucket/i.test(error.message)
      ? "Document storage isn't set up yet — ask an admin to check the MinIO bucket."
      : "Upload failed — please try again.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const { data } = admin.storage.from(PREFIX).getPublicUrl(objectPath);
  return NextResponse.json({ url: data.publicUrl });
}
