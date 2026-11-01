// Uji logika lokal-dulu P1 dengan DB lokal + API RajaOngkir PALSU (tidak memakai kuota asli).
// Jalankan: cd apps/web && bun run --preload ./scripts/stub-server-only.ts scripts/smoke-ro-destinations.ts
// Pengaman: skrip uji MENGHAPUS data — hanya boleh di DB lokal.
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL ?? "")) { console.error("Ditolak: skrip uji hanya untuk DATABASE_URL lokal."); process.exit(2); }
import { sql } from "drizzle-orm";
import { db } from "@jalajogja/db";
process.env.RAJAONGKIR_PLATFORM_KEY = "test-key";

let apiCalls = 0;
let mode: "ok" | "429" | "500" = "ok";
const mk = (id: number, kel: string) => ({
  id, label: `${kel}, TEGALREJO, YOGYAKARTA, DI YOGYAKARTA, 55243`, province_name: "DI YOGYAKARTA", city_name: "YOGYAKARTA",
  district_name: "TEGALREJO", subdistrict_name: kel, zip_code: "55243",
});
globalThis.fetch = (async (input: RequestInfo | URL) => {
  apiCalls++;
  const url = String(input);
  if (mode === "429") return new Response("{}", { status: 429 });
  if (mode === "500") return new Response(JSON.stringify({ meta: { code: 500, message: "boom" } }), { status: 500 });
  const q = decodeURIComponent(new URL(url).searchParams.get("search") ?? "").toLowerCase();
  let rows: ReturnType<typeof mk>[] = [];
  if (q === "bener") rows = [mk(31397, "BENER"), mk(31398, "BENER UTARA"), mk(31399, "BENERAN")];
  else if (q === "kebon") rows = [{ ...mk(50001, "KEBON JERUK"), label: "KEBON JERUK, KEBON JERUK, JAKARTA BARAT, DKI JAKARTA, 11530", city_name: "JAKARTA BARAT" }];
  else if (q === "tegalrejo") rows = [mk(31400, "TEGALREJO"), mk(31397, "BENER"), mk(31398, "KARANGWARU"), mk(31399, "KRICAK")];
  else if (q === "karangwaru") rows = [mk(31398, "KARANGWARU")];
  else if (q === "jakarta") rows = Array.from({ length: 250 }, (_, i) => mk(40000 + i, `JAKARTA${i}`)); // terpotong
  else rows = [];
  return new Response(JSON.stringify({ meta: { code: rows.length ? 200 : 404 }, data: rows.length ? rows : null }), { status: 200 });
}) as typeof fetch;

const { searchDestinationsLocalFirst, resolveDestination, SEARCH_PAGE } = await import("../lib/ro-destinations.server");
const { RO_DAILY_LIMITS } = await import("../lib/ro-budget.server");


// Bersihkan data uji tanpa TRUNCATE (ro_destinations dirujuk FK address_book) dan tanpa multi-statement
const clearAll = async () => {
  await db.execute(sql`DELETE FROM public.ro_search_log`);
  await db.execute(sql`DELETE FROM public.ro_api_usage`);
  // Jangan hapus tujuan yang dirujuk FK: buku alamat (public) dan shipping_origins di SEMUA schema tenant
  const slugs = (Array.from(await db.execute(sql`SELECT slug FROM public.tenants`)) as { slug: string }[]).map((r) => r.slug);
  const refs = [`SELECT destination_id FROM public.address_book`];
  for (const slug of slugs) {
    const has = Array.from(await db.execute(sql`SELECT to_regclass(${`"tenant_${slug}".shipping_origins`}) AS t`))[0] as { t: string | null };
    if (has.t) refs.push(`SELECT destination_id FROM "tenant_${slug}".shipping_origins`);
  }
  await db.execute(sql.raw(`DELETE FROM public.ro_destinations WHERE id NOT IN (${refs.join(" UNION ")})`));
};
let fails = 0;
const check = (name: string, ok: boolean, extra = "") => { console.log(`${ok ? "OK  " : "GAGAL"}  ${name} ${extra}`); if (!ok) fails++; };

