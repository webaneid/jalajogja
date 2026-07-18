export const dynamic = "force-dynamic";
// POST /api/invoice/proof-upload?tenant=&invoiceId=
// Upload bukti transfer/QRIS — tidak perlu auth, cukup punya invoiceId
// File disimpan ke MinIO: payments/{invoiceId}/{uuid}.webp

import { NextRequest, NextResponse } from "next/server";
import { createTenantDb } from "@jalajogja/db";
import { eq } from "drizzle-orm";
import { uploadFile, ensureBucket, publicUrl } from "@/lib/minio";
import { randomUUID } from "crypto";
import sharp from "sharp";

const MAX_SIZE = 8 * 1024 * 1024; // 8 MB

export async function POST(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const slug      = searchParams.get("tenant")?.trim();
  const invoiceId = searchParams.get("invoiceId")?.trim();

  if (!slug || !invoiceId) {
    return NextResponse.json({ error: "tenant dan invoiceId wajib diisi" }, { status: 400 });
  }

  // Validasi invoice ada dan belum lunas/cancelled
  try {
    const { db, schema } = createTenantDb(slug);
    const [inv] = await db
      .select({ status: schema.invoices.status })
      .from(schema.invoices)
      .where(eq(schema.invoices.id, invoiceId))
      .limit(1);

    if (!inv) return NextResponse.json({ error: "Invoice tidak ditemukan" }, { status: 404 });
    if (inv.status === "paid" || inv.status === "cancelled") {
      return NextResponse.json({ error: "Invoice tidak bisa menerima bukti pembayaran" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Gagal validasi invoice" }, { status: 500 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "file wajib diisi" }, { status: 400 });

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Ukuran file maksimal 8 MB" }, { status: 400 });
  }

  // Konversi ke WebP di SERVER via Sharp — sengaja tidak lagi bergantung pada file.type dari
  // browser (yang kadang kosong untuk foto HEIC dari galeri iPhone) atau kompresi client-side
  // (yang gagal diam-diam kalau browser tidak bisa decode HEIC ke canvas). Sharp mendeteksi
  // format dari isi file, bukan header MIME. Output SELALU WebP — format yang bisa ditampilkan
  // browser manapun, beda dari HEIC yang tidak native-viewable di kebanyakan browser desktop
  // (upload HEIC bisa "berhasil" tapi fotonya tidak pernah tampil buat admin).
  let webpBuffer: Buffer;
  try {
    const inputBuffer = Buffer.from(await file.arrayBuffer());
    webpBuffer = await sharp(inputBuffer)
      .rotate() // auto-orientasi dari EXIF — penting untuk foto dari HP
      .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
  } catch (err) {
    console.error("[proof-upload] Gagal proses gambar:", err);
    return NextResponse.json(
      { error: "Foto tidak bisa diproses. Coba screenshot foto lalu unggah ulang, atau gunakan format JPG/PNG." },
      { status: 400 },
    );
  }

  try {
    await ensureBucket(slug);
    const uuid     = randomUUID();
    const filePath = `payments/${invoiceId}/${uuid}.webp`;
    await uploadFile(slug, filePath, webpBuffer, "image/webp");
    return NextResponse.json({ url: publicUrl(slug, filePath) }, { status: 201 });
  } catch (err) {
    console.error("[proof-upload]", err);
    return NextResponse.json({ error: "Gagal upload file" }, { status: 500 });
  }
}
