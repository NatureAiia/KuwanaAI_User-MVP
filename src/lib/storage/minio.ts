import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

/**
 * Self-hosted MinIO (S3-compatible) client — replaces the Supabase Storage
 * admin client (src/lib/supabase/admin.ts, now removed). Used for
 * server-only writes; requireAdmin()/requireOwnProvider() remain the actual
 * authorization boundary, same as before (MinIO itself enforces nothing
 * about who is allowed to call this module).
 *
 * A single bucket (MINIO_BUCKET) holds everything, with `from(prefix)`
 * scoping object keys under `${prefix}/...` the way the old code scoped
 * calls to a Supabase Storage *bucket* per image type (`listing-images`,
 * `advert-images`) — one real bucket is simpler to provision (one
 * public-read policy to set up) than several, and every call site below
 * only needed bucket-shaped scoping, not actual bucket isolation.
 *
 * Never import this from a "use client" file.
 */
export function createStorageClient() {
  const endpoint = requireEnv("MINIO_ENDPOINT");
  const accessKeyId = requireEnv("MINIO_ACCESS_KEY");
  const secretAccessKey = requireEnv("MINIO_SECRET_KEY");
  const bucket = requireEnv("MINIO_BUCKET");
  // The public, browser-facing base URL objects are served from — usually a
  // different host than MINIO_ENDPOINT (an internal/cluster-local address
  // the S3 SDK talks to). Falls back to MINIO_ENDPOINT for a single-host
  // local/dev setup where both happen to be the same reachable address.
  const publicUrl = (process.env.MINIO_PUBLIC_URL ?? endpoint).replace(/\/+$/, "");

  const client = new S3Client({
    endpoint,
    region: process.env.MINIO_REGION || "us-east-1",
    // MinIO (and most non-AWS S3-compatible stores) only supports
    // path-style addressing (`endpoint/bucket/key`), not AWS's
    // virtual-hosted-style (`bucket.endpoint/key`).
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  });

  return {
    storage: {
      from(prefix: string) {
        return {
          async upload(
            objectPath: string,
            body: ArrayBuffer | Buffer,
            opts: { contentType: string; upsert?: boolean },
          ): Promise<{ error: (Error & { name: string }) | null }> {
            const key = `${prefix}/${objectPath}`;
            try {
              await client.send(
                new PutObjectCommand({
                  Bucket: bucket,
                  Key: key,
                  Body: Buffer.isBuffer(body) ? body : Buffer.from(body),
                  ContentType: opts.contentType,
                }),
              );
              return { error: null };
            } catch (err) {
              const error = err instanceof Error ? err : new Error("Upload failed");
              return { error: error as Error & { name: string } };
            }
          },
          getPublicUrl(objectPath: string): { data: { publicUrl: string } } {
            const key = `${prefix}/${objectPath}`;
            return { data: { publicUrl: `${publicUrl}/${bucket}/${key}` } };
          },
        };
      },
    },
  };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing MinIO environment variable: ${name}`);
  }
  return value;
}