await clearAll();

let r = await searchDestinationsLocalFirst("Bener", 15);
check("1. query baru → panggil API 1x, 3 hasil", apiCalls === 1 && r.source === "api" && r.cities.length === 3, `(calls=${apiCalls}, src=${r.source})`);
r = await searchDestinationsLocalFirst("bener", 15);
check("2. query sama → lokal, tanpa API", apiCalls === 1 && r.source === "local" && r.cities.length === 3, `(calls=${apiCalls})`);
r = await searchDestinationsLocalFirst("benera", 15);
check("3. perpanjangan satu kata dari induk tak terpotong → lokal", apiCalls === 1 && r.source === "local" && r.cities.map((c) => c.id).join() === "31399", `(calls=${apiCalls}, ids=${r.cities.map((c) => c.id)})`);
r = await searchDestinationsLocalFirst("bener tegalrejo", 15);
check("4a. multi-kata: salah satu kata ('bener') lengkap → lokal, saring DAN", apiCalls === 1 && r.source === "local" && r.cities.map((c) => c.id).sort().join() === "31397,31398,31399", `(calls=${apiCalls}, ids=${r.cities.map((c) => c.id)})`); // ketiga baris "bener*" memang berkecamatan TEGALREJO
r = await searchDestinationsLocalFirst("kricak karangwaru", 15);
check("4b. multi-kata tanpa kata tercakup → API untuk SATU kata (yang paling sedikit cocok lokal; seri → urutan ketik), berhenti setelah ada yang lengkap", apiCalls === 2 && r.cities.length === 0, `(calls=${apiCalls})`);
const lg = Array.from(await db.execute(sql`SELECT query_norm FROM public.ro_search_log WHERE query_norm IN ('kricak','karangwaru','kricak karangwaru') ORDER BY 1`)).map((x) => (x as { query_norm: string }).query_norm).join("|");
check("4c. jangkar & query asli sama-sama dicatat", lg === "kricak|kricak karangwaru", `(${lg})`);
r = await searchDestinationsLocalFirst("kricak karangwaru", 15);
check("4d. ulang query multi-kata → lokal", apiCalls === 2 && r.source === "local", `(calls=${apiCalls})`);
r = await searchDestinationsLocalFirst("jakarta", 15);
check("5a. hasil terpotong (250) → disimpan, kembali 15", apiCalls === 3 && r.cities.length === 15, `(calls=${apiCalls})`);
r = await searchDestinationsLocalFirst("jakartax", 15);
check("5b. perpanjangan dari induk TERPOTONG → tetap API", apiCalls === 4 && r.source === "api" && r.cities.length === 0, `(calls=${apiCalls})`);
const d = await resolveDestination(31397, "BENER, TEGALREJO, YOGYAKARTA, DI YOGYAKARTA, 55243");
check("6. resolveDestination id ada → lokal, tanpa API", d?.id === 31397 && apiCalls === 4, `(calls=${apiCalls})`);
const miss = await resolveDestination(99999999, "TIDAKADA, X, Y, Z, 1");
check("7. id palsu → null (ditolak)", miss === null);

// Anggaran harian: habiskan jatah pencarian
await db.execute(sql`TRUNCATE public.ro_api_usage`);
apiCalls = 0;
let degraded = 0;
for (let i = 0; i < RO_DAILY_LIMITS.search + 8; i++) {
  const x = await searchDestinationsLocalFirst(`qq${i}zz`, 5);
  if (x.source === "local-degraded") degraded++;
}
check(`8. anggaran ${RO_DAILY_LIMITS.search}/hari ditegakkan`, apiCalls === RO_DAILY_LIMITS.search && degraded === 8, `(calls=${apiCalls}, degraded=${degraded})`);

// 429 dari upstream → jatah ditandai habis
await db.execute(sql`TRUNCATE public.ro_api_usage`);
mode = "429"; apiCalls = 0;
const e1 = await searchDestinationsLocalFirst("bogor", 5).then(() => "tanpa-error", () => "error");
const e2 = await searchDestinationsLocalFirst("depok", 5);
check("9. 429 → berhenti memanggil API sesudahnya", apiCalls === 1 && e2.source === "local-degraded", `(calls=${apiCalls}, pertama=${e1})`);

