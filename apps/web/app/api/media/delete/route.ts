import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession, getTenantAccess } from "@/lib/tenant";
import { createTenantDb } from "@jalajogja/db";
import { deleteFile } from "@/lib/minio";
import { eq } from "drizzle-orm";

export async function DELETE(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const slug    = req.nextUrl.searchParams.get("tenant");
  const mediaId = req.nextUrl.searchParams.get("id");

  if (!slug || !mediaId) {
    return NextResponse.json({ error: "tenant dan id required" }, { status: 400 });
  }

  const access = await getTenantAccess(slug);
  if (!access) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { db: tenantDb, schema } = createTenantDb(slug);

  const [media] = await tenantDb
    .select({ path: schema.media.path, variants: schema.media.variants })
    .from(schema.media)
    .where(eq(schema.media.id, mediaId))
    .limit(1);

  if (!media) {
    return NextResponse.json({ error: "File tidak ditemukan" }, { status: 404 });
  }

  // Hapus semua variant dari MinIO — jika ada; fallback ke path tunggal untuk media lama
  const pathsToDelete = media.variants
    ? (Object.values(media.variants).filter(Boolean) as string[])
    : [media.path];

  await Promise.allSettled(pathsToDelete.map(p => deleteFile(slug, p)));

  await tenantDb.delete(schema.media).where(eq(schema.media.id, mediaId));

  return NextResponse.json({ success: true });
}
