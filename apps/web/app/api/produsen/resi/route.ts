// Portal Produsen S4/S4b — nomor resi + foto resi. Doc: docs/arsitektur-portal-produsen.md § 19.10 & 19.12.
//  - status Dikemas (packed)  → BUAT: resi + foto wajib → Dikirim (shipped), notifikasi ke pelanggan.
//  - status Dikirim (shipped) → UBAH: resi dan/atau foto (minimal salah satu), tanpa notifikasi ulang. Ganti foto hanya
//    dalam 30 hari sejak tanggal kirim (foto dihapus otomatis setelah itu — cron cleanup-resi).
//  - status Diterima (delivered) → terkunci.
// Foto disimpan di Media Library ANGGOTA (public.member_media, purpose='resi') milik anggota-pemilik produsen — satu folder
// per produsen: akun/{memberId}/YYYY/MM/uuid_resi.webp. Hanya hasil WebP yang disimpan (file asli tidak pernah ditulis).
// Route handler (bukan Server Action) karena Server Action dibatasi body 1 MB. Urutan jaminan: Origin/Referer → getProducerAccess
// (sesi, SEBELUM body dibaca) → rate limit → Content-Length → validasi → kepemilikan lewat loader → compare-and-set di DB.
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { createTenantDb, db as publicDb, memberMedia } from "@jalajogja/db";
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
const PROOF_DAYS = 30; // masa simpan foto resi sejak tanggal kirim

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
  const resiInput = String(form.get("trackingNumber") ?? "").trim();
  const fileRaw = form.get("file");
  const file = fileRaw instanceof File && fileRaw.size > 0 ? fileRaw : null;
  if (!isValidUuid(batchId) || !isValidUuid(invoiceId)) return fail("Data tidak valid.", 400);
  if (resiInput && !RESI_RE.test(resiInput)) return fail("Nomor resi 3–40 karakter (huruf, angka, titik, strip, garis miring).", 400);
  if (file && file.size > MAX_SIZE) return fail("Ukuran foto maksimal 8 MB.", 400);

  const tenantDb = createTenantDb(access.tenant.slug);
  const { db, schema } = tenantDb;
  const tenantSlug = access.tenant.slug;

  // Kepemilikan: batch milik produsen sesi → invoice ada di batch itu → invoice lunas & memuat item produsen
  const [batch] = await db.select({ id: schema.producerShipmentBatches.id }).from(schema.producerShipmentBatches)
    .where(and(eq(schema.producerShipmentBatches.id, batchId), eq(schema.producerShipmentBatches.producerId, access.producer.id))).limit(1);
  if (!batch) return fail("Batch tidak ditemukan.", 404);
  const [link] = await db.select({ id: schema.producerShipmentInvoices.id }).from(schema.producerShipmentInvoices)
    .where(and(eq(schema.producerShipmentInvoices.batchId, batchId), eq(schema.producerShipmentInvoices.invoiceId, invoiceId))).limit(1);
  if (!link) return fail("Pesanan tidak ada di batch ini.", 404);
  const [order] = await getProducerOrdersByIds(tenantDb, access.producer.id, [invoiceId]);
  if (!order) return fail("Pesanan tidak ditemukan.", 404);
  if (order.isMixed || order.deliveryMethod === "pickup") return fail("Pesanan ini tidak dikirim oleh produsen.", 409); // lapis kedua; isBatchable sudah menjaga di aksi batch

  const mode = order.status === "packed" ? "create" : order.status === "shipped" ? "edit" : null;
  if (!mode) return fail(order.status === "delivered" ? "Pesanan sudah diterima pelanggan — data terkunci." : "Resi hanya bisa diisi untuk pesanan berstatus Dikemas.", 409);

  // Rujukan foto saat ini (untuk CAS & penghapusan foto lama)
  const [cur] = await db.select({
    path: schema.invoiceShippingLines.trackingProofPath, mediaId: schema.invoiceShippingLines.trackingProofMediaId,
    resi: schema.invoiceShippingLines.trackingNumber, shippedAt: schema.invoiceShippingLines.shippedAt, updatedAt: schema.invoiceShippingLines.updatedAt,
  }).from(schema.invoiceShippingLines)
    .where(and(eq(schema.invoiceShippingLines.invoiceId, invoiceId), eq(schema.invoiceShippingLines.sellerType, "tenant"))).limit(1);

  if (mode === "create") {
    if (!resiInput) return fail("Nomor resi wajib diisi.", 400);
    if (!file) return fail("Foto resi wajib diunggah.", 400);
  } else {
    if (!resiInput && !file) return fail("Tidak ada perubahan.", 400);
    const baseDate = cur?.shippedAt ?? cur?.updatedAt; // shipped_at bisa NULL pada data lama
    if (file && baseDate && Date.now() - baseDate.getTime() > PROOF_DAYS * 86_400_000) {
      return fail(`Foto resi sudah melewati masa simpan ${PROOF_DAYS} hari dan tidak bisa diganti.`, 409);
    }
  }

  // Proses gambar: format dari ISI file, buang EXIF, maks 1600 px, WebP. File asli tidak pernah disimpan.
  let webp: Buffer | null = null;
  if (file) {
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
  }

  // Simpan foto baru (file + baris Media Library anggota) — dibatalkan bila langkah DB berikutnya gagal
  let newKey: string | null = null;
  let newMediaId: string | null = null;
  const rollbackNew = async () => {
    if (newMediaId) await publicDb.delete(memberMedia).where(eq(memberMedia.id, newMediaId)).catch((e) => console.error("[produsen-resi] hapus baris media gagal:", newMediaId, e));
    if (newKey) await deleteFile(tenantSlug, newKey).catch((e) => console.error("[produsen-resi] hapus file yatim gagal:", newKey, e));
  };
  if (webp) {
    const now = new Date();
    const uuid = randomUUID();
    newKey = `akun/${access.producer.memberId}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${uuid}_resi.webp`;
    try {
      await ensureBucket(tenantSlug);
      await uploadFile(tenantSlug, newKey, webp, "image/webp");
      const [m] = await publicDb.insert(memberMedia).values({
        memberId: access.producer.memberId, sourceTenantSlug: tenantSlug,
        filename: `${uuid}_resi.webp`, originalName: `resi-${order.invoiceNumber}.webp`, // nama dibuat server, bukan nama file klien
        mimeType: "image/webp", size: webp.length, path: newKey, variants: null,
        processingStatus: "done", purpose: "resi",
      }).returning({ id: memberMedia.id });
      newMediaId = m.id;
    } catch (e) {
      console.error("[produsen-resi] simpan foto:", e);
      await rollbackNew();
      return fail("Gagal menyimpan foto.", 500);
    }
  }

  let committed = false;
  try {
    const L = schema.invoiceShippingLines;
    const paidOnly = inArray(L.invoiceId,
      db.select({ id: schema.invoices.id }).from(schema.invoices)
        .where(and(eq(schema.invoices.id, invoiceId), eq(schema.invoices.status, "paid"))));
    const set: Partial<typeof L.$inferInsert> = { updatedAt: new Date() };
    if (resiInput) set.trackingNumber = resiInput;
    if (newKey && newMediaId) { set.trackingProofPath = newKey; set.trackingProofMediaId = newMediaId; }

    let upd: { courier: string | null }[];
    if (mode === "create") {
      set.status = "shipped"; set.shippedAt = new Date();
      upd = await db.update(L).set(set)
        .where(and(eq(L.invoiceId, invoiceId), eq(L.sellerType, "tenant"), eq(L.status, "packed"), paidOnly))
        .returning({ courier: L.courier });
    } else {
      // Ganti foto: CAS juga menjaga bahwa media yang dirujuk masih yang kita baca (cegah dua edit saling menghapus)
      const sameProof = cur?.mediaId ? eq(L.trackingProofMediaId, cur.mediaId) : isNull(L.trackingProofMediaId);
      upd = await db.update(L).set(set)
        .where(and(eq(L.invoiceId, invoiceId), eq(L.sellerType, "tenant"), eq(L.status, "shipped"), paidOnly, newKey ? sameProof : undefined))
        .returning({ courier: L.courier });
    }
    if (upd.length === 0) {
      await rollbackNew();
      return fail("Status pesanan berubah. Muat ulang halaman.", 409);
    }
    committed = true; // setelah ini foto baru DIRUJUK database — jangan pernah dihapus lagi

    // Edit dengan foto baru → hapus foto lama (file + baris Media Library). Gagal hapus hanya di-log.
    if (mode === "edit" && newKey) {
      if (cur?.path) await deleteFile(tenantSlug, cur.path).catch((e) => console.error("[produsen-resi] hapus foto lama gagal:", cur.path, e));
      if (cur?.mediaId) await publicDb.delete(memberMedia).where(and(eq(memberMedia.id, cur.mediaId), eq(memberMedia.memberId, access.producer.memberId)))
        .catch((e) => console.error("[produsen-resi] hapus baris media lama gagal:", cur.mediaId, e));
    }

    // Notifikasi "Dikirim" ke pelanggan — hanya saat BUAT (edit tidak mengirim ulang), sama dengan jalur admin
    if (mode === "create") {
      void (async () => {
        try {
          const [inv] = await db.select({ email: schema.invoices.customerEmail }).from(schema.invoices).where(eq(schema.invoices.id, invoiceId)).limit(1);
          const trackingUrl = await waAppUrl(tenantSlug, `/invoice/${invoiceId}`);
          void notifyWa({
            slug: tenantSlug, tenantDb, event: "order_shipped", phone: order.customerPhone, email: inv?.email ?? null,
            vars: { name: order.customerName, orderNumber: order.invoiceNumber, courier: (upd[0].courier ?? "").toUpperCase(), trackingNumber: resiInput, trackingUrl },
          });
        } catch { /* notifikasi tak boleh menggagalkan aksi */ }
      })();
    }

    try {
      const base = `/app/${slug}/portal-produsen`;
      revalidatePath(`${base}/pengiriman`);
      revalidatePath(`${base}/pengiriman/${batchId}`);
      revalidatePath(`${base}/pesanan`);
    } catch (e) { console.error("[produsen-resi] revalidate:", e); }
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (!committed) await rollbackNew();
    console.error("[produsen-resi] db:", e);
    return fail("Gagal menyimpan resi.", 500);
  }
}
