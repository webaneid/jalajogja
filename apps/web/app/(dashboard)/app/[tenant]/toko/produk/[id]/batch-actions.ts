"use server";

// Buat Batch pengiriman masal oleh ADMIN atas nama produsen pemilik produk (keputusan user 2026-11-01).
// Otorisasi: getTenantAccess + hasFullAccess(toko). producerId dari input DIVERIFIKASI ke tabel produsen tenant (harus ada & aktif) —
// bukan dipercaya — lalu seluruh pekerjaan memakai inti bersama createBatchCore yang membuktikan lagi kepemilikan tiap invoice
// terhadap produsen itu (invoice produsen lain / campuran / ambil-sendiri / belum lunas → seluruh permintaan ditolak).
// Doc: docs/arsitektur-portal-produsen.md § 22.
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { hasFullAccess } from "@/lib/permissions";
import { isValidUuid } from "@/lib/is-uuid";
import { createBatchCore, type BatchInput, type Result } from "@/lib/producer-batch.server";

export async function createBatchAsAdminAction(
  slug: string,
  producerId: string,
  input: BatchInput,
): Promise<Result<{ batchId: string; name: string; count: number }>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "toko")) return { success: false, error: "Akses ditolak." };
  if (!isValidUuid(String(producerId ?? ""))) return { success: false, error: "Produsen tidak valid." };

  const tenantDb = createTenantDb(access.tenant.slug);
  const { db, schema } = tenantDb;
  const [producer] = await db.select({ id: schema.producers.id, isActive: schema.producers.isActive })
    .from(schema.producers).where(eq(schema.producers.id, producerId)).limit(1);
  if (!producer || !producer.isActive) return { success: false, error: "Produsen tidak ditemukan atau nonaktif." };

  const res = await createBatchCore(tenantDb, access.tenant.slug, producer.id, input);
  if (res.success) {
    // Batch terlihat di portal produsen; daftar pesanan admin berstatus Diproses
    for (const path of [`/app/${slug}/portal-produsen/pengiriman`, `/app/${slug}/portal-produsen/pesanan`, `/app/${slug}/toko/pesanan`]) revalidatePath(path);
  }
  return res;
}
