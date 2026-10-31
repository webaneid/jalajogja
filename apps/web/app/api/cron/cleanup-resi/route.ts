// Hapus otomatis foto bukti pengiriman (resi) produsen 30 hari setelah tanggal kirim. NOMOR RESI tetap tersimpan —
// hanya foto (file di MinIO + baris public.member_media purpose='resi') yang dihapus dan rujukan di pengiriman dikosongkan.
// Pola sama dengan cleanup-images: header x-cron-secret, dijalankan harian lewat crontab VPS. Doc: arsitektur-portal-produsen.md § 19.12.
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { db, createTenantDb, tenants, memberMedia } from "@jalajogja/db";
import { deleteFile } from "@/lib/minio";

const PROOF_DAYS = 30;
const BATCH_LIMIT = 200; // per tenant per jalan; sisanya diproses jalan berikutnya

export async function GET(request: NextRequest) {
  if (request.headers.get("x-cron-secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - PROOF_DAYS * 86_400_000);
  const active = await db.select({ slug: tenants.slug }).from(tenants).where(eq(tenants.isActive, true));

  let deleted = 0;
  let failed = 0;
  const tenantsSkipped: string[] = []; // tenant yang querynya gagal — dilaporkan di respons agar kegagalan TIDAK senyap

  for (const t of active) {
    try {
      const { db: tdb, schema } = createTenantDb(t.slug);
      const L = schema.invoiceShippingLines;
      const due = await tdb.select({ id: L.id, path: L.trackingProofPath, mediaId: L.trackingProofMediaId }).from(L)
        // shipped_at bisa NULL (pengiriman yang di-shipped lewat jalur admin lama) → cadangan ke updated_at agar foto tetap terhapus
        .where(and(isNotNull(L.trackingProofPath), sql`coalesce(${L.shippedAt}, ${L.updatedAt}) <= ${cutoff.toISOString()}::timestamptz`))
        .limit(BATCH_LIMIT);
      if (due.length === 0) continue;

      for (const line of due) {
        try {
          if (line.path) await deleteFile(t.slug, line.path);
          if (line.mediaId) await db.delete(memberMedia).where(and(eq(memberMedia.id, line.mediaId), eq(memberMedia.purpose, "resi")));
          await tdb.update(L).set({ trackingProofPath: null, trackingProofMediaId: null, updatedAt: new Date() }).where(eq(L.id, line.id));
          deleted++;
        } catch (e) {
          failed++;
          console.error("[cleanup-resi] gagal untuk baris", line.id, e);
        }
      }
    } catch (e) {
      // Tenant tanpa kolom/tabel (migration belum jalan) tidak boleh menghentikan tenant lain
      tenantsSkipped.push(t.slug);
      console.error("[cleanup-resi] tenant dilewati:", t.slug, e);
    }
  }

  return NextResponse.json({ deleted, failed, tenantsSkipped });
}
