// POST /api/ongkir/cost?slug=
// Proxy ke RajaOngkir — API key dari ENV, tidak pernah sampai ke browser
//
// Body: { origin: number, destination: number, weight: number, courier: string }
// Response: { costs: CourierCost[] }

import { NextRequest, NextResponse } from "next/server";
import { db, tenants, tenantAddonInstallations, addons } from "@jalajogja/db";
import { eq, and } from "drizzle-orm";

type CourierCostDetail = {
  service:     string;
  description: string;
  cost:        Array<{ value: number; etd: string; note: string }>;
};

type CourierResult = {
  code:    string;
  name:    string;
  costs:   CourierCostDetail[];
};

export async function POST(req: NextRequest) {
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

  try {
    // Ambil tenant dan addon config
    const tenant = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.slug, slug))
      .limit(1)
      .then(r => r[0]);

    if (!tenant) {
      return NextResponse.json({ error: "Tenant tidak ditemukan" }, { status: 404 });
    }

    // Cek addon aktif untuk tenant ini
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

    // API key dari ENV platform — tidak disimpan di DB per tenant
    const apiKey = process.env.RAJAONGKIR_PLATFORM_KEY;
    const tier   = (process.env.RAJAONGKIR_PLATFORM_TIER ?? "starter") as "starter" | "pro";

    if (!apiKey) {
      return NextResponse.json({ error: "RAJAONGKIR_PLATFORM_KEY belum diset di server" }, { status: 500 });
    }

    const baseUrl = tier === "pro"
      ? "https://pro.rajaongkir.com/api"
      : "https://api.rajaongkir.com/starter";

    const formData = new URLSearchParams({
      origin:      String(origin),
      destination: String(destination),
      weight:      String(weight),
      courier,
    });

    const res = await fetch(`${baseUrl}/cost`, {
      method: "POST",
      headers: {
        "key":          apiKey,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    if (!res.ok) {
      console.error("[ongkir/cost] RajaOngkir HTTP error:", res.status);
      return NextResponse.json({ error: "Gagal menghubungi RajaOngkir" }, { status: 502 });
    }

    const data = await res.json() as {
      rajaongkir: {
        status: { code: number; description: string };
        results: CourierResult[];
      };
    };

    if (data.rajaongkir.status.code !== 200) {
      return NextResponse.json(
        { error: data.rajaongkir.status.description ?? "RajaOngkir error" },
        { status: 400 },
      );
    }

    return NextResponse.json({ costs: data.rajaongkir.results });
  } catch (err) {
    console.error("[ongkir/cost]", err);
    return NextResponse.json({ error: "Gagal kalkulasi ongkir" }, { status: 500 });
  }
}
