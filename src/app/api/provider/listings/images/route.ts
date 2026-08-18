import { NextResponse } from "next/server";
import { requireOwnProvider } from "@/lib/providerAuth";
import { createStorageClient } from "@/lib/storage/minio";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/components/provider/imageGallery";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { fileMatchesDeclaredType } from "@/lib/uploadValidation";

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
  // `file.type` above is the Content-Type the client put on the multipart
  // part — a claim, not a fact. This checks the bytes actually begin with a
  // signature for that type, so arbitrary content cannot be uploaded under an
  // image label into a public bucket served from our own domain.
  if (!(await fileMatchesDeclaredType(file))) {
    return NextResponse.json({ error: "That file isn't a valid JPEG, PNG, or WebP image" }, { status: 400 });
  }

  let admin: ReturnType<typeof createStorageClient>;
  try {
    admin = createStorageClient();
  } catch {
    return NextResponse.json(
      { error: "Image uploads aren't configured yet — ask an admin to finish the MinIO setup." },
      { status: 503 },
    );
  }

  const objectPath = `${auth.provider.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(objectPath, await file.arrayBuffer(), { contentType: file.type, upsert: false });

  if (error) {
    const message = /bucket/i.test(error.name) || /bucket/i.test(error.message)
      ? "Image storage isn't set up yet — ask an admin to check the MinIO bucket."
      : "Upload failed — please try again.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const { data } = admin.storage.from(BUCKET).getPublicUrl(objectPath);
  return NextResponse.json({ url: data.publicUrl });
}
