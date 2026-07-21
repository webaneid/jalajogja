import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// MinIO S3-compatible client — singleton
export const s3 = new S3Client({
  region: "us-east-1", // MinIO tidak peduli region, tapi SDK butuh nilai
  endpoint: `${process.env.MINIO_USE_SSL === "true" ? "https" : "http"}://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}`,
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY!,
    secretAccessKey: process.env.MINIO_SECRET_KEY!,
  },
  forcePathStyle: true, // wajib untuk MinIO (bukan virtual-hosted style)
});

// Nama bucket per tenant: "tenant-ikpm"
export function tenantBucket(slug: string) {
  return `tenant-${slug}`;
}

// Path di bucket: "general/2026/04/uuid.jpg"
export function buildPath(module: string, filename: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${module}/${year}/${month}/${filename}`;
}

// URL publik untuk serve file
export function publicUrl(slug: string, path: string): string {
  const base = process.env.MINIO_PUBLIC_URL ?? "http://localhost:9000";
  return `${base}/${tenantBucket(slug)}/${path}`;
}

// Upload buffer ke MinIO — kembalikan path di bucket
export async function uploadFile(
  slug: string,
  path: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: tenantBucket(slug),
      Key: path,
      Body: body,
      ContentType: contentType,
    }),
  );
}

// Ambil file dari MinIO sebagai Buffer — dipakai untuk re-crop
export async function getFile(slug: string, path: string): Promise<Buffer> {
  const res = await s3.send(
    new GetObjectCommand({ Bucket: tenantBucket(slug), Key: path }),
  );
  const chunks: Uint8Array[] = [];
  for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

// Hapus file dari MinIO
export async function deleteFile(slug: string, path: string): Promise<void> {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: tenantBucket(slug),
      Key: path,
    }),
  );
}

// Generate presigned URL untuk upload langsung dari browser (opsional, untuk file besar)
export async function presignedUploadUrl(
  slug: string,
  path: string,
  contentType: string,
  expiresIn = 300, // 5 menit
): Promise<string> {
  return getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: tenantBucket(slug),
      Key: path,
      ContentType: contentType,
    }),
    { expiresIn },
  );
}

// Resolve URL terbaik dari record media yang di-query langsung dari DB.
// media.variants menyimpan RELATIVE paths — wajib pakai publicUrl() sebelum dipakai sebagai src.
// preferOrder: urutan nama variant yang dicoba, fallback ke media.path.
export function resolveMediaUrl(
  slug: string,
  path: string,
  variants: Record<string, string> | null | undefined,
  preferOrder: string[] = ["large", "original"],
): string {
  if (variants) {
    for (const key of preferOrder) {
      if (variants[key]) return publicUrl(slug, variants[key]);
    }
  }
  return publicUrl(slug, path);
}

// Cek apakah bucket ada, kalau belum buat baru
import { CreateBucketCommand, HeadBucketCommand, PutBucketPolicyCommand } from "@aws-sdk/client-s3";

export async function ensureBucket(slug: string): Promise<void> {
  const bucket = tenantBucket(slug);
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    // Bucket belum ada — buat dan set public read
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
    const policy = JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: { AWS: ["*"] },
          Action: ["s3:GetObject"],
          Resource: [`arn:aws:s3:::${bucket}/*`],
        },
      ],
    });
    await s3.send(new PutBucketPolicyCommand({ Bucket: bucket, Policy: policy }));
  }
}

// ── Aset platform-level (bukan per-tenant) ───────────────────────────────────
// Dipakai untuk branding default IKPM (logo fallback) yang dikelola dari
// /platform/settings — terpisah total dari bucket tenant di atas.

const PLATFORM_BUCKET = "platform-assets";

export function platformPublicUrl(path: string): string {
  const base = process.env.MINIO_PUBLIC_URL ?? "http://localhost:9000";
  return `${base}/${PLATFORM_BUCKET}/${path}`;
}

export async function uploadPlatformFile(
  path: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: PLATFORM_BUCKET,
      Key: path,
      Body: body,
      ContentType: contentType,
    }),
  );
}

export async function ensurePlatformBucket(): Promise<void> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: PLATFORM_BUCKET }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: PLATFORM_BUCKET }));
    const policy = JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: { AWS: ["*"] },
          Action: ["s3:GetObject"],
          Resource: [`arn:aws:s3:::${PLATFORM_BUCKET}/*`],
        },
      ],
    });
    await s3.send(new PutBucketPolicyCommand({ Bucket: PLATFORM_BUCKET, Policy: policy }));
  }
}
