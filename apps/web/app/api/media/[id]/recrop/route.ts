export const dynamic = "force-dynamic";
// POST /api/media/[id]/recrop?slug={tenant}
// Re-generate variant gambar dengan koordinat crop manual
// Koordinat dalam persen (0–100) relatif terhadap gambar original

import { NextRequest, NextResponse } from "next/server";
import { getTenantAccess } from "@/lib/tenant";
import { createTenantDb } from "@jalajogja/db";
import { getFile, uploadFile, publicUrl } from "@/lib/minio";
import { processVariant, getVariantsForModule, type VariantKey } from "@/lib/image-processor";
import { eq } from "drizzle-orm";
import type { CropData } from "@jalajogja/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: mediaId } = await params;
  const slug = request.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug diperlukan" }, { status: 400 });

  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as { cropData: CropData };
  const { cropData } = body;
  if (!cropData || typeof cropData.x !== "number") {
    return NextResponse.json({ error: "cropData tidak valid" }, { status: 400 });
  }

  const { db: tenantDb, schema } = createTenantDb(slug);

  // Fetch media row
  const [media] = await tenantDb
    .select()
    .from(schema.media)
    .where(eq(schema.media.id, mediaId))
    .limit(1);

  if (!media) return NextResponse.json({ error: "Media tidak ditemukan" }, { status: 404 });

  // Butuh file original untuk re-crop
  const originalPath = (media.variants as Record<string, string> | null)?.original;
  if (!originalPath) {
    return NextResponse.json(
      { error: "File original tidak tersedia (sudah dihapus cron >10 hari). Upload ulang untuk mengaktifkan crop manual." },
      { status: 409 },
    );
  }

  // Fetch original dari MinIO
  const originalBuffer = await getFile(slug, originalPath);

  // Tentukan variant yang perlu di-recrop
  const module       = media.module ?? "general";
  const moduleKeys   = getVariantsForModule(module);
  const targetKeys: VariantKey[] = cropData.variant === "all"
    ? moduleKeys.filter((k) => k !== "original")
    : ([cropData.variant] as VariantKey[]).filter((k) => moduleKeys.includes(k));

  const crop = { x: cropData.x, y: cropData.y, width: cropData.width, height: cropData.height };

  // Re-generate dan re-upload variant yang dipilih
  const updatedVariants = { ...(media.variants as Record<string, string> | null ?? {}) };

  await Promise.all(
    targetKeys.map(async (key) => {
      // processVariant() sendiri yang menentukan: soft-scale (large/medium/thumbnail) selalu
      // proporsional (crop diabaikan), hard-crop (square/square-large/profile) pakai crop manual.
      const buf  = await processVariant(originalBuffer, key, crop);
      const path = updatedVariants[key];
      if (path) await uploadFile(slug, path, buf, "image/webp");
    }),
  );

  // Simpan crop_data ke DB
  await tenantDb
    .update(schema.media)
    .set({ cropData: cropData as CropData })
    .where(eq(schema.media.id, mediaId));

  const resolvedVariants = Object.fromEntries(
    Object.entries(updatedVariants).map(([k, v]) => [k, publicUrl(slug, v)]),
  );

  return NextResponse.json({ success: true, variants: resolvedVariants });
}
