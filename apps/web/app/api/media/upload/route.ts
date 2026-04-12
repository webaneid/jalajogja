import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession, getTenantAccess } from "@/lib/tenant";
import { createTenantDb } from "@jalajogja/db";
import { uploadFile, ensureBucket, buildPath, publicUrl } from "@/lib/minio";
import { randomUUID } from "crypto";
import path from "path";

// Tipe MIME yang diizinkan
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "application/pdf": "pdf",
  "video/mp4": "mp4",
};

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const slug = req.nextUrl.searchParams.get("tenant");
  const module = req.nextUrl.searchParams.get("module") ?? "general";

  if (!slug) {
    return NextResponse.json({ error: "tenant required" }, { status: 400 });
  }

  const access = await getTenantAccess(slug);
  if (!access) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Ukuran file maksimal 10 MB" }, { status: 400 });
  }

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return NextResponse.json({ error: "Tipe file tidak didukung" }, { status: 400 });
  }

  const filename = `${randomUUID()}.${ext}`;
  const filePath = buildPath(module, filename);
  const buffer = Buffer.from(await file.arrayBuffer());

  // Pastikan bucket ada
  await ensureBucket(slug);

  // Upload ke MinIO
  await uploadFile(slug, filePath, buffer, file.type);

  // Simpan metadata ke DB
  const { db: tenantDb, schema } = createTenantDb(slug);
  const [media] = await tenantDb
    .insert(schema.media)
    .values({
      filename,
      originalName: file.name,
      mimeType: file.type,
      size: file.size,
      path: filePath,
      module: module as "general" | "website" | "members" | "letters" | "shop",
      uploadedBy: access.tenantUser.id,
    })
    .returning();

  return NextResponse.json({
    id: media.id,
    url: publicUrl(slug, filePath),
    path: filePath,
    filename,
    originalName: file.name,
    mimeType: file.type,
    size: file.size,
  });
}
