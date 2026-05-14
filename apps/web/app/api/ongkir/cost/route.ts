// POST /api/ongkir/cost?slug=
// Proxy ke RajaOngkir v2 — API key dari ENV, tidak pernah sampai ke browser
//
// Body: { origin: number, destination: number, weight: number, courier: string }
// Courier: kolon-separated, misal "jne:tiki:pos"
// Response: { costs: FlatCourierOption[] }

import { NextRequest, NextResponse } from "next/server";
import { db, tenants, tenantAddonInstallations, addons } from "@jalajogja/db";
import { eq, and } from "drizzle-orm";

const RAJAONGKIR_BASE = "https://rajaongkir.komerce.id/api/v1";

export type FlatCourierOption = {
  name:        string; // nama kurir, misal "JNE"
  code:        string; // kode kurir, misal "jne"
  service:     string; // misal "REG", "OKE", "YES"
  description: string;
  cost:        number;
  etd:         string;
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

    const apiKey = process.env.RAJAONGKIR_PLATFORM_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "RAJAONGKIR_PLATFORM_KEY belum diset di server" }, { status: 500 });
    }

    // v2: POST dengan multipart form-data, bukan URLSearchParams
    const form = new FormData();
    form.append("origin",      String(origin));
    form.append("destination", String(destination));
    form.append("weight",      String(weight));
    form.append("courier",     courier); // kolon-separated, misal "jne:tiki"

    const res = await fetch(`${RAJAONGKIR_BASE}/calculate/domestic-cost`, {
      method:  "POST",
      headers: { key: apiKey },
      body:    form,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[ongkir/cost] RajaOngkir HTTP error:", res.status, text);
      return NextResponse.json({ error: "Gagal menghubungi RajaOngkir" }, { status: 502 });
    }

    const data = await res.json() as {
      meta: { code: number; message?: string };
      data: FlatCourierOption[];
    };

    if (data.meta.code !== 200) {
      return NextResponse.json(
        { error: data.meta.message ?? "RajaOngkir error" },
        { status: 400 },
      );
    }

    return NextResponse.json({ costs: data.data ?? [] });
  } catch (err) {
    console.error("[ongkir/cost]", err);
    return NextResponse.json({ error: "Gagal kalkulasi ongkir" }, { status: 500 });
  }
}
