export const dynamic = "force-dynamic";
// POST /api/ongkir/cost?slug=
// Proxy ke RajaOngkir v2 — API key dari ENV, tidak pernah sampai ke browser
//
// Body: { origin: number, destination: number, weight: number, courier: string }
// Courier: kolon-separated, misal "jne:tiki:pos"
// Response: { costs: FlatCourierOption[] }

import { NextRequest, NextResponse } from "next/server";
import { db, tenants, tenantAddonInstallations, addons } from "@jalajogja/db";
import { eq, and } from "drizzle-orm";
import { fetchDomesticCost, RajaOngkirError } from "@/lib/rajaongkir.server";
import { RAJAONGKIR_COURIER_CODES } from "@/lib/rajaongkir-couriers";
import { rateLimitGuard } from "@/lib/rate-limit";

export type { FlatCourierOption } from "@/lib/rajaongkir.server";

export async function POST(req: NextRequest) {
  const blocked = rateLimitGuard(req, "ongkir-cost", 40, 60_000);
  if (blocked) return blocked;
  const { searchParams } = req.nextUrl;
  const slug = searchParams.get("slug") ?? "";

  if (!slug) {
    return NextResponse.json({ error: "slug wajib diisi" }, { status: 400 });
  }

  let body: { origin: number; destination: number; weight: number; courier: string };
  try {
    body = await req.json() as typeof body;
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  const { origin, destination, weight, courier } = body;
  if (!origin || !destination || !weight || !courier) {
    return NextResponse.json({ error: "Parameter tidak lengkap" }, { status: 400 });
  }
  // Validasi tipe & rentang — nilai ini diteruskan ke upstream berkuota (key platform bersama)
  const isId = (n: unknown) => Number.isInteger(n) && (n as number) > 0 && (n as number) < 2_000_000_000;
  const codes = typeof courier === "string" ? courier.split(":") : [];
  if (!isId(origin) || !isId(destination) || !Number.isInteger(weight) || weight < 1 || weight > 100_000_000
      || codes.length < 1 || codes.length > RAJAONGKIR_COURIER_CODES.length || !codes.every((c) => RAJAONGKIR_COURIER_CODES.includes(c))) {
    return NextResponse.json({ error: "Parameter tidak valid" }, { status: 400 });
  }

  try {
    // Cek addon aktif untuk tenant ini
    const tenant = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.slug, slug))
      .limit(1)
      .then(r => r[0]);

    if (!tenant) {
      return NextResponse.json({ error: "Tenant tidak ditemukan" }, { status: 404 });
    }

    const installation = await db
      .select({ status: tenantAddonInstallations.status })
      .from(tenantAddonInstallations)
      .innerJoin(addons, eq(addons.id, tenantAddonInstallations.addonId))
      .where(and(
        eq(tenantAddonInstallations.tenantId, tenant.id),
        eq(addons.slug, "rajaongkir"),
      ))
      .limit(1)
      .then(r => r[0]);

    if (!installation || installation.status === "expired" || installation.status === "inactive") {
      return NextResponse.json({ error: "Add-on RajaOngkir tidak aktif" }, { status: 403 });
    }

    const costs = await fetchDomesticCost({ origin, destination, weight, courier });
    return NextResponse.json({ costs });
  } catch (err) {
    if (err instanceof RajaOngkirError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[ongkir/cost]", err);
    return NextResponse.json({ error: "Gagal kalkulasi ongkir" }, { status: 500 });
  }
}
