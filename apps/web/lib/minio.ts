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
