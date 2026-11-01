// SATU-SATUNYA pintu panggilan RajaOngkir (Komerce v2) untuk ongkir & pencarian tujuan. Dipakai route /api/ongkir/{cost,cities}
// DAN verifikasi ongkir server saat checkout. API key dari ENV, tidak pernah ke browser. Doc: docs/arsitektur-portal-produsen.md § 26.
import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, roCostCache } from "@jalajogja/db";
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

function apiKey(): string {
  const k = process.env.RAJAONGKIR_PLATFORM_KEY;
  if (!k) {
    console.error("[rajaongkir] RAJAONGKIR_PLATFORM_KEY belum diset di server");
    throw new RajaOngkirError("Layanan ongkir belum dikonfigurasi", 500); // detail hanya di log, tidak ke klien
  }
  return k;
}

const COST_TTL_HOURS = 12;
const COST_STALE_MAX_DAYS = 2;          // tarif kedaluwarsa hanya sebagai cadangan; makin lama makin berisiko salah tagih
const COST_NEG_TTL_MINUTES = 30;       // jawaban kosong ([]) hanya dipercaya singkat — bisa sementara (kurir timeout)

/** Panggilan MENTAH ke API ongkir (tanpa cache/anggaran — itu urusan fetchDomesticCost). `courier` = kode dipisah titik dua. */
async function callCostApi(origin: number, destination: number, weight: number, courier: string): Promise<FlatCourierOption[]> {
  const key = apiKey();
  // v2: POST multipart form-data, bukan URLSearchParams
  const form = new FormData();
  form.append("origin", String(origin));
  form.append("destination", String(destination));
  form.append("weight", String(weight));
  form.append("courier", courier);

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
  // Hanya opsi berbentuk sah (kode+layanan teks, biaya angka > 0): data upstream rusak tidak boleh sampai ditagih
  return (data.data ?? []).filter((o) => typeof o?.code === "string" && typeof o?.service === "string" && Number.isFinite(o.cost) && o.cost > 0);
}

type CostOpts = { budget?: "cost" | "costverify"; gate?: () => boolean };

