// Data tujuan RajaOngkir LOKAL-DULU (read-through). Cari di public.ro_destinations; hanya bila belum tercakup → panggil API
// (dibatasi anggaran harian), simpan semua baris hasilnya. Publik & dibagi semua tenant. Doc: docs/arsitektur-alamat.md § 11.
import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, roDestinations, roSearchLog } from "@jalajogja/db";
import { searchDestinations, RajaOngkirError, type OngkirCity } from "@/lib/rajaongkir.server";
import { tryConsumeApiBudget, markBudgetExhausted } from "@/lib/ro-budget.server";

/** Ukuran halaman yang diminta ke API. Hasil sebanyak ini = "terpotong" (mungkin masih ada lagi). */
export const SEARCH_PAGE = 30;
const LOG_TTL_DAYS = 90;
const EMPTY_TTL_HOURS = 24; // jawaban 0 hasil: kemungkinan salah ketik — jangan dipercaya lama
/** Query dengan panjang ini ke bawah hanya dijawab lokal (tidak boleh memicu API). */
const MIN_API_QUERY = 3;

/** Huruf kecil, hanya [a-z0-9 ] — juga membuang karakter wildcard LIKE (% _). */
export function foldText(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
export const normalizeQuery = (q: string) => foldText(q).slice(0, 100);

export type DestinationSearchResult = {
  cities: OngkirCity[];
  source: "local" | "api" | "local-degraded";
  notice?: string;
};

const toCity = (r: typeof roDestinations.$inferSelect): OngkirCity => ({
  id: r.id, label: r.label, cityName: r.cityName, districtName: r.districtName,
  subdistrictName: r.subdistrictName, provinceName: r.provinceName, zipCode: r.zipCode,
});

async function searchLocal(norm: string, limit: number): Promise<OngkirCity[]> {
  const tokens = norm.split(" ").filter(Boolean);
  if (tokens.length === 0) return [];
  const rows = await db.select().from(roDestinations)
    .where(and(...tokens.map((t) => sql`${roDestinations.searchText} LIKE ${"%" + t + "%"}`)))
    .orderBy(sql`(lower(${roDestinations.subdistrictName}) LIKE ${tokens[0] + "%"}) DESC`, sql`length(${roDestinations.label})`, roDestinations.id)
    .limit(limit);
  return rows.map(toCity);
}

/**
 * Query "tercakup" bila: (a) query PERSIS sama pernah diambil dari API, atau (b) query satu-kata ini memperpanjang kata dari
 * query-induk yang hasilnya TIDAK terpotong (hasil query lebih panjang pasti himpunan bagiannya). Query multi-kata: hanya (a),
 * karena cara API mencocokkan beberapa kata belum terverifikasi.
 */
async function isCovered(norm: string): Promise<boolean> {
  const candidates = [norm];
  if (!norm.includes(" ")) for (let i = 3; i < norm.length; i++) candidates.push(norm.slice(0, i));
  const rows = await db.select({ q: roSearchLog.queryNorm, truncated: roSearchLog.truncated })
    .from(roSearchLog)
    .where(and(
      inArray(roSearchLog.queryNorm, candidates),
      sql`${roSearchLog.fetchedAt} > now() - make_interval(days => ${LOG_TTL_DAYS})`,
      sql`(${roSearchLog.resultCount} > 0 OR ${roSearchLog.fetchedAt} > now() - make_interval(hours => ${EMPTY_TTL_HOURS}))`,
    ));
  return rows.some((r) => r.q === norm || !r.truncated);
}

async function saveResults(norm: string, cities: OngkirCity[]): Promise<void> {
  if (cities.length > 0) {
    await db.insert(roDestinations).values(cities.map((c) => ({
      id: c.id, label: c.label, provinceName: c.provinceName, cityName: c.cityName, districtName: c.districtName,
      subdistrictName: c.subdistrictName, zipCode: c.zipCode ?? "", searchText: foldText(c.label),
    }))).onConflictDoUpdate({
      target: roDestinations.id,
      set: {
        label: sql`excluded.label`, provinceName: sql`excluded.province_name`, cityName: sql`excluded.city_name`,
        districtName: sql`excluded.district_name`, subdistrictName: sql`excluded.subdistrict_name`,
        zipCode: sql`excluded.zip_code`, searchText: sql`excluded.search_text`, syncedAt: sql`now()`,
      },
    });
  }
  await db.insert(roSearchLog).values({ queryNorm: norm, resultCount: cities.length, truncated: cities.length >= SEARCH_PAGE })
    .onConflictDoUpdate({
      target: roSearchLog.queryNorm,
      set: { resultCount: cities.length, truncated: cities.length >= SEARCH_PAGE, fetchedAt: sql`now()` },
    });
}

const DEGRADED_NOTICE = "Pencarian lokasi baru sedang dibatasi hari ini — menampilkan lokasi yang sudah tersimpan.";

export type SearchOptions = {
  /** Jatah anggaran yang dipakai bila perlu memanggil API. Default 'search' (publik); checkout memakai 'resolve'. */
  budget?: "search" | "resolve";
  /** Dipanggil TEPAT sebelum memakai anggaran (mis. pembatas laju per-IP khusus jalur API). false → perlakukan seperti anggaran habis. */
  gate?: () => boolean;
};

// Single-flight: permintaan bersamaan untuk query yang sama berbagi satu panggilan API (autocomplete banyak pengguna)
const inflight = new Map<string, Promise<DestinationSearchResult>>();

export async function searchDestinationsLocalFirst(q: string, limit = 15, opts: SearchOptions = {}): Promise<DestinationSearchResult> {
  const norm = normalizeQuery(q);
  if (norm.length < 2) return { cities: [], source: "local" };

  if (await isCovered(norm)) return { cities: await searchLocal(norm, limit), source: "local" };

  const degraded = async (): Promise<DestinationSearchResult> =>
    ({ cities: await searchLocal(norm, limit), source: "local-degraded", notice: DEGRADED_NOTICE });
  if (norm.length < MIN_API_QUERY) return degraded();

  const existing = inflight.get(norm);
  if (existing) { const r = await existing; return { ...r, cities: r.cities.slice(0, limit) }; }

  if (opts.gate && !opts.gate()) return degraded();
  if (!(await tryConsumeApiBudget(opts.budget ?? "search"))) return degraded();

  const run = (async (): Promise<DestinationSearchResult> => {
    try {
      const cities = await searchDestinations(norm, SEARCH_PAGE);
      await saveResults(norm, cities);
      return { cities: cities.slice(0, limit), source: "api" };
    } catch (e) {
      if (e instanceof RajaOngkirError) {
        if (e.status === 429) await markBudgetExhausted(opts.budget ?? "search");
        const local = await searchLocal(norm, limit);
        if (local.length > 0) return { cities: local, source: "local-degraded", notice: DEGRADED_NOTICE };
      }
      throw e;
    }
  })();
  inflight.set(norm, run);
  try { return await run; } finally { inflight.delete(norm); }
}

/**
 * Tujuan OTORITATIF dari id yang dikirim klien: baris di tabel lokal (data dari API, bukan kiriman klien). Pembeli hanya bisa
 * memilih id dari hasil pencarian kita, jadi barisnya SUDAH ada → nol panggilan API. Bila belum ada (mis. sesi lama sebelum
 * tabel ini), coba sekali lewat pencarian terbatas anggaran; tetap tak ada → null (ditolak).
 */
export async function resolveDestination(id: number, labelHint: string): Promise<OngkirCity | null> {
  const get = async () => {
    const [r] = await db.select().from(roDestinations).where(eq(roDestinations.id, id)).limit(1);
    return r ? toCity(r) : null;
  };
  const found = await get();
  if (found) return found;
  // Pemulihan SEKALI (1 query, kata pertama label) dengan jatah 'resolve' terpisah — bukan 2 query & bukan jatah pencarian publik
  const first = labelHint.split(",").map((s) => s.trim()).find((s) => s.length >= MIN_API_QUERY);
  if (!first) return null;
  const res = await searchDestinationsLocalFirst(first, SEARCH_PAGE, { budget: "resolve" });
  const again = await get();
  if (again) return again;
  // Tidak ketemu karena anggaran/degraded (bukan karena id memang palsu) → sinyal "tak bisa diverifikasi", bukan "kota tidak valid"
  if (res.source === "local-degraded") throw new RajaOngkirError("Layanan ongkir sedang dibatasi", 429);
  return null;
}
