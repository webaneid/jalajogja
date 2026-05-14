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
      next:    { revalidate: 3600 }, // cache 1 jam per query
    });

    if (!res.ok) {
      console.error("[ongkir/cities] RajaOngkir HTTP error:", res.status);
      return NextResponse.json({ error: "Gagal memuat data kota dari RajaOngkir" }, { status: 502 });
    }

    const data = await res.json() as { meta: { code: number }; data: V2Destination[] };

    if (data.meta.code !== 200) {
      return NextResponse.json({ error: "RajaOngkir error" }, { status: 400 });
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
