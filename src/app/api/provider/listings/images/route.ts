import { NextResponse } from "next/server";
import { requireOwnProvider } from "@/lib/providerAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/components/provider/imageGallery";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit";

const BUCKET = "listing-images";

export async function POST(req: Request) {
  const auth = await requireOwnProvider();
  if ("response" in auth) return auth.response;

  const limited = await enforceRateLimit(`listing-image-upload:${auth.provider.id}`, RATE_LIMITS.mediaUpload);
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

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "Image uploads aren't configured yet — ask an admin to finish Supabase Storage setup." },
      { status: 503 },
    );
  }

  const objectPath = `${auth.provider.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(objectPath, await file.arrayBuffer(), { contentType: file.type, upsert: false });

  if (error) {
    const message = /bucket/i.test(error.message)
      ? "Image storage isn't set up yet — ask an admin to run the Storage setup script."
      : "Upload failed — please try again.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const { data } = admin.storage.from(BUCKET).getPublicUrl(objectPath);
  return NextResponse.json({ url: data.publicUrl });
}
