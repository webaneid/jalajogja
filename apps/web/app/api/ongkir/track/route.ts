export const dynamic = "force-dynamic";
// GET /api/ongkir/track?waybill={resi}&courier={courier_code}&slug={tenant}
// Proxy ke RajaOngkir v2 — RAJAONGKIR_PLATFORM_KEY TIDAK PERNAH ke browser.
// Lihat: docs/arsitektur-fulfillment.md § Rencana RajaOngkir Tracking

import { NextRequest, NextResponse } from "next/server";

const RAJAONGKIR_BASE = "https://rajaongkir.komerce.id/api/v1";

export type TrackingManifest = {
  date:        string;
  time:        string;
  description: string;
  city:        string;
};

export type TrackingResult = {
  status:     "pending" | "in_transit" | "delivered" | "problem" | "unknown";
  summary:    string;
  lastUpdate: string | null;
  history:    TrackingManifest[];
};

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const waybill  = (searchParams.get("waybill")  ?? "").trim();
  const courier  = (searchParams.get("courier")  ?? "").trim();

  if (!waybill || !courier) {
    return NextResponse.json({ error: "Parameter waybill dan courier wajib diisi." }, { status: 400 });
  }

  const apiKey = process.env.RAJAONGKIR_PLATFORM_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "RAJAONGKIR_PLATFORM_KEY belum dikonfigurasi." }, { status: 500 });
  }

  try {
    const res = await fetch(`${RAJAONGKIR_BASE}/track/waybill`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", key: apiKey },
      body:    JSON.stringify({ waybill, courier }),
      cache:   "no-store",
    });

    // RajaOngkir returns 404 when resi not found — treat as pending/unknown
    if (res.status === 404) {
      const result: TrackingResult = {
        status:     "unknown",
        summary:    "Resi belum terlacak. Mungkin belum terinput ke sistem kurir.",
        lastUpdate: null,
        history:    [],
      };
      return NextResponse.json(result);
    }

    if (!res.ok) {
      return NextResponse.json({ error: "Gagal menghubungi layanan pelacakan." }, { status: 502 });
    }

    const raw = await res.json() as {
      data?: {
        summary?: {
          status?:       string;
          description?:  string;
          updated_at?:   string;
        };
        manifest?: {
          manifest_date?:        string;
          manifest_time?:        string;
          manifest_description?: string;
          city_name?:            string;
        }[];
      };
    };

    const summary  = raw.data?.summary;
    const manifest = raw.data?.manifest ?? [];

    // Normalisasi status ke enum kita
    const rawStatus = (summary?.status ?? "").toLowerCase();
    let status: TrackingResult["status"] = "unknown";
    if (rawStatus.includes("delivered") || rawStatus.includes("terima")) status = "delivered";
    else if (rawStatus.includes("transit") || rawStatus.includes("kirim") || rawStatus.includes("process")) status = "in_transit";
    else if (rawStatus.includes("problem") || rawStatus.includes("gagal") || rawStatus.includes("return")) status = "problem";
    else if (rawStatus.includes("manifest") || rawStatus.includes("pickup")) status = "pending";

    const result: TrackingResult = {
      status,
      summary:    summary?.description ?? "Informasi pengiriman tersedia.",
      lastUpdate: summary?.updated_at ?? null,
      history:    manifest.map(m => ({
        date:        m.manifest_date        ?? "",
        time:        m.manifest_time        ?? "",
        description: m.manifest_description ?? "",
        city:        m.city_name            ?? "",
      })).reverse(), // terbaru di atas
    };

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Gagal menghubungi layanan pelacakan." }, { status: 500 });
  }
}
