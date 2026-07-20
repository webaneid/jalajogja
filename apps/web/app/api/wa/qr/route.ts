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
    const res = await fetch(`${baseUrl}/app/login`, {
      headers: { Authorization: gowaBasicAuth(), "X-Device-Id": deviceId },
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

    const qrLink = data.results?.qr_link ?? null;
    if (!qrLink) {
      return NextResponse.json({ error: "GOWA tidak mengembalikan QR code." }, { status: 502 });
    }

    // GOWA's /statics/qrcode/*.png BUTUH Authorization + X-Device-Id yang sama seperti endpoint
    // lain — TIDAK bisa dipakai langsung sebagai <img src> di browser (browser tidak bisa kirim
    // header custom untuk request gambar) — selalu 401 kalau di-embed langsung, terlepas dari
    // http/https. Origin dari `qr_link` juga tidak bisa dipercaya (GOWA di belakang reverse
    // proxy bisa mengembalikan relatif, localhost, ATAU absolute http:// meski endpoint publik
    // sesungguhnya https:// — mixed content di browser). Fix: ambil path-nya saja, fetch bytes
    // gambar di server (dengan header yang benar), kembalikan sebagai data URL — client tinggal
    // <img src={dataUrl}>, tidak ada request eksternal sama sekali dari browser.
    let imagePath: string;
    try {
      imagePath = qrLink.startsWith("/") ? qrLink : new URL(qrLink).pathname;
    } catch {
      imagePath = qrLink;
    }

    const imgRes = await fetch(`${baseUrl}${imagePath}`, {
      headers: { Authorization: gowaBasicAuth(), "X-Device-Id": deviceId },
      cache: "no-store",
    });

    if (!imgRes.ok) {
      console.error("[wa/qr] GOWA image fetch error:", imgRes.status, await imgRes.text());
      return NextResponse.json({ error: "Gagal memuat gambar QR dari GOWA." }, { status: 502 });
    }

    const contentType = imgRes.headers.get("content-type") ?? "image/png";
    const buffer       = Buffer.from(await imgRes.arrayBuffer());
    const qrDataUrl    = `data:${contentType};base64,${buffer.toString("base64")}`;

    return NextResponse.json({ qrDataUrl, qrDuration: data.results?.qr_duration ?? 30 });
  } catch (err) {
    console.error("[wa/qr] fetch error:", err);
    return NextResponse.json({ error: "Tidak dapat terhubung ke WhatsApp service" }, { status: 503 });
  }
}
