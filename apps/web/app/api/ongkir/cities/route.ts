export const dynamic = "force-dynamic";
// GET /api/ongkir/cities?q=&limit= — proxy ke RajaOngkir v2 (search-based)
// API key tetap di server — tidak pernah sampai ke browser

import { NextRequest, NextResponse } from "next/server";

const RAJAONGKIR_BASE = "https://rajaongkir.komerce.id/api/v1";

export type OngkirCity = {
  id:             number;
  label:          string; // "BENER, TEGALREJO, YOGYAKARTA, DI YOGYAKARTA, 55243"
  cityName:       string;
  districtName:   string;
  subdistrictName: string;
  provinceName:   string;
  zipCode:        string;
};

type V2Destination = {
  id:               number;
  label:            string;
  province_name:    string;
  city_name:        string;
  district_name:    string;
  subdistrict_name: string;
  zip_code:         string;
};

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const q     = (searchParams.get("q") ?? "").trim();
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "15"), 30);

  if (q.length < 2) {
    return NextResponse.json({ cities: [] });
  }

  const apiKey = process.env.RAJAONGKIR_PLATFORM_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "RAJAONGKIR_PLATFORM_KEY belum diset di server" }, { status: 500 });
  }

  try {
    const url = `${RAJAONGKIR_BASE}/destination/domestic-destination?search=${encodeURIComponent(q)}&limit=${limit}&offset=0`;
    const res = await fetch(url, {
      headers: { key: apiKey },
      cache:   "no-store", // search realtime, jangan cache di route handler
    });

    const data = await res.json() as {
      meta: { code: number; message?: string };
      data: V2Destination[] | null;
    };

    // RajaOngkir v2 mengembalikan 404 saat tidak ada hasil — bukan error, cukup array kosong
    if (!res.ok || data.meta.code === 404) {
      return NextResponse.json({ cities: [] });
    }

    if (data.meta.code !== 200) {
      console.error("[ongkir/cities] RajaOngkir error:", data.meta.code, data.meta.message);
      return NextResponse.json({ error: "RajaOngkir error" }, { status: 502 });
    }

    const cities: OngkirCity[] = (data.data ?? []).map(d => ({
      id:              d.id,
      label:           d.label,
      cityName:        d.city_name,
      districtName:    d.district_name,
      subdistrictName: d.subdistrict_name,
      provinceName:    d.province_name,
      zipCode:         d.zip_code,
    }));

    return NextResponse.json({ cities });
  } catch (err) {
    console.error("[ongkir/cities]", err);
    return NextResponse.json({ error: "Gagal memuat daftar kota" }, { status: 500 });
  }
}
