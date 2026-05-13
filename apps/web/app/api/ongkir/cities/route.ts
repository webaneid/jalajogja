// GET /api/ongkir/cities?q= — cari kota dari ref_rajaongkir_cities
// Digunakan untuk combobox kota tujuan di checkout dan kota asal mitra

import { NextRequest, NextResponse } from "next/server";
import { db, refRajaongkirCities } from "@jalajogja/db";
import { ilike, sql, eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const q          = (searchParams.get("q") ?? "").trim();
  const provinceId = searchParams.get("province_id");
  const limit      = Math.min(parseInt(searchParams.get("limit") ?? "20"), 50);

  try {
    const conditions: Parameters<typeof db.select>[0]["where"][] = [];

    if (q.length >= 2) {
      conditions.push(ilike(refRajaongkirCities.cityName, `%${q}%`));
    }
    if (provinceId) {
      conditions.push(eq(refRajaongkirCities.provinceId, parseInt(provinceId)));
    }

    const where = conditions.length > 0
      ? sql`${conditions.reduce((a, b) => sql`${a} AND ${b}`)}`
      : undefined;

    const cities = await db
      .select({
        cityId:     refRajaongkirCities.cityId,
        cityName:   refRajaongkirCities.cityName,
        provinceId: refRajaongkirCities.provinceId,
        postalCode: refRajaongkirCities.postalCode,
        type:       refRajaongkirCities.type,
      })
      .from(refRajaongkirCities)
      .where(where)
      .orderBy(refRajaongkirCities.cityName)
      .limit(limit);

    return NextResponse.json({ cities });
  } catch (err) {
    console.error("[ongkir/cities]", err);
    return NextResponse.json({ error: "Gagal memuat daftar kota" }, { status: 500 });
  }
}
