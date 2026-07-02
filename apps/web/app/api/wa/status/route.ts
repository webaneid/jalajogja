export const dynamic = "force-dynamic";
// GET /api/wa/status?slug={slug}
// Cek status koneksi device WhatsApp di GOWA.
// Dipakai oleh frontend polling saat QR modal terbuka.

import { NextRequest, NextResponse } from "next/server";
import { getTenantAccess } from "@/lib/tenant";
import { gowaBaseUrl, gowaBasicAuth } from "@/lib/whatsapp";

type GowaDeviceItem = {
  device:    string;  // = device_id / slug
  jid:       string;  // kosong = belum terhubung, "628xxx@s.whatsapp.net" = terhubung
  connected: boolean;
};

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug diperlukan" }, { status: 400 });

  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const baseUrl = gowaBaseUrl();
  if (!baseUrl) return NextResponse.json({ isConnected: false, isLoggedIn: false, phoneNumber: null });

  const deviceId = slug;

  try {
    const res = await fetch(`${baseUrl}/app/devices`, {
      headers: { Authorization: gowaBasicAuth(), "X-Device-Id": deviceId },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({ isConnected: false, isLoggedIn: false, phoneNumber: null });
    }

    const data = await res.json() as { results?: GowaDeviceItem[] };
    const myDevice = (data.results ?? []).find((d) => d.device === deviceId);

    // Terhubung jika jid terisi (format: "628xxx@s.whatsapp.net")
    const isLoggedIn  = !!(myDevice?.jid && myDevice.jid !== "");
    const phoneNumber = isLoggedIn ? `+${myDevice!.jid.split("@")[0]}` : null;

    return NextResponse.json({ isConnected: isLoggedIn, isLoggedIn, phoneNumber });
  } catch (err) {
    console.error("[wa/status] error:", err);
    return NextResponse.json({ isConnected: false, isLoggedIn: false, phoneNumber: null });
  }
}
