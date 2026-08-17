import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/components/provider/imageGallery";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit";

const BUCKET = "listing-images";

// Admin-scoped counterpart to /api/provider/listings/images — same bucket
// and limits, but gated by requireAdmin() instead of provider ownership
// since an admin can add photos for any listing, not just their own.
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const limited = await enforceRateLimit(`admin-listing-image-upload:${admin.id}`, RATE_LIMITS.mediaUpload);
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
    return NextResponse.json({ error: "Image must be 5MB or smaller" }, { status: 400 });
  }

  let adminClient: ReturnType<typeof createAdminClient>;
  try {
    adminClient = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "Image uploads aren't configured yet — finish Supabase Storage setup." },
      { status: 503 },
    );
  }

  const objectPath = `admin/${crypto.randomUUID()}.${ext}`;
  const { error } = await adminClient.storage
    .from(BUCKET)
    .upload(objectPath, await file.arrayBuffer(), { contentType: file.type, upsert: false });

  if (error) {
    const message = /bucket/i.test(error.message)
      ? "Image storage isn't set up yet — run the Storage setup script."
      : "Upload failed — please try again.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const { data } = adminClient.storage.from(BUCKET).getPublicUrl(objectPath);
  return NextResponse.json({ url: data.publicUrl });
}
