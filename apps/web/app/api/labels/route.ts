// Cetak label pengiriman → PDF. Doc: docs/arsitektur-portal-produsen.md § 21.
// POST /api/labels?tenant={slug}   body: JSON { format, invoiceIds[] } ATAU form (format, invoiceIds = JSON/koma) — form dipakai
// tombol cetak yang membuka tab baru. Dua jalur akses (per slug hanya satu yang berlaku):
//   - admin tenant: getTenantAccess + minimal baca modul toko (mengubah status ke Dikemas hanya bila akses PENUH toko)
//   - produsen: getProducerAccess (hanya pesanannya sendiri; kelayakan diperiksa ulang per invoice di buildLabelData)
// Urutan: Origin/Referer → sesi/peran (SEBELUM body dibaca) → rate limit → Content-Length → validasi → data → PDF → status Dikemas.
// PDF dikirim sebagai respons, TIDAK disimpan (memuat nama/HP/alamat pembeli).
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { getProducerAccess } from "@/lib/producer-access.server";
import { canAccess, hasFullAccess } from "@/lib/permissions";
import { checkRateLimit } from "@/lib/rate-limit";
import { isValidUuid } from "@/lib/is-uuid";
import { isLabelFormat } from "@/lib/shipping-label/formats";
import { buildLabelData, markPackedAfterPrint, type LabelScope } from "@/lib/shipping-label/build.server";
import { renderLabelsPdf, LabelBusyError } from "@/lib/shipping-label/pdf.server";

const MAX_INVOICES = 100;
const MAX_BODY = 64 * 1024;

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function POST(req: NextRequest) {
  // CSRF: asal harus host kita; Origin ATAU Referer wajib ada (cookie sesi juga SameSite=Lax)
  const host = req.headers.get("host");
  const from = req.headers.get("origin") ?? req.headers.get("referer");
  if (!from) return fail("Permintaan ditolak.", 403);
  try { if (new URL(from).host !== host) return fail("Permintaan ditolak.", 403); } catch { return fail("Permintaan ditolak.", 403); }

  // Peran SEBELUM body dibaca
  const slug = req.nextUrl.searchParams.get("tenant") ?? "";
  if (!slug) return fail("Akses ditolak.", 403);
  let scope: LabelScope;
  let tenant: { id: string; name: string; tenantType: string | null; slug: string };
  let userKey: string;
  let canPack = false;

  const admin = await getTenantAccess(slug);
  if (admin) {
    if (!canAccess(admin.tenantUser, "toko", "read")) return fail("Akses ditolak.", 403);
    scope = { kind: "admin" };
    tenant = { id: admin.tenant.id, name: admin.tenant.name, tenantType: admin.tenant.tenantType, slug: admin.tenant.slug };
    userKey = `a:${admin.tenantUser.id}`;
    canPack = hasFullAccess(admin.tenantUser, "toko");
  } else {
    const prod = await getProducerAccess(slug);
    if (!prod) return fail("Akses ditolak.", 403);
    scope = { kind: "producer", producerId: prod.producer.id };
    tenant = { id: prod.tenant.id, name: prod.tenant.name, tenantType: prod.tenant.tenantType, slug: prod.tenant.slug };
    userKey = `p:${prod.userId}`;
    canPack = true; // produsen berotoritas penuh atas pesanan produknya (keputusan user)
  }

  const rl = checkRateLimit(`label:${userKey}`, 15, 5 * 60_000);
  if (!rl.allowed) return fail("Terlalu banyak cetak. Coba lagi beberapa menit lagi.", 429);

  const len = Number(req.headers.get("content-length") ?? "0");
  if (len > MAX_BODY) return fail("Permintaan terlalu besar.", 413);

  // Body: JSON atau form
  let format: unknown; let rawIds: unknown;
  try {
    if ((req.headers.get("content-type") ?? "").includes("application/json")) {
      const b = await req.json() as { format?: unknown; invoiceIds?: unknown };
      format = b.format; rawIds = b.invoiceIds;
    } else {
      const f = await req.formData();
      format = f.get("format");
      const v = String(f.get("invoiceIds") ?? "");
      try { rawIds = v.trim().startsWith("[") ? JSON.parse(v) : v.split(",").map((s) => s.trim()).filter(Boolean); } catch { rawIds = null; }
    }
  } catch { return fail("Data tidak valid.", 400); }

  if (!isLabelFormat(format)) return fail("Format cetak tidak dikenal.", 400);
  if (!Array.isArray(rawIds)) return fail("Pilih pesanan yang akan dicetak.", 400);
  if (rawIds.length > MAX_INVOICES) return fail(`Pilih 1–${MAX_INVOICES} pesanan.`, 400); // sebelum map(String) — tak memproses array raksasa
  const invoiceIds = [...new Set(rawIds.map((x) => String(x)))];
  if (invoiceIds.length === 0 || invoiceIds.length > MAX_INVOICES) return fail(`Pilih 1–${MAX_INVOICES} pesanan.`, 400);
  if (!invoiceIds.every(isValidUuid)) return fail("Data tidak valid.", 400);

  const tenantClient = createTenantDb(tenant.slug);
  let built;
  try {
    built = await buildLabelData(tenantClient, tenant, invoiceIds, scope);
  } catch (e) {
    console.error("[labels] buildLabelData:", e);
    return fail("Gagal menyiapkan data label.", 500);
  }
  if (!built.ok) return fail(built.error, 422);

  let pdf: Buffer;
  try {
    pdf = await renderLabelsPdf(built.labels, format);
  } catch (e) {
    if (e instanceof LabelBusyError) return fail("Server sedang mencetak untuk pengguna lain. Coba lagi sebentar.", 503);
    console.error("[labels] render PDF:", e);
    return fail("Gagal membuat PDF.", 500);
  }

  // Mencetak = mengemas: Diproses → Dikemas (hanya yang berstatus Diproses; gagal tidak membatalkan PDF)
  if (canPack) {
    try {
      const changed = await markPackedAfterPrint(tenantClient, invoiceIds);
      if (changed > 0) {
        for (const path of [`/app/${slug}/portal-produsen/pengiriman`, `/app/${slug}/portal-produsen/pesanan`, `/app/${slug}/toko/pesanan`]) revalidatePath(path);
      }
    } catch (e) { console.error("[labels] markPackedAfterPrint:", e); }
  }

  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="label-${format}-${stamp}.pdf"`,
      "Cache-Control": "no-store, private",
    },
  });
}
