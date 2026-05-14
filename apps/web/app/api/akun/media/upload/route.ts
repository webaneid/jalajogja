export const dynamic = "force-dynamic";
import { NextRequest, NextResponse }                              from "next/server";
import { eq }                                                    from "drizzle-orm";
import { db, members }                                           from "@jalajogja/db";
import { createTenantDb }                                        from "@jalajogja/db";
import { auth }                                                  from "@/lib/auth";
import { uploadFile, deleteFile, ensureBucket, publicUrl }       from "@/lib/minio";
import { shouldBypass, processImage, getVariantsForModule, type VariantKey } from "@/lib/image-processor";
import { randomUUID } from "crypto";
import path from "path";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg":    "jpg",
  "image/png":     "png",
  "image/gif":     "gif",
  "image/webp":    "webp",
  "image/svg+xml": "svg",
};

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

const VARIANT_SUFFIXES: Record<VariantKey, string> = {
  original:       "_ori",
  large:          "_lg",
  medium:         "_md",
  thumbnail:      "_th",
  square:         "_sq",
  "square-large": "_sql",
  profile:        "_pf",
};

const PATH_PRIORITY: VariantKey[] = ["large", "square", "profile", "original"];

async function getSessionMember(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) return { error: "Login diperlukan.", status: 401 as const, member: null };
  const member = await db.query.members.findFirst({
    where: eq(members.betterAuthUserId, session.user.id),
    columns: { id: true },
  });
  if (!member) return { error: "Bukan anggota IKPM.", status: 403 as const, member: null };
  return { error: null, status: 200 as const, member };
}

export async function POST(req: NextRequest) {
  const { error, status, member } = await getSessionMember(req);
  if (error) return NextResponse.json({ error }, { status });

  const slug = req.nextUrl.searchParams.get("tenant");
  if (!slug) return NextResponse.json({ error: "tenant required" }, { status: 400 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "file required" }, { status: 400 });

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Ukuran file maksimal 10 MB" }, { status: 400 });
  }

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return NextResponse.json({ error: "Tipe file tidak didukung. Gunakan JPG, PNG, GIF, WebP, atau SVG." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const uuid   = randomUUID();
  await ensureBucket(slug);

  const { db: tenantDb, schema } = createTenantDb(slug);

  const now      = new Date();
  const yearMonth = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}`;
  const basePath  = `akun/${member!.id}/${yearMonth}`;

  // ── Bypass: SVG ─────────────────────────────────────────────────────────────
  if (shouldBypass(file.type)) {
    const filename = `${uuid}.${ext}`;
    const filePath = `${basePath}/${filename}`;
    await uploadFile(slug, filePath, buffer, file.type);

    const [media] = await tenantDb.insert(schema.media).values({
      filename,
      originalName:     file.name,
      mimeType:         file.type,
      size:             file.size,
      path:             filePath,
      module:           "akun",
      memberId:         member!.id,
      processingStatus: "bypass",
    }).returning();

    return NextResponse.json({
      id:       media.id,
      url:      publicUrl(slug, filePath),
      variants: null,
    });
  }

  // ── Pipeline gambar ──────────────────────────────────────────────────────────
  const allVariants = await processImage(buffer);
  const variantKeys = getVariantsForModule("akun");

  const variantPaths: Record<string, string> = {};
  const uploadedPaths: string[] = [];

  try {
    await Promise.all(
      variantKeys.map(async (name: VariantKey) => {
        const filePath = `${basePath}/${uuid}${VARIANT_SUFFIXES[name]}.webp`;
        await uploadFile(slug, filePath, allVariants[name], "image/webp");
        variantPaths[name] = filePath;
        uploadedPaths.push(filePath);
      }),
    );
  } catch (err) {
    await Promise.allSettled(uploadedPaths.map(p => deleteFile(slug, p)));
    console.error("Member image upload failed:", err);
    return NextResponse.json({ error: "Gagal memproses gambar" }, { status: 500 });
  }

  const primaryKey  = PATH_PRIORITY.find(k => variantPaths[k]) ?? variantKeys[0];
  const primaryPath = variantPaths[primaryKey];
  const filename    = path.basename(primaryPath);

  const [media] = await tenantDb.insert(schema.media).values({
    filename,
    originalName:      file.name,
    mimeType:          "image/webp",
    originalMime:      file.type,
    size:              allVariants[primaryKey].length,
    path:              primaryPath,
    module:            "akun",
    memberId:          member!.id,
    variants:          variantPaths,
    processingStatus:  "done",
    originalExpiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
  }).returning();

  const resolvedVariants = Object.fromEntries(
    Object.entries(variantPaths).map(([k, v]) => [k, publicUrl(slug, v)]),
  );

  return NextResponse.json({
    id:       media.id,
    url:      publicUrl(slug, primaryPath),
    variants: resolvedVariants,
  }, { status: 201 });
}
