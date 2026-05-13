// POST /api/platform/rajaongkir/sync-cities
// Sync daftar kota dari RajaOngkir ke ref_rajaongkir_cities (platform admin only)
// Menggunakan API key platform dari ENV: RAJAONGKIR_PLATFORM_KEY + RAJAONGKIR_PLATFORM_TIER

import { NextRequest, NextResponse } from "next/server";
import { db, refRajaongkirCities } from "@jalajogja/db";
import { getPlatformSession } from "@/lib/platform-auth";
import { headers } from "next/headers";
import { sql } from "drizzle-orm";

type RajaOngkirCity = {
  city_id:      string;
  province_id:  string;
  city_name:    string;
  postal_code:  string;
  type:         string;  // 'Kabupaten' | 'Kota'
};

export async function POST(req: NextRequest) {
  const h = await headers();
  const session = await getPlatformSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.RAJAONGKIR_PLATFORM_KEY;
  const tier   = (process.env.RAJAONGKIR_PLATFORM_TIER ?? "starter") as "starter" | "pro";

  if (!apiKey) {
    return NextResponse.json(
      { error: "RAJAONGKIR_PLATFORM_KEY belum diset di ENV" },
      { status: 500 },
    );
  }

  const baseUrl = tier === "pro"
    ? "https://pro.rajaongkir.com/api"
    : "https://api.rajaongkir.com/starter";

  try {
    const res = await fetch(`${baseUrl}/city`, {
      headers: { key: apiKey },
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Gagal fetch dari RajaOngkir" }, { status: 502 });
    }

    const data = await res.json() as {
      rajaongkir: {
        status:  { code: number; description: string };
        results: RajaOngkirCity[];
      };
    };

    if (data.rajaongkir.status.code !== 200) {
      return NextResponse.json({ error: data.rajaongkir.status.description }, { status: 400 });
    }

    const cities = data.rajaongkir.results;

    // Upsert semua kota sekaligus
    const values = cities.map(c => ({
      cityId:     parseInt(c.city_id),
      provinceId: parseInt(c.province_id),
      cityName:   c.city_name,
      postalCode: c.postal_code || null,
      type:       c.type,
    }));

    // Insert in chunks of 100 to avoid query size limits
    const CHUNK = 100;
    let inserted = 0;
    for (let i = 0; i < values.length; i += CHUNK) {
      const chunk = values.slice(i, i + CHUNK);
      await db
        .insert(refRajaongkirCities)
        .values(chunk)
        .onConflictDoUpdate({
          target: refRajaongkirCities.cityId,
          set: {
            provinceId: sql`excluded.province_id`,
            cityName:   sql`excluded.city_name`,
            postalCode: sql`excluded.postal_code`,
            type:       sql`excluded.type`,
          },
        });
      inserted += chunk.length;
    }

    return NextResponse.json({ ok: true, synced: inserted });
  } catch (err) {
    console.error("[platform/rajaongkir/sync-cities]", err);
    return NextResponse.json({ error: "Gagal sync kota" }, { status: 500 });
  }
}