async function loadCosts(p: { origin: number; destination: number; weight: number }, codes: string[], opts: CostOpts): Promise<FlatCourierOption[]> {
  const rows = await db.select().from(roCostCache).where(and(
    eq(roCostCache.originId, p.origin), eq(roCostCache.destinationId, p.destination),
    eq(roCostCache.weight, p.weight), inArray(roCostCache.courier, codes),
  ));
  const now = Date.now();
  const fresh = new Map<string, FlatCourierOption[]>();
  const stale = new Map<string, FlatCourierOption[]>();
  for (const r of rows) {
    const age = now - r.fetchedAt.getTime();
    const payload = r.payload as FlatCourierOption[];
    const ttl = (payload.length === 0 ? COST_NEG_TTL_MINUTES * 60_000 : COST_TTL_HOURS * 3_600_000);
    if (age < ttl) fresh.set(r.courier, payload);
    else if (payload.length > 0 && age < COST_STALE_MAX_DAYS * 86_400_000) stale.set(r.courier, payload); // [] kedaluwarsa tak berguna sebagai cadangan
  }
  const merge = (...maps: Map<string, FlatCourierOption[]>[]) =>
    codes.flatMap((c) => maps.map((m) => m.get(c)).find((v) => v !== undefined) ?? []);

  const missing = codes.filter((c) => !fresh.has(c));
  if (missing.length === 0) return merge(fresh);

  // Cadangan: tarif KEDALUWARSA (≤ 7 hari) untuk SEMUA kode yang kurang — lebih baik daripada checkout gagal saat kuota habis/API bermasalah
  const useStale = (): FlatCourierOption[] | null => {
    if (!missing.every((c) => stale.has(c))) return null;
    console.warn(`[rajaongkir] memakai tarif kedaluwarsa untuk ${missing.join(",")} (${p.origin}→${p.destination}, ${p.weight}g)`);
    return merge(fresh, stale);
  };

  const kind = opts.budget ?? "cost";
  const blocked = (opts.gate && !opts.gate()) || !(await tryConsumeApiBudget(kind));
  if (blocked) {
    const s = useStale();
    if (s) return s;
    throw new RajaOngkirError("Layanan ongkir sedang dibatasi", 429);
  }

  let options: FlatCourierOption[];
  try {
    options = await callCostApi(p.origin, p.destination, p.weight, missing.join(":"));
  } catch (e) {
    if (e instanceof RajaOngkirError && e.status !== 400) { const s = useStale(); if (s) return s; }
    throw e;
  }

  // Simpan per kode kurir (hanya kode yang DIMINTA — kode lain di respons diabaikan dan tidak dikembalikan).
  const byCode = new Map<string, FlatCourierOption[]>(missing.map((c) => [c, []]));
  const unknown = options.filter((o) => !byCode.has(o.code));
  for (const o of options) byCode.get(o.code)?.push(o);
  if (unknown.length > 0) console.warn("[rajaongkir] kode kurir tak dikenal dalam respons (diabaikan):", [...new Set(unknown.map((o) => o.code))].join(","));
  const anyData = [...byCode.values()].some((v) => v.length > 0);
  // [] hanya disimpan sebagai jawaban "tidak melayani" bila ada bukti upstream sehat (kurir lain di respons yang sama berisi data) dan
  // tak ada kode asing (anomali format). Respons yang SELURUHNYA kosong: simpan negatif singkat hanya bila belum ada baris —
  // JANGAN menimpa tarif yang baik (termasuk cadangan kedaluwarsa) dengan kosong.
  try {
    const rowsToWrite = [...byCode].filter(([, v]) => v.length > 0 || (anyData && unknown.length === 0));
    if (rowsToWrite.length > 0) {
      await db.insert(roCostCache).values(rowsToWrite.map(([courier, payload]) => ({
        originId: p.origin, destinationId: p.destination, weight: p.weight, courier, payload,
      }))).onConflictDoUpdate({
        target: [roCostCache.originId, roCostCache.destinationId, roCostCache.weight, roCostCache.courier],
        set: { payload: sql`excluded.payload`, fetchedAt: sql`now()` },
      });
    } else if (unknown.length === 0) {
      await db.insert(roCostCache).values(missing.map((courier) => ({
        originId: p.origin, destinationId: p.destination, weight: p.weight, courier, payload: [] as unknown[],
      }))).onConflictDoNothing();
    }
    if (Math.random() < 0.05) void db.delete(roCostCache).where(sql`${roCostCache.fetchedAt} < now() - interval '14 days'`).catch(() => {}); // kebersihan oportunistik
  } catch (e) {
    console.error("[rajaongkir] gagal menyimpan cache ongkir (diabaikan, hasil tetap dikembalikan):", e);
  }
  return merge(fresh, byCode);
}

// Single-flight per kunci: permintaan bersamaan yang sama berbagi satu panggilan (didaftarkan SINKRON, tanpa await sebelum set)
const costInflight = new Map<string, Promise<FlatCourierOption[]>>();

/**
 * Biaya kirim dengan cache DB 12 jam (public.ro_cost_cache, dibagi semua tenant; berat = gram persis). `courier` = kode dipisah
 * titik dua ("jne:tiki"); cache per KODE, jadi panggilan multi-kurir dari form mengisi cache untuk verifikasi satu-kurir saat submit.
 * Cache miss = 1 jatah anggaran `cost`. Melempar RajaOngkirError bila gagal dan tak ada cadangan. Doc: docs/arsitektur-alamat.md § 14.
 */
export function fetchDomesticCost(p: { origin: number; destination: number; weight: number; courier: string } & CostOpts): Promise<FlatCourierOption[]> {
  const codes = [...new Set(p.courier.split(":").map((c) => c.trim()).filter(Boolean))];
  if (codes.length === 0) return Promise.resolve([]);
  const key = `${p.origin}|${p.destination}|${p.weight}|${[...codes].sort().join(":")}`;
  const running = costInflight.get(key);
  if (running) return running;
  const run = loadCosts(p, codes, { budget: p.budget, gate: p.gate });
  costInflight.set(key, run);
  run.then(() => costInflight.delete(key), () => costInflight.delete(key));
  return run;
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
