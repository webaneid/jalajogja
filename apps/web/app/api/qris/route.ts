export const dynamic = "force-dynamic";
// GET /api/qris?slug=&qrisId=&amount=&ref=
// Mengembalikan { qrDataUrl } — QR code dengan nominal terkunci (dynamic QRIS)

import { NextRequest, NextResponse } from "next/server";
import { createTenantDb } from "@jalajogja/db";
import { getSettings } from "@jalajogja/db";
import { buildDynamicQris } from "@/lib/qris-emv";
import { generateQrDataUrl } from "@/lib/qr-code";

type QrisAccount = {
  id:          string;
  name:        string;
  imageUrl:    string;
  categories:  string[];
  isDynamic:   boolean;
  emvPayload?: string;
};

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const slug    = searchParams.get("slug")   ?? "";
  const qrisId  = searchParams.get("qrisId") ?? "";
  const amount  = parseFloat(searchParams.get("amount") ?? "0");
  const ref     = searchParams.get("ref")    ?? "PEMBAYARAN";

  if (!slug || !qrisId || amount <= 0) {
    return NextResponse.json({ error: "Parameter tidak lengkap" }, { status: 400 });
  }

  try {
    const tenantClient = createTenantDb(slug);
    const settings     = await getSettings(tenantClient, "payment");
    const qrisList     = (settings.qris_accounts ?? []) as QrisAccount[];
    const qris         = qrisList.find((q) => q.id === qrisId);

    if (!qris) {
      return NextResponse.json({ error: "QRIS tidak ditemukan" }, { status: 404 });
    }

    if (!qris.isDynamic || !qris.emvPayload) {
      // Static QRIS — kembalikan imageUrl saja
      return NextResponse.json({ type: "static", imageUrl: qris.imageUrl });
    }

    const dynamicPayload = buildDynamicQris(qris.emvPayload, amount, ref);
    const qrDataUrl      = await generateQrDataUrl(dynamicPayload);

    return NextResponse.json({ type: "dynamic", qrDataUrl });
  } catch (err) {
    console.error("[/api/qris]", err);
    return NextResponse.json({ error: "Gagal generate QRIS" }, { status: 500 });
  }
}
