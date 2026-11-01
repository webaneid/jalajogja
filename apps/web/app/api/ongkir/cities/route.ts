export const dynamic = "force-dynamic";
// GET /api/ongkir/cities?q=&limit= — pencarian tujuan LOKAL-DULU (public.ro_destinations), API RajaOngkir hanya bila belum tercakup
// API key tetap di server — tidak pernah sampai ke browser

import { NextRequest, NextResponse } from "next/server";

import { RajaOngkirError } from "@/lib/rajaongkir.server";
import { searchDestinationsLocalFirst } from "@/lib/ro-destinations.server";
import { rateLimitGuard, getClientIp, checkRateLimit } from "@/lib/rate-limit";
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
    // Jalur yang benar-benar memanggil API berkuota dibatasi jauh lebih ketat per IP (hasil lokal tidak terkena)
    const ip = getClientIp(req);
    const { cities, notice } = await searchDestinationsLocalFirst(q, limit, {
      gate: () => checkRateLimit(`${ip}:ongkir-cities-api`, 4, 60_000).allowed && checkRateLimit(`${ip}:ongkir-cities-api-h`, 20, 3_600_000).allowed,
    });
    return NextResponse.json({ cities, ...(notice ? { notice } : {}) });
  } catch (err) {
    if (err instanceof RajaOngkirError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[ongkir/cities]", err);
    return NextResponse.json({ error: "Gagal memuat daftar kota" }, { status: 500 });
  }
}
