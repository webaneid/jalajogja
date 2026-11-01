// Data tujuan RajaOngkir LOKAL-DULU (read-through). Cari di public.ro_destinations; hanya bila belum tercakup → panggil API
// (dibatasi anggaran harian), simpan semua baris hasilnya. Publik & dibagi semua tenant. Doc: docs/arsitektur-alamat.md § 11.
import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, roDestinations, roSearchLog } from "@jalajogja/db";
import { searchDestinations, RajaOngkirError, type OngkirCity } from "@/lib/rajaongkir.server";
import { tryConsumeApiBudget, markBudgetExhausted } from "@/lib/ro-budget.server";

/**
 * Ukuran halaman yang diminta ke API. Hasil sebanyak ini = "terpotong" (mungkin masih ada lagi).
 * 250 TERBUKTI dihormati: tes user 2026-11-02 (search=jakarta&limit=1000) mengembalikan 268 baris. Jangan naikkan melewati
 * angka yang terbukti — bila API diam-diam membatasi di bawah nilai ini, hasil terpotong akan dianggap lengkap.
 */
export const SEARCH_PAGE = 250;
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
 * Fakta API (tes user 2026-11-02): pencarian multi-kata bersifat ATAU (hasil "BENER TEGALREJO" memuat baris yang hanya cocok
 * dengan "tegalrejo"). Jadi himpunan jawaban DAN (yang kita tampilkan) selalu ⊆ hasil satu kata mana pun dalam query itu.
 *
 * Query "tercakup" (cukup dijawab lokal) bila:
 *  (a) query PERSIS sama pernah diambil (juga bila terpotong — pengulangan tak perlu menghabiskan kuota), atau
 *  (b) untuk SALAH SATU kata (≥3 huruf) dalam query: kata itu, atau awalan-nya yang ≥3 huruf, pernah diambil dan TIDAK terpotong
 *      (hasilnya lengkap, sehingga penyaringan lokal pada kata-kata lain dalam query itu eksak).
 */
async function isCovered(norm: string): Promise<boolean> {
  const candidates = new Set([norm]);
  for (const t of norm.split(" ")) {
    if (t.length < MIN_API_QUERY) continue;
    for (let i = MIN_API_QUERY; i <= t.length; i++) candidates.add(t.slice(0, i));
  }
  const rows = await db.select({ q: roSearchLog.queryNorm, truncated: roSearchLog.truncated })
    .from(roSearchLog)
    .where(and(
      inArray(roSearchLog.queryNorm, [...candidates]),
      sql`${roSearchLog.fetchedAt} > now() - make_interval(days => ${LOG_TTL_DAYS})`,
      sql`(${roSearchLog.resultCount} > 0 OR ${roSearchLog.fetchedAt} > now() - make_interval(hours => ${EMPTY_TTL_HOURS}))`,
    ));
  return rows.some((r) => r.q === norm || !r.truncated);
}

