// SATU-SATUNYA pintu panggilan RajaOngkir (Komerce v2) untuk ongkir & pencarian tujuan. Dipakai route /api/ongkir/{cost,cities}
// DAN verifikasi ongkir server saat checkout. API key dari ENV, tidak pernah ke browser. Doc: docs/arsitektur-portal-produsen.md § 26.
import "server-only";

const BASE = "https://rajaongkir.komerce.id/api/v1";

export type FlatCourierOption = {
  name: string;        // "JNE"
  code: string;        // "jne"
  service: string;     // "REG"
  description: string;
  cost: number;
  etd: string;
};

export type OngkirCity = {
  id: number;
  label: string;       // "BENER, TEGALREJO, YOGYAKARTA, DI YOGYAKARTA, 55243"
  cityName: string;
  districtName: string;
  subdistrictName: string;
  provinceName: string;
  zipCode: string;
};

/** Kegagalan terukur: `status` dipakai route untuk membalas klien; pemanggil lain cukup membaca `message`. */
export class RajaOngkirError extends Error {
  constructor(message: string, public status: number = 502) { super(message); }
}

// Cache memori proses (TTL pendek) — mengurangi panggilan upstream & kuota key platform. Hanya menyimpan JAWABAN upstream
// (tidak pernah input klien), jadi tidak bisa diracuni. Multi-proses: tiap proses punya cache sendiri (aman, hanya kurang efisien).
const cityCache = new Map<number, { at: number; city: OngkirCity }>();
const costCache = new Map<string, { at: number; options: FlatCourierOption[] }>();
const CITY_TTL = 30 * 60_000;
const COST_TTL = 3 * 60_000;
const CACHE_MAX = 5000;
function put<K, V>(m: Map<K, V>, k: K, v: V) { if (m.size >= CACHE_MAX) m.clear(); m.set(k, v); }

function apiKey(): string {
  const k = process.env.RAJAONGKIR_PLATFORM_KEY;
  if (!k) {
    console.error("[rajaongkir] RAJAONGKIR_PLATFORM_KEY belum diset di server");
    throw new RajaOngkirError("Layanan ongkir belum dikonfigurasi", 500); // detail hanya di log, tidak ke klien
  }
  return k;
}

/** Biaya kirim. `courier` = kode dipisah titik dua ("jne:tiki"). Melempar RajaOngkirError bila gagal. */
export async function fetchDomesticCost(p: { origin: number; destination: number; weight: number; courier: string }): Promise<FlatCourierOption[]> {
  const ck = `${p.origin}|${p.destination}|${p.weight}|${p.courier}`;
  const hit = costCache.get(ck);
  if (hit && Date.now() - hit.at < COST_TTL) return hit.options;
  const key = apiKey();
  // v2: POST multipart form-data, bukan URLSearchParams
  const form = new FormData();
  form.append("origin", String(p.origin));
  form.append("destination", String(p.destination));
  form.append("weight", String(p.weight));
  form.append("courier", p.courier);

  let res: Response;
  try {
    res = await fetch(`${BASE}/calculate/domestic-cost`, { method: "POST", headers: { key }, body: form });
  } catch {
    throw new RajaOngkirError("Gagal menghubungi RajaOngkir", 502);
  }
  if (!res.ok) {
    console.error("[rajaongkir] cost HTTP error:", res.status, await res.text().catch(() => ""));
    throw new RajaOngkirError("Gagal menghubungi RajaOngkir", 502);
  }
  const data = await res.json() as { meta: { code: number; message?: string }; data: FlatCourierOption[] | null };
  if (data.meta.code !== 200) {
    console.error("[rajaongkir] cost ditolak:", data.meta.code, data.meta.message); // pesan upstream hanya di log
    throw new RajaOngkirError("Ongkir untuk rute ini tidak dapat dihitung", 400);
  }
  const options = data.data ?? [];
  put(costCache, ck, { at: Date.now(), options });
  return options;
}

type V2Destination = {
  id: number; label: string; province_name: string; city_name: string;
  district_name: string; subdistrict_name: string; zip_code: string;
};

/** Cari tujuan. Tidak ada hasil (404 RajaOngkir) = array kosong, bukan error. */
export async function searchDestinations(q: string, limit = 15): Promise<OngkirCity[]> {
  const key = apiKey();
  let res: Response;
  try {
    res = await fetch(`${BASE}/destination/domestic-destination?search=${encodeURIComponent(q)}&limit=${limit}&offset=0`, {
      headers: { key }, cache: "no-store", // pencarian realtime
    });
  } catch {
    throw new RajaOngkirError("Gagal menghubungi RajaOngkir", 502);
  }
  const data = await res.json().catch(() => null) as { meta?: { code: number; message?: string }; data?: V2Destination[] | null } | null;
  if (!data?.meta) throw new RajaOngkirError("Gagal menghubungi RajaOngkir", 502);
  if (!res.ok || data.meta.code === 404) return [];
  if (data.meta.code !== 200) {
    console.error("[rajaongkir] search error:", data.meta.code, data.meta.message);
    throw new RajaOngkirError("RajaOngkir error", 502);
  }
  const cities = (data.data ?? []).map((d) => ({
    id: d.id, label: d.label, cityName: d.city_name, districtName: d.district_name,
    subdistrictName: d.subdistrict_name, provinceName: d.province_name, zipCode: d.zip_code,
  }));
  for (const c of cities) put(cityCache, c.id, { at: Date.now(), city: c }); // hasil yang sama dilihat pembeli saat memilih tujuan
  return cities;
}

/**
 * Tujuan OTORITATIF dari id yang dikirim klien: label dari klien hanya petunjuk pencarian; data yang dikembalikan
 * (nama kota/provinsi untuk gratis-ongkir) berasal dari RajaOngkir. null = id tidak ditemukan.
 */
export async function resolveDestination(id: number, labelHint: string): Promise<OngkirCity | null> {
  const cached = cityCache.get(id);
  if (cached && Date.now() - cached.at < CITY_TTL) return cached.city;
  // Coba dari yang paling spesifik (label penuh) ke bagian label (kelurahan, kode pos) — pencarian RajaOngkir longgar soal format
  const parts = labelHint.split(",").map((s) => s.trim()).filter((s) => s.length >= 2);
  const queries = [...new Set([labelHint.trim(), parts[0], parts[parts.length - 1], parts[1]].filter((q): q is string => !!q && q.length >= 2))];
  for (const q of queries) {
    const found = (await searchDestinations(q, 30)).find((c) => c.id === id);
    if (found) return found;
  }
  return null;
}
