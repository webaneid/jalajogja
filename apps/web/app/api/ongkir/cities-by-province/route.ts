export const dynamic = "force-dynamic";
// GET /api/ongkir/cities-by-province?provinceId= — proxy ke RajaOngkir v2
// GET /destination/city/{province_id}
// Daftar bersih kabupaten/kota {id, name} dalam satu provinsi — TERPISAH dari
// /api/ongkir/cities (search kelurahan). Dipakai untuk picker "Gratis Ongkir Daerah Tertentu"
// di form produk. API key tetap di server — tidak pernah sampai ke browser. Lihat
// docs/arsitektur-addon-ongkir.md § "RENCANA — Gratis Ongkir per Produk".

import { NextRequest, NextResponse } from "next/server";

const RAJAONGKIR_BASE = "https://rajaongkir.komerce.id/api/v1";

export type OngkirCityListItem = { id: number; name: string };

type V2City = { id: number; name: string };

export async function GET(req: NextRequest) {
  const provinceId = req.nextUrl.searchParams.get("provinceId");
  const provinceIdNum = provinceId ? parseInt(provinceId, 10) : NaN;
  if (!provinceId || !Number.isInteger(provinceIdNum) || provinceIdNum < 1) {
    return NextResponse.json({ error: "provinceId tidak valid" }, { status: 400 });
  }

  const apiKey = process.env.RAJAONGKIR_PLATFORM_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "RAJAONGKIR_PLATFORM_KEY belum diset di server" }, { status: 500 });
  }

  try {
    const res = await fetch(`${RAJAONGKIR_BASE}/destination/city/${provinceIdNum}`, {
      headers: { key: apiKey },
      cache:   "no-store",
    });

    const data = await res.json() as {
      meta: { code: number; message?: string };
      data: V2City[] | null;
    };

    if (!res.ok || data.meta.code !== 200) {
      console.error("[ongkir/cities-by-province] RajaOngkir error:", data.meta.code, data.meta.message);
      return NextResponse.json({ error: "Gagal memuat daftar kota" }, { status: 502 });
    }

    const cities: OngkirCityListItem[] = (data.data ?? []).map(c => ({ id: c.id, name: c.name }));
    return NextResponse.json({ cities });
  } catch (err) {
    console.error("[ongkir/cities-by-province]", err);
    return NextResponse.json({ error: "Gagal memuat daftar kota" }, { status: 500 });
  }
}
