import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createStorageClient } from "@/lib/storage/minio";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/components/provider/imageGallery";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { fileMatchesDeclaredType } from "@/lib/uploadValidation";

// Prefix under the shared MinIO bucket (see src/lib/storage/minio.ts) — not a
// literal separate bucket, same "from(prefix)" scoping the listing-images
// route uses. Object keys land at verification-docs/{userId}/{uuid}.{ext}.
const PREFIX = "verification-docs";

/**
 * Business registration / ID document upload for the corporate/provider/
 * regulator signup wizard's "verification" step (src/app/signup/page.tsx).
 * Reached after /api/auth/register + signIn already ran (see that step's
 * gating in the wizard), so there's a real session — but `allowUnverifiedEmail`
 * mirrors /api/onboarding itself: this can be reached before an emailed
 * verification code (if configured) has been confirmed, and there's no
 * reason a pending doc upload should be blocked on that.
 *
 * Reuses the same JPEG/PNG/WebP allowlist + magic-byte check as the listing
 * image upload route (src/app/api/provider/listings/images/route.ts) rather
 * than adding PDF support — a photo/scan of the document is enough for now,
 * and uploadValidation.ts has no PDF signature to check against.
 */
export async function POST(req: Request) {
  const user = await requireUser({ allowUnverifiedEmail: true });
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const limited = await enforceRateLimit(`verification-doc-upload:${user.id}`, RATE_LIMITS.mediaUpload);
  if (limited) return limited;

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

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

  const objectPath = `${user.id}/${crypto.randomUUID()}.${ext}`;
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