async function saveRows(cities: OngkirCity[]): Promise<void> {
  if (cities.length === 0) return;
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

async function logQuery(norm: string, resultCount: number, truncated: boolean): Promise<void> {
  await db.insert(roSearchLog).values({ queryNorm: norm, resultCount, truncated })
    .onConflictDoUpdate({ target: roSearchLog.queryNorm, set: { resultCount, truncated, fetchedAt: sql`now()` } });
}

/** Kata → apakah hasil pengambilan terakhirnya terpotong. Hanya log yang masih segar (TTL sama dengan isCovered). */
async function freshTokenLogs(tokens: string[]): Promise<Map<string, boolean>> {
  const rows = await db.select({ q: roSearchLog.queryNorm, truncated: roSearchLog.truncated }).from(roSearchLog).where(and(
    inArray(roSearchLog.queryNorm, tokens),
    sql`${roSearchLog.fetchedAt} > now() - make_interval(days => ${LOG_TTL_DAYS})`,
    sql`(${roSearchLog.resultCount} > 0 OR ${roSearchLog.fetchedAt} > now() - make_interval(hours => ${EMPTY_TTL_HOURS}))`,
  ));
  return new Map(rows.map((r) => [r.q, r.truncated]));
}

async function localMatchCount(token: string): Promise<number> {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(roDestinations).where(sql`${roDestinations.searchText} LIKE ${"%" + token + "%"}`);
  return r?.n ?? 0;
}

const DEGRADED_NOTICE = "Pencarian lokasi baru sedang dibatasi hari ini — menampilkan lokasi yang sudah tersimpan.";
const PARTIAL_NOTICE = "Hasil mungkin belum lengkap — tambahkan kata yang lebih spesifik (mis. nama kelurahan).";
/** Paling banyak berapa kata-jangkar diambil dari API untuk satu query (tiap jangkar = 1 jatah). */
const MAX_ANCHORS = 3;

export type SearchOptions = {
  /** Jatah anggaran yang dipakai bila perlu memanggil API. Default 'search' (publik); checkout memakai 'resolve'. */
  budget?: "search" | "resolve";
  /** Dipanggil TEPAT sebelum memakai anggaran (mis. pembatas laju per-IP khusus jalur API). false → perlakukan seperti anggaran habis. */
  gate?: () => boolean;
};

type Phase = { fetched: number; complete: boolean; blocked: boolean };

/**
 * Mengambil dari API hanya bila perlu. Fakta API: multi-kata = ATAU, halaman 250. Jadi jawaban DAN selalu ⊆ hasil SATU kata, dan
 * kita hanya bisa yakin lengkap bila ada kata yang hasilnya TIDAK terpotong. Strategi:
 *  - kandidat jangkar = kata ≥3 huruf yang BELUM punya log segar (kata yang sudah diambil tak diambil lagi — datanya sama);
 *  - urut dari yang paling sedikit cocok di data lokal (kata langka = kelurahan, bukan kota), seri → urutan ketik;
 *  - ambil satu per satu (maks MAX_ANCHORS) sampai ada yang tidak terpotong → hasil DAN lokal pasti eksak;
 *  - bila tidak ada yang lengkap: jujur beri tahu "belum lengkap" (tidak mengklaim tercakup).
 */
async function fetchPhase(norm: string, tokens: string[], opts: SearchOptions): Promise<Phase> {
  const fresh = await freshTokenLogs(tokens);
  const candidates = tokens.filter((t) => !fresh.has(t));
  if (candidates.length === 0) return { fetched: 0, complete: false, blocked: false };

  const counts = await Promise.all(candidates.map(localMatchCount));
  const ordered = candidates.map((t, i) => ({ t, c: counts[i], i })).sort((a, b) => a.c - b.c || a.i - b.i).map((x) => x.t).slice(0, MAX_ANCHORS);

  if (opts.gate && !opts.gate()) return { fetched: 0, complete: false, blocked: true };
  const kind = opts.budget ?? "search";
  let fetched = 0;
  let completeCount: number | null = null;
  for (const anchor of ordered) {
    if (!(await tryConsumeApiBudget(kind))) return { fetched, complete: false, blocked: fetched === 0 };
    try {
      const cities = await searchDestinations(anchor, SEARCH_PAGE);
      await saveRows(cities);
      await logQuery(anchor, cities.length, cities.length >= SEARCH_PAGE);
      fetched++;
      if (cities.length < SEARCH_PAGE) { completeCount = cities.length; break; }
    } catch (e) {
      if (e instanceof RajaOngkirError && e.status === 429) await markBudgetExhausted(kind);
      throw e;
    }
  }
  // Query asli dicatat: lengkap (ada jangkar tak terpotong) atau terpotong (semua jangkar yang dicoba terpotong → hanya untuk dedupe)
  if (norm !== ordered[0] || completeCount === null) await logQuery(norm, completeCount ?? 1, completeCount === null);
  return { fetched, complete: completeCount !== null, blocked: false };
}

// Single-flight per query: dibuat & didaftarkan SINKRON (tanpa await di antara get dan set)
const inflight = new Map<string, Promise<Phase>>();

export async function searchDestinationsLocalFirst(q: string, limit = 15, opts: SearchOptions = {}): Promise<DestinationSearchResult> {
  const norm = normalizeQuery(q);
  if (norm.length < 2) return { cities: [], source: "local" };

  if (await isCovered(norm)) return { cities: await searchLocal(norm, limit), source: "local" };

  const tokens = [...new Set(norm.split(" ").filter((t) => t.length >= MIN_API_QUERY))];
  if (tokens.length === 0) return { cities: await searchLocal(norm, limit), source: "local" }; // terlalu pendek untuk API — bukan "dibatasi"

  let pending = inflight.get(norm);
  if (!pending) {
    pending = fetchPhase(norm, tokens, opts);
    inflight.set(norm, pending);
    pending.then(() => inflight.delete(norm), () => inflight.delete(norm));
  }
  let phase: Phase;
  try {
    phase = await pending;
  } catch (e) {
    if (e instanceof RajaOngkirError) {
      const local = await searchLocal(norm, limit);
      if (local.length > 0) return { cities: local, source: "local-degraded", notice: DEGRADED_NOTICE };
    }
    throw e;
  }
  const cities = await searchLocal(norm, limit);
  if (phase.blocked) return { cities, source: "local-degraded", notice: DEGRADED_NOTICE };
  if (!phase.complete) return { cities, source: phase.fetched > 0 ? "api" : "local", notice: PARTIAL_NOTICE };
  return { cities, source: "api" };
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
  // Pemulihan (paling banyak 2 query: kode pos lalu kelurahan) dengan jatah 'resolve' terpisah dari pencarian publik
  const parts = labelHint.split(",").map((s) => s.trim()).filter(Boolean);
  const zip = parts.find((s) => /^\d{4,6}$/.test(s));
  const first = parts.find((s) => !/^\d+$/.test(s) && s.length >= MIN_API_QUERY);
  let degraded = false;
  for (const q of [zip, first].filter((x): x is string => !!x)) {
    const res = await searchDestinationsLocalFirst(q, SEARCH_PAGE, { budget: "resolve" });
    const again = await get();
    if (again) return again;
    if (res.source === "local-degraded") degraded = true;
  }
  // Tak ketemu karena anggaran/degraded (bukan karena id memang palsu) → "tak bisa diverifikasi", bukan "kota tidak valid"
  if (degraded) throw new RajaOngkirError("Layanan ongkir sedang dibatasi", 429);
  return null;
}
