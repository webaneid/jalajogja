import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession, getTenantAccess } from "@/lib/tenant";
import { createTenantDb } from "@jalajogja/db";
import { uploadFile, deleteFile, ensureBucket, buildPath, publicUrl } from "@/lib/minio";
import { shouldBypass, processImage } from "@/lib/image-processor";
import { randomUUID } from "crypto";
import path from "path";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg":       "jpg",
  "image/png":        "png",
  "image/gif":        "gif",
  "image/webp":       "webp",
  "image/svg+xml":    "svg",
  "application/pdf":  "pdf",
  "video/mp4":        "mp4",
};

const MAX_SIZE = 20 * 1024 * 1024; // 20 MB

const VARIANT_SUFFIXES = {
  original:  "_ori",
  large:     "_lg",
  medium:    "_md",
  thumbnail: "_th",
  square:    "_sq",
  profile:   "_pf",
} as const;

export async function POST(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const slug   = req.nextUrl.searchParams.get("tenant");
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
    return NextResponse.json({ error: "Ukuran file maksimal 20 MB" }, { status: 400 });
  }

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return NextResponse.json({ error: "Tipe file tidak didukung" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const uuid   = randomUUID();
  await ensureBucket(slug);

  const { db: tenantDb, schema } = createTenantDb(slug);

  // ── Bypass: SVG dan non-gambar ─────────────────────────────────────────────
  if (shouldBypass(file.type) || !file.type.startsWith("image/")) {
    const filename = `${uuid}.${ext}`;
    const filePath = buildPath(module, filename);
    await uploadFile(slug, filePath, buffer, file.type);

    const [media] = await tenantDb.insert(schema.media).values({
      filename,
      originalName:     file.name,
      mimeType:         file.type,
      size:             file.size,
      path:             filePath,
      module:           module as "general" | "website" | "members" | "letters" | "shop",
      uploadedBy:       access.tenantUser.id,
      processingStatus: "bypass",
    }).returning();

    return NextResponse.json({
      id:           media.id,
      url:          publicUrl(slug, filePath),
      path:         filePath,
      filename,
      originalName: file.name,
      mimeType:     file.type,
      size:         file.size,
      variants:     null,
    });
  }

  // ── Pipeline gambar: generate 6 variant WebP ───────────────────────────────
  const variants = await processImage(buffer);

  // Upload semua variant — track yang berhasil untuk rollback jika gagal
  const now      = new Date();
  const basePath = `${module}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}`;

  const variantPaths: Record<string, string> = {};
  const uploadedPaths: string[] = [];

  try {
    await Promise.all(
      (Object.keys(variants) as Array<keyof typeof variants>).map(async (name) => {
        const filePath = `${basePath}/${uuid}${VARIANT_SUFFIXES[name]}.webp`;
        await uploadFile(slug, filePath, variants[name], "image/webp");
        variantPaths[name] = filePath;
        uploadedPaths.push(filePath);
      }),
    );
  } catch (err) {
    // Rollback: hapus variant yang sudah terupload
    await Promise.allSettled(uploadedPaths.map(p => deleteFile(slug, p)));
    console.error("Image upload pipeline failed:", err);
    return NextResponse.json({ error: "Gagal memproses gambar" }, { status: 500 });
  }

  const expiresAt  = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
  const largePath  = variantPaths.large;
  const filename   = path.basename(largePath);

  const [media] = await tenantDb.insert(schema.media).values({
    filename,
    originalName:        file.name,
    mimeType:            "image/webp",
    originalMime:        file.type,
    size:                variants.large.length,
    path:                largePath,
    module:              module as "general" | "website" | "members" | "letters" | "shop",
    uploadedBy:          access.tenantUser.id,
    variants:            variantPaths,
    processingStatus:    "done",
    originalExpiresAt:   expiresAt,
  }).returning();

  const resolvedVariants = Object.fromEntries(
    Object.entries(variantPaths).map(([k, v]) => [k, publicUrl(slug, v)]),
  );

  return NextResponse.json({
    id:           media.id,
    url:          publicUrl(slug, largePath),
    path:         largePath,
    filename,
    originalName: file.name,
    mimeType:     "image/webp",
    size:         variants.large.length,
    variants:     resolvedVariants,
  });
}
