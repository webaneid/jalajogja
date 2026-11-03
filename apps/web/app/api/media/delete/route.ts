export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession, getTenantAccess } from "@/lib/tenant";
import { createTenantDb } from "@jalajogja/db";
import { hasFullAccess } from "@/lib/permissions";
import { deleteFile } from "@/lib/minio";
import { eq, sql } from "drizzle-orm";

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

  // Matriks izin Media (CLAUDE.md): hapus hanya owner/admin (akses penuh modul media) — editor/viewer tidak. Sebelumnya tidak dicek.
  if (!hasFullAccess(access.tenantUser, "media")) {
    return NextResponse.json({ error: "Anda tidak punya izin menghapus file." }, { status: 403 });
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mediaId)) {
    return NextResponse.json({ error: "id tidak valid" }, { status: 400 });
  }

  const { db: tenantDb, schema } = createTenantDb(slug);

  // Bukti transfer pencairan produsen (dan bukti pelunasan hutang) TIDAK boleh dihapus — dasar pembukuan & dilihat produsen.
  const [proofUse] = await tenantDb.select({ id: schema.producerPayouts.id }).from(schema.producerPayouts).where(eq(schema.producerPayouts.proofMediaId, mediaId)).limit(1);
  const [repayUse] = await tenantDb.select({ id: schema.producerLedgerEntries.id }).from(schema.producerLedgerEntries).where(sql`${schema.producerLedgerEntries.meta}->>'proofMediaId' = ${mediaId}`).limit(1);
  if (proofUse || repayUse) {
    return NextResponse.json({ error: "File ini adalah bukti transfer pencairan produsen dan tidak bisa dihapus." }, { status: 409 });
  }

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