// --- Perbaikan audit P1 ---
await db.execute(sql`DELETE FROM public.ro_search_log`);
await db.execute(sql`DELETE FROM public.ro_api_usage`);
mode = "500"; apiCalls = 0;
await searchDestinationsLocalFirst("yogya", 5).catch(() => null);
mode = "ok";
const logRows = Array.from(await db.execute(sql`SELECT 1 FROM public.ro_search_log WHERE query_norm = 'yogya'`)).length;
await searchDestinationsLocalFirst("yogya", 5).catch(() => null);
check("10. galat upstream (500) TIDAK dicatat sebagai tercakup → diulang ke API", logRows === 0 && apiCalls === 2, `(log=${logRows}, calls=${apiCalls})`);

apiCalls = 0;
const g = await searchDestinationsLocalFirst("surabaya", 5, { gate: () => false });
check("11. gerbang per-IP menolak → tanpa API, degraded", apiCalls === 0 && g.source === "local-degraded");

const short = await searchDestinationsLocalFirst("ab", 5);
check("12. query 2 huruf tak memicu API & tanpa notice 'dibatasi'", apiCalls === 0 && short.source === "local" && !short.notice);

apiCalls = 0;
const [p1, p2, p3] = await Promise.all([1, 2, 3].map(() => searchDestinationsLocalFirst("bener", 5)));
check("13. permintaan bersamaan query sama → 1 panggilan (single-flight)", apiCalls === 1 && p1.cities.length > 0 && p2.cities.length > 0 && p3.cities.length > 0, `(calls=${apiCalls})`);

// jatah 'resolve' terpisah dari 'search'
await clearAll();
const { tryConsumeApiBudget } = await import("../lib/ro-budget.server");
for (let i = 0; i < RO_DAILY_LIMITS.search; i++) await tryConsumeApiBudget("search");
apiCalls = 0;
const rv = await resolveDestination(31397, "BENER, TEGALREJO, YOGYAKARTA, DI YOGYAKARTA, 55243");
check("14. pencarian publik habis, resolve masih punya jatah sendiri (kode pos lalu kelurahan)", rv?.id === 31397 && apiCalls === 2, `(calls=${apiCalls})`);

// Audit ronde 3: jangkar terpotong → naik ke kata berikutnya; kata terpotong tak diambil ulang tiap ketukan
await clearAll();
apiCalls = 0;
await searchDestinationsLocalFirst("jakarta", 5);                       // terpotong (250)
const before = apiCalls;
const k1 = await searchDestinationsLocalFirst("jakarta pu", 5);          // 'pu' terlalu pendek, 'jakarta' sudah diambil
const k2 = await searchDestinationsLocalFirst("jakarta pus", 5);         // 'pus' baru → hanya 'pus' yang boleh diambil
check("15a. kata terpotong yang sudah diambil TIDAK diambil ulang tiap ketukan", before === 1 && k1.source === "local" && !!k1.notice && apiCalls === 2, `(calls=${apiCalls}, src=${k1.source})`);
apiCalls = 0;
const e = await searchDestinationsLocalFirst("kebon jakarta", 5);        // 'jakarta' sudah terpotong → ambil 'kebon' → lengkap
check("15b. jangkar lain yang LENGKAP membuat hasil eksak (kebon + jakarta)", apiCalls === 1 && e.source === "api" && !e.notice && e.cities.map((c) => c.id).join() === "50001", `(calls=${apiCalls}, ids=${e.cities.map((c) => c.id)})`);
const again = await searchDestinationsLocalFirst("kebon jakarta", 5);
check("15c. ulang → lokal", apiCalls === 1 && again.source === "local");

console.log(fails === 0 ? "\nSEMUA LULUS" : `\n${fails} GAGAL`);
process.exit(fails === 0 ? 0 : 1);
