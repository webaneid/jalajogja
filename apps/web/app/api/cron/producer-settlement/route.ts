// Sapuan harian penyelesaian pengiriman produsen → kredit saldo (docs/arsitektur-pencairan-produsen.md § 12, D2b).
// Menyelesaikan pengiriman yang sudah dikonfirmasi pembeli tetapi kreditnya belum terbit, dan yang dikirim > 10 hari tanpa konfirmasi.
// Autentikasi fail-closed + timing-safe (pola cleanup-pengajuan-produsen): tanpa CRON_SECRET terkonfigurasi → selalu tolak.
// Tenant yang querynya gagal DILAPORKAN di respons (bukan senyap).
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { eq } from "drizzle-orm";
import { db, createTenantDb, tenants, sweepProducerSettlements } from "@jalajogja/db";
import { pgErrorCode } from "@/lib/pg-error";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("x-cron-secret") ?? "";
  const same = !!secret && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!same) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const active = await db.select({ slug: tenants.slug }).from(tenants).where(eq(tenants.isActive, true));
  let completed = 0;
  const blocked: Record<string, number> = {};
  const tenantsSkipped: string[] = [];   // tabel/kolom belum ada (migration 0095 belum jalan)
  const tenantsFailed: string[] = [];

  for (const t of active) {
    try {
      const r = await sweepProducerSettlements(createTenantDb(t.slug));
      completed += r.completed;
      for (const [k, v] of Object.entries(r.blocked)) blocked[k] = (blocked[k] ?? 0) + v;
    } catch (e) {
      if (pgErrorCode(e) === "42P01" || pgErrorCode(e) === "42703") tenantsSkipped.push(t.slug);
      else { tenantsFailed.push(t.slug); console.error("[producer-settlement] gagal:", t.slug, e instanceof Error ? e.message : e); }
    }
  }
  return NextResponse.json({ completed, blocked, tenantsSkipped, tenantsFailed });
}
