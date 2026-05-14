// POST /api/platform/rajaongkir/sync-cities
// Test koneksi ke RajaOngkir v2 (platform admin only)
// API v2 adalah search-based — tidak ada bulk list endpoint, jadi ini hanya test ping

import { NextRequest, NextResponse } from "next/server";
import { getPlatformSession } from "@/lib/platform-auth";

const RAJAONGKIR_BASE = "https://rajaongkir.komerce.id/api/v1";

export async function POST(req: NextRequest) {
  void req;

  const session = await getPlatformSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.RAJAONGKIR_PLATFORM_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "RAJAONGKIR_PLATFORM_KEY belum diset di ENV" },
      { status: 500 },
    );
  }

  try {
    // Test dengan query sederhana
    const res = await fetch(
      `${RAJAONGKIR_BASE}/destination/domestic-destination?search=jakarta&limit=1&offset=0`,
      { headers: { key: apiKey } },
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: `RajaOngkir response: HTTP ${res.status}` },
        { status: 502 },
      );
    }

    const data = await res.json() as { meta: { code: number; message?: string }; data: unknown[] };

    if (data.meta.code !== 200) {
      return NextResponse.json(
        { error: data.meta.message ?? "RajaOngkir error" },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok:      true,
      message: "Koneksi ke RajaOngkir berhasil",
      sample:  data.data?.length ?? 0,
    });
  } catch (err) {
    console.error("[platform/rajaongkir/sync-cities]", err);
    return NextResponse.json({ error: "Gagal terhubung ke RajaOngkir" }, { status: 500 });
  }
}
