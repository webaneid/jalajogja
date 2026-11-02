// Cron harian: bersihkan berkas Pengajuan Produsen (draf kedaluwarsa, ditolak/dibatalkan, foto pengajuan disetujui, objek yatim).
// Aturan & urutan aman: lib/producer-application-cleanup.server.ts. Pola sama dengan cleanup-resi: header `x-cron-secret`,
// kegagalan per tenant DILAPORKAN di respons (tidak senyap). Doc: docs/arsitektur-pengajuan-produsen.md § 13.
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { eq } from "drizzle-orm";
import { db, tenants } from "@jalajogja/db";
import { cleanupTenantApplications, emptyReport } from "@/lib/producer-application-cleanup.server";
import { pgErrorCode } from "@/lib/pg-error";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("x-cron-secret") ?? "";
  const same = !!secret && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!same) {                                                            // tanpa CRON_SECRET terkonfigurasi → selalu tolak
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const active = await db.select({ slug: tenants.slug }).from(tenants).where(eq(tenants.isActive, true));
  const total = emptyReport();
  const tenantsSkipped: string[] = [];          // tabel belum ada (migration 0092 belum jalan) / galat lain — dilaporkan
  const tenantsFailed: string[] = [];

  for (const t of active) {
    try {
      const r = await cleanupTenantApplications(t.slug);
      for (const k of Object.keys(total) as (keyof typeof total)[]) total[k] += r[k];
    } catch (e) {
      if (pgErrorCode(e) === "42P01") tenantsSkipped.push(t.slug);
      else { tenantsFailed.push(t.slug); console.error("[cleanup-pengajuan-produsen] tenant gagal:", t.slug, e instanceof Error ? e.message : "unknown"); }
    }
  }
  // Kegagalan harus "bising": 500 bila ada objek gagal dihapus / tenant gagal (curl -f di crontab ikut gagal, log cron berisi laporan)
  const hasFailure = total.failed > 0 || tenantsFailed.length > 0;
  return NextResponse.json({ ...total, tenantsSkipped, tenantsFailed }, { status: hasFailure ? 500 : 200 });
}
