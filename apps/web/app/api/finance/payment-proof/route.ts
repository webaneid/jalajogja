export const dynamic = "force-dynamic";
// POST /api/finance/payment-proof?tenant=
// Upload bukti transfer / tanda terima untuk pencatatan pemasukan manual admin
// (/finance/pemasukan/new). Payment belum tercipta saat upload terjadi — path
// generik per-tenant (bukan per-invoiceId seperti /api/invoice/proof-upload).
// Admin-only (beda dari proof-upload publik yang tanpa auth).

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { uploadFile, ensureBucket, publicUrl } from "@/lib/minio";
import { getTenantAccess } from "@/lib/tenant";
import { hasFullAccess } from "@/lib/permissions";

const MAX_SIZE = 8 * 1024 * 1024; // 8 MB

export async function POST(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("tenant")?.trim();
  if (!slug) return NextResponse.json({ error: "tenant wajib diisi" }, { status: 400 });

  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasFullAccess(access.tenantUser, "keuangan"))
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "file wajib diisi" }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "Ukuran file maksimal 8 MB" }, { status: 400 });

  // Konversi ke WebP di server via Sharp — sama seperti /api/invoice/proof-upload,
  // deteksi format dari isi file (bukan MIME header dari browser yang kadang kosong
  // untuk foto HEIC dari galeri iPhone).
  let webpBuffer: Buffer;
  try {
    const inputBuffer = Buffer.from(await file.arrayBuffer());
    webpBuffer = await sharp(inputBuffer)
      .rotate()
      .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
  } catch (err) {
    console.error("[payment-proof] Gagal proses gambar:", err);
    return NextResponse.json(
      { error: "Foto tidak bisa diproses. Coba screenshot foto lalu unggah ulang, atau gunakan format JPG/PNG." },
      { status: 400 },
    );
  }

  try {
    await ensureBucket(slug);
    const uuid     = randomUUID();
    const filePath = `payments/manual/${uuid}.webp`;
    await uploadFile(slug, filePath, webpBuffer, "image/webp");
    return NextResponse.json({ url: publicUrl(slug, filePath) }, { status: 201 });
  } catch (err) {
    console.error("[payment-proof]", err);
    return NextResponse.json({ error: "Gagal upload file" }, { status: 500 });
  }
}
