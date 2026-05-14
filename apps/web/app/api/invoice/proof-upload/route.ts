// POST /api/invoice/proof-upload?tenant=&invoiceId=
// Upload bukti transfer/QRIS — tidak perlu auth, cukup punya invoiceId
// File disimpan ke MinIO: payments/{invoiceId}/{uuid}.{ext}

import { NextRequest, NextResponse } from "next/server";
import { createTenantDb } from "@jalajogja/db";
import { eq } from "drizzle-orm";
import { uploadFile, ensureBucket, publicUrl } from "@/lib/minio";
import { randomUUID } from "crypto";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg":    "jpg",
  "image/png":     "png",
  "image/webp":    "webp",
  "image/heic":    "heic",
  "image/heif":    "heif",
};

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

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "Format tidak didukung. Gunakan JPG, PNG, atau WebP." },
      { status: 400 },
    );
  }

  try {
    await ensureBucket(slug);
    const uuid     = randomUUID();
    const filePath = `payments/${invoiceId}/${uuid}.${ext}`;
    const buffer   = Buffer.from(await file.arrayBuffer());
    await uploadFile(slug, filePath, buffer, file.type);
    return NextResponse.json({ url: publicUrl(slug, filePath) }, { status: 201 });
  } catch (err) {
    console.error("[proof-upload]", err);
    return NextResponse.json({ error: "Gagal upload file" }, { status: 500 });
  }
}
