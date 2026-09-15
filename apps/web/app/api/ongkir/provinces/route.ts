export const dynamic = "force-dynamic";
// GET /api/ongkir/provinces — proxy ke RajaOngkir v2 GET /destination/province
// Daftar bersih 34 provinsi {id, name} — TERPISAH dari /api/ongkir/cities (search kelurahan).
// Dipakai untuk picker "Gratis Ongkir Daerah Tertentu" di form produk. API key tetap di
// server — tidak pernah sampai ke browser. Lihat docs/arsitektur-addon-ongkir.md §
// "RENCANA — Gratis Ongkir per Produk".

import { NextResponse } from "next/server";

const RAJAONGKIR_BASE = "https://rajaongkir.komerce.id/api/v1";

export type OngkirProvince = { id: number; name: string };

type V2Province = { id: number; name: string };

export async function GET() {
  const apiKey = process.env.RAJAONGKIR_PLATFORM_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "RAJAONGKIR_PLATFORM_KEY belum diset di server" }, { status: 500 });
  }

  try {
    const res = await fetch(`${RAJAONGKIR_BASE}/destination/province`, {
      headers: { key: apiKey },
      cache:   "no-store",
    });

    const data = await res.json() as {
      meta: { code: number; message?: string };
      data: V2Province[] | null;
    };

    if (!res.ok || data.meta.code !== 200) {
      console.error("[ongkir/provinces] RajaOngkir error:", data.meta.code, data.meta.message);
      return NextResponse.json({ error: "Gagal memuat daftar provinsi" }, { status: 502 });
    }

    const provinces: OngkirProvince[] = (data.data ?? []).map(p => ({ id: p.id, name: p.name }));
    return NextResponse.json({ provinces });
  } catch (err) {
    console.error("[ongkir/provinces]", err);
    return NextResponse.json({ error: "Gagal memuat daftar provinsi" }, { status: 500 });
  }
}
