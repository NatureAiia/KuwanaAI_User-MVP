import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/components/provider/imageGallery";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { fileMatchesDeclaredType } from "@/lib/uploadValidation";

const BUCKET = "advert-images";

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorised" }, { status: 403 });

  const limited = await enforceRateLimit(`admin-advert-image-upload:${admin.id}`, RATE_LIMITS.mediaUpload);
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
  // See the provider route: file.type is a client claim, so verify the bytes.
  if (!(await fileMatchesDeclaredType(file))) {
    return NextResponse.json({ error: "That file isn't a valid JPEG, PNG, or WebP image" }, { status: 400 });
  }

  let storage: ReturnType<typeof createAdminClient>;
  try {
    storage = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "Image uploads aren't configured yet — ask an admin to finish Supabase Storage setup." },
      { status: 503 },
    );
  }

  const objectPath = `${crypto.randomUUID()}.${ext}`;
  const { error } = await storage.storage
    .from(BUCKET)
    .upload(objectPath, await file.arrayBuffer(), { contentType: file.type, upsert: false });

  if (error) {
    const message = /bucket/i.test(error.message)
      ? "Image storage isn't set up yet — ask an admin to run the Storage setup script."
      : "Upload failed — please try again.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const { data } = storage.storage.from(BUCKET).getPublicUrl(objectPath);
  return NextResponse.json({ url: data.publicUrl });
}
