// Portal Produsen S4 — isi nomor resi + foto resi → status Dikemas → Dikirim. Doc: docs/arsitektur-portal-produsen.md § 19.10.
// Route handler (bukan Server Action) karena Server Action dibatasi body 1 MB. Jaminan keamanan sama dengan aksi batch:
// getProducerAccess (sesi) → Origin → validasi → kepemilikan lewat loader → compare-and-set di DB. File diproses ulang
// lewat Sharp (format dibaca dari ISI file, bukan file.type), EXIF dibuang, nama randomUUID().
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { and, eq, inArray } from "drizzle-orm";
import { createTenantDb } from "@jalajogja/db";
import { getProducerAccess } from "@/lib/producer-access.server";
import { getProducerOrdersByIds } from "@/lib/producer-orders.server";
import { isValidUuid } from "@/lib/is-uuid";
import { uploadFile, deleteFile, ensureBucket } from "@/lib/minio";
import { notifyWa, waAppUrl } from "@/lib/wa-notify";
import { checkRateLimit } from "@/lib/rate-limit";

const MAX_SIZE = 8 * 1024 * 1024;
const RESI_RE = /^[A-Za-z0-9][A-Za-z0-9._\/ -]{2,39}$/;
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp", "heif"]);
const MAX_PIXELS = 25_000_000; // foto HP 12 MP sudah cukup; batasi beban Sharp
const MAX_BODY = MAX_SIZE + 1024 * 1024; // + overhead field multipart

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function POST(req: NextRequest) {
  // CSRF: asal permintaan harus host kita sendiri. Origin ATAU Referer wajib ada (POST dari browser selalu menyertakan salah satunya);
  // cookie sesi juga SameSite=Lax (default Better Auth) sebagai lapis kedua.
  const host = req.headers.get("host");
  const from = req.headers.get("origin") ?? req.headers.get("referer");
  if (!from) return fail("Permintaan ditolak.", 403);
  try { if (new URL(from).host !== host) return fail("Permintaan ditolak.", 403); } catch { return fail("Permintaan ditolak.", 403); }

  // Autentikasi SEBELUM body dibaca (cegah non-produsen memaksa server mem-buffer body besar). slug lewat query string.
  const slug = req.nextUrl.searchParams.get("tenant") ?? "";
  const access = slug ? await getProducerAccess(slug) : null;
  if (!access) return fail("Akses ditolak.", 403);

  // Pembatas laju per akun: 20 permintaan / 10 menit (tiap permintaan memicu dekode Sharp + upload)
  const rl = checkRateLimit(`produsen-resi:${access.userId}`, 20, 10 * 60_000);
  if (!rl.allowed) return fail("Terlalu banyak percobaan. Coba lagi beberapa menit lagi.", 429);

  // Ukuran dari Content-Length dicek sebelum formData() mem-buffer body
  const len = Number(req.headers.get("content-length") ?? "");
  if (!Number.isFinite(len) || len <= 0) return fail("Ukuran permintaan tidak diketahui.", 411);
  if (len > MAX_BODY) return fail("Ukuran foto maksimal 8 MB.", 413);

  let form: FormData;
  try { form = await req.formData(); } catch { return fail("Data tidak valid.", 400); }

  const batchId = String(form.get("batchId") ?? "");
  const invoiceId = String(form.get("invoiceId") ?? "");
  const resi = String(form.get("trackingNumber") ?? "").trim();
  const file = form.get("file");
  if (!isValidUuid(batchId) || !isValidUuid(invoiceId)) return fail("Data tidak valid.", 400);
  if (!RESI_RE.test(resi)) return fail("Nomor resi 3–40 karakter (huruf, angka, titik, strip, garis miring).", 400);
  if (!(file instanceof File) || file.size === 0) return fail("Foto resi wajib diunggah.", 400);
  if (file.size > MAX_SIZE) return fail("Ukuran foto maksimal 8 MB.", 400);

  const tenantDb = createTenantDb(access.tenant.slug);
  const { db, schema } = tenantDb;

  // Kepemilikan: batch milik produsen sesi → invoice ada di batch itu → invoice lunas & memuat item produsen → status Dikemas
  const [batch] = await db.select({ id: schema.producerShipmentBatches.id }).from(schema.producerShipmentBatches)
    .where(and(eq(schema.producerShipmentBatches.id, batchId), eq(schema.producerShipmentBatches.producerId, access.producer.id))).limit(1);
  if (!batch) return fail("Batch tidak ditemukan.", 404);
  const [link] = await db.select({ id: schema.producerShipmentInvoices.id }).from(schema.producerShipmentInvoices)
    .where(and(eq(schema.producerShipmentInvoices.batchId, batchId), eq(schema.producerShipmentInvoices.invoiceId, invoiceId))).limit(1);
  if (!link) return fail("Pesanan tidak ada di batch ini.", 404);
  const [order] = await getProducerOrdersByIds(tenantDb, access.producer.id, [invoiceId]);
  if (!order) return fail("Pesanan tidak ditemukan.", 404);
  if (order.status !== "packed") return fail("Resi hanya bisa diisi untuk pesanan berstatus Dikemas.", 409);
  if (order.isMixed || order.deliveryMethod === "pickup") return fail("Pesanan ini tidak dikirim oleh produsen.", 409); // lapis kedua; isBatchable sudah menjaga di aksi batch

  // Proses gambar: format dari ISI file, buang EXIF, maks 1600 px
  let webp: Buffer;
  try {
    const input = Buffer.from(await file.arrayBuffer());
    const meta = await sharp(input, { limitInputPixels: MAX_PIXELS }).metadata();
    if (!meta.format || !ALLOWED_FORMATS.has(meta.format)) return fail("Format foto tidak didukung. Gunakan JPG, PNG, WebP, atau HEIC.", 400);
    webp = await sharp(input, { limitInputPixels: MAX_PIXELS })
      .rotate()                                   // hormati orientasi EXIF sebelum EXIF dibuang
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
  } catch {
    return fail("Foto tidak bisa diproses. Coba foto lain (JPG/PNG).", 400);
  }

  const now = new Date();
  const key = `produsen/resi/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${randomUUID()}.webp`;
  try {
    await ensureBucket(access.tenant.slug);
    await uploadFile(access.tenant.slug, key, webp, "image/webp");
  } catch (e) {
    console.error("[produsen-resi] upload:", e);
    return fail("Gagal menyimpan foto.", 500);
  }

  let committed = false;
  try {
    // Compare-and-set: hanya bila MASIH Dikemas dan invoice MASIH lunas (cek di UPDATE yang sama)
    const upd = await db.update(schema.invoiceShippingLines)
      .set({ status: "shipped", trackingNumber: resi, trackingProofPath: key, shippedAt: new Date(), updatedAt: new Date() })
      .where(and(
        eq(schema.invoiceShippingLines.invoiceId, invoiceId),
        eq(schema.invoiceShippingLines.sellerType, "tenant"),
        eq(schema.invoiceShippingLines.status, "packed"),
        inArray(schema.invoiceShippingLines.invoiceId,
          db.select({ id: schema.invoices.id }).from(schema.invoices)
            .where(and(eq(schema.invoices.id, invoiceId), eq(schema.invoices.status, "paid")))),
      ))
      .returning({ courier: schema.invoiceShippingLines.courier });
    if (upd.length === 0) {
      await deleteFile(access.tenant.slug, key).catch((e) => console.error("[produsen-resi] hapus file yatim gagal:", key, e));
      return fail("Status pesanan berubah. Muat ulang halaman.", 409);
    }

    committed = true; // setelah ini file DIRUJUK database — jangan pernah dihapus lagi

    // Notifikasi "Dikirim" ke pelanggan — sama dengan jalur admin (mengikuti pengaturan notifikasi tenant)
    const slugT = access.tenant.slug;
    void (async () => {
      try {
        const [inv] = await db.select({ email: schema.invoices.customerEmail }).from(schema.invoices).where(eq(schema.invoices.id, invoiceId)).limit(1);
        const trackingUrl = await waAppUrl(slugT, `/invoice/${invoiceId}`);
        void notifyWa({
          slug: slugT, tenantDb, event: "order_shipped", phone: order.customerPhone, email: inv?.email ?? null,
          vars: { name: order.customerName, orderNumber: order.invoiceNumber, courier: (upd[0].courier ?? "").toUpperCase(), trackingNumber: resi, trackingUrl },
        });
      } catch { /* notifikasi tak boleh menggagalkan aksi */ }
    })();

    try {
      const base = `/app/${slug}/portal-produsen`;
      revalidatePath(`${base}/pengiriman`);
      revalidatePath(`${base}/pengiriman/${batchId}`);
      revalidatePath(`${base}/pesanan`);
    } catch (e) { console.error("[produsen-resi] revalidate:", e); }
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (!committed) await deleteFile(access.tenant.slug, key).catch((err) => console.error("[produsen-resi] hapus file yatim gagal:", key, err));
    console.error("[produsen-resi] db:", e);
    return fail("Gagal menyimpan resi.", 500);
  }
}
