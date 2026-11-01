// SATU-SATUNYA pintu panggilan RajaOngkir (Komerce v2) untuk ongkir & pencarian tujuan. Dipakai route /api/ongkir/{cost,cities}
// DAN verifikasi ongkir server saat checkout. API key dari ENV, tidak pernah ke browser. Doc: docs/arsitektur-portal-produsen.md § 26.
import "server-only";
import { tryConsumeApiBudget, markBudgetExhausted } from "@/lib/ro-budget.server";

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
const costCache = new Map<string, { at: number; options: FlatCourierOption[] }>();
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
  // Anggaran harian ongkir (ro_api_usage) — cache miss = 1 panggilan upstream. Habis → jangan memanggil (kuota pencarian ikut terlindungi)
  if (!(await tryConsumeApiBudget("cost"))) throw new RajaOngkirError("Layanan ongkir sedang dibatasi", 429);
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
  if (res.status === 429) { await markBudgetExhausted("cost"); throw new RajaOngkirError("Layanan ongkir sedang dibatasi", 429); }
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
  if (res.status === 429) throw new RajaOngkirError("Layanan ongkir sedang dibatasi", 429);
  const data = await res.json().catch(() => null) as { meta?: { code: number; message?: string }; data?: V2Destination[] | null } | null;
  // HANYA 404 yang berarti "tidak ada hasil". Galat lain (key salah, upstream mati) HARUS dilempar — kalau tidak, jawaban kosong
  // palsu tercatat sebagai "tercakup" di ro_search_log dan menyembunyikan lokasi sah.
  if (res.status === 404 || data?.meta?.code === 404) return [];
  if (!res.ok || !data?.meta) throw new RajaOngkirError("Gagal menghubungi RajaOngkir", 502);
  if (data.meta.code !== 200) {
    console.error("[rajaongkir] search error:", data.meta.code, data.meta.message);
    throw new RajaOngkirError("RajaOngkir error", 502);
  }
  const cities = (data.data ?? []).map((d) => ({
    id: d.id, label: d.label, cityName: d.city_name, districtName: d.district_name,
    subdistrictName: d.subdistrict_name, provinceName: d.province_name, zipCode: d.zip_code,
  }));
  return cities;
}
