export const dynamic = "force-dynamic";
// GET /api/ongkir/cities?q=&limit= — proxy ke RajaOngkir v2 (search-based)
// API key tetap di server — tidak pernah sampai ke browser

import { NextRequest, NextResponse } from "next/server";

import { searchDestinations, RajaOngkirError } from "@/lib/rajaongkir.server";
import { rateLimitGuard } from "@/lib/rate-limit";
export type { OngkirCity } from "@/lib/rajaongkir.server";

export async function GET(req: NextRequest) {
  const blocked = rateLimitGuard(req, "ongkir-cities", 90, 60_000);
  if (blocked) return blocked;
  const { searchParams } = req.nextUrl;
  const q     = (searchParams.get("q") ?? "").trim().slice(0, 100);
  const rawLimit = parseInt(searchParams.get("limit") ?? "15", 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 30) : 15;

  if (q.length < 2) {
    return NextResponse.json({ cities: [] });
  }

  try {
    const cities = await searchDestinations(q, limit);
    return NextResponse.json({ cities });
  } catch (err) {
    if (err instanceof RajaOngkirError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[ongkir/cities]", err);
    return NextResponse.json({ error: "Gagal memuat daftar kota" }, { status: 500 });
  }
}
