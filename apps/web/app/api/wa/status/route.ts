export const dynamic = "force-dynamic";
// GET /api/wa/status?slug={slug}
// Cek status koneksi device WhatsApp di GOWA.
// Dipakai oleh frontend polling saat QR modal terbuka.

import { NextRequest, NextResponse } from "next/server";
import { getTenantAccess } from "@/lib/tenant";
import { gowaBaseUrl, gowaBasicAuth } from "@/lib/whatsapp";

type GowaStatusResult = {
  device_id:    string;
  is_connected: boolean;
  is_logged_in: boolean;
};

type GowaDeviceResult = {
  id:           string;
  phone_number: string;
  display_name: string;
  state:        string;
};

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug diperlukan" }, { status: 400 });

  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const baseUrl = gowaBaseUrl();
  if (!baseUrl) return NextResponse.json({ isConnected: false, isLoggedIn: false, phoneNumber: null });

  const deviceId = slug;
  const auth     = { Authorization: gowaBasicAuth() };

  try {
    const statusRes = await fetch(`${baseUrl}/devices/${deviceId}/status`, {
      headers: auth, cache: "no-store",
    });

    if (!statusRes.ok) {
      // Device belum pernah dibuat → belum dikonfigurasi
      return NextResponse.json({ isConnected: false, isLoggedIn: false, phoneNumber: null });
    }

    const statusData = await statusRes.json() as { results?: GowaStatusResult };
    const isConnected = statusData.results?.is_connected ?? false;
    const isLoggedIn  = statusData.results?.is_logged_in  ?? false;

    // Jika sudah login, ambil phone number dari device info
    let phoneNumber: string | null = null;
    if (isLoggedIn) {
      const deviceRes = await fetch(`${baseUrl}/devices/${deviceId}`, {
        headers: auth, cache: "no-store",
      });
      if (deviceRes.ok) {
        const deviceData = await deviceRes.json() as { results?: GowaDeviceResult };
        phoneNumber = deviceData.results?.phone_number ?? null;
      }
    }

    return NextResponse.json({ isConnected, isLoggedIn, phoneNumber });
  } catch (err) {
    console.error("[wa/status] error:", err);
    return NextResponse.json({ isConnected: false, isLoggedIn: false, phoneNumber: null });
  }
}
