export const dynamic = "force-dynamic";
// GET /api/wa/qr?slug={slug}
// Ambil QR code dari GOWA untuk login device tenant ini.
// Memerlukan auth admin.

import { NextRequest, NextResponse } from "next/server";
import { getTenantAccess } from "@/lib/tenant";
import { gowaBaseUrl, gowaBasicAuth } from "@/lib/whatsapp";

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug diperlukan" }, { status: 400 });

  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const baseUrl = gowaBaseUrl();
  if (!baseUrl) return NextResponse.json({ error: "WhatsApp service belum dikonfigurasi" }, { status: 503 });

  const deviceId = slug;

  try {
    const res = await fetch(`${baseUrl}/devices/${deviceId}/login`, {
      headers: { Authorization: gowaBasicAuth() },
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[wa/qr] GOWA error:", res.status, text);
      return NextResponse.json({ error: "Gagal ambil QR dari GOWA" }, { status: 502 });
    }

    const data = await res.json() as {
      code: string;
      results?: { qr_link?: string; qr_duration?: number };
    };

    let qrLink = data.results?.qr_link ?? null;

    // Perbaiki URL relatif atau localhost yang dikembalikan GOWA
    if (qrLink && (qrLink.startsWith("/") || qrLink.includes("localhost") || qrLink.includes("127.0.0.1"))) {
      const path = qrLink.startsWith("/") ? qrLink : new URL(qrLink).pathname;
      qrLink = `${baseUrl}${path}`;
    }

    return NextResponse.json({ qrLink, qrDuration: data.results?.qr_duration ?? 30 });
  } catch (err) {
    console.error("[wa/qr] fetch error:", err);
    return NextResponse.json({ error: "Tidak dapat terhubung ke WhatsApp service" }, { status: 503 });
  }
}
