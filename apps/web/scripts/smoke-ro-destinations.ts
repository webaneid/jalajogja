// Uji logika lokal-dulu P1 dengan DB lokal + API RajaOngkir PALSU (tidak memakai kuota asli).
// Jalankan: cd apps/web && bun run --preload ./scripts/stub-server-only.ts scripts/smoke-ro-destinations.ts
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
  else if (q === "bener tegalrejo") rows = [mk(31397, "BENER")];
  else if (q === "jakarta") rows = Array.from({ length: 30 }, (_, i) => mk(40000 + i, `JAKARTA${i}`)); // terpotong
  else rows = [];
  return new Response(JSON.stringify({ meta: { code: rows.length ? 200 : 404 }, data: rows.length ? rows : null }), { status: 200 });
}) as typeof fetch;

const { searchDestinationsLocalFirst, resolveDestination } = await import("../lib/ro-destinations.server");
const { RO_DAILY_LIMITS } = await import("../lib/ro-budget.server");

let fails = 0;
const check = (name: string, ok: boolean, extra = "") => { console.log(`${ok ? "OK  " : "GAGAL"}  ${name} ${extra}`); if (!ok) fails++; };

await db.execute(sql`TRUNCATE public.ro_destinations, public.ro_search_log, public.ro_api_usage`);

let r = await searchDestinationsLocalFirst("Bener", 15);
check("1. query baru → panggil API 1x, 3 hasil", apiCalls === 1 && r.source === "api" && r.cities.length === 3, `(calls=${apiCalls}, src=${r.source})`);
r = await searchDestinationsLocalFirst("bener", 15);
check("2. query sama → lokal, tanpa API", apiCalls === 1 && r.source === "local" && r.cities.length === 3, `(calls=${apiCalls})`);
r = await searchDestinationsLocalFirst("benera", 15);
check("3. perpanjangan satu kata dari induk tak terpotong → lokal", apiCalls === 1 && r.source === "local" && r.cities.map((c) => c.id).join() === "31399", `(calls=${apiCalls}, ids=${r.cities.map((c) => c.id)})`);
r = await searchDestinationsLocalFirst("bener tegalrejo", 15);
check("4. query multi-kata baru → API", apiCalls === 2 && r.source === "api", `(calls=${apiCalls})`);
r = await searchDestinationsLocalFirst("jakarta", 15);
check("5a. hasil terpotong (30) → disimpan, kembali 15", apiCalls === 3 && r.cities.length === 15, `(calls=${apiCalls})`);
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
await db.execute(sql`TRUNCATE public.ro_search_log, public.ro_api_usage`);
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
check("12. query 2 huruf tak memicu API", apiCalls === 0 && short.source === "local-degraded");

apiCalls = 0;
const [p1, p2, p3] = await Promise.all([1, 2, 3].map(() => searchDestinationsLocalFirst("bener", 5)));
check("13. permintaan bersamaan query sama → 1 panggilan (single-flight)", apiCalls === 1 && p1.cities.length > 0 && p2.cities.length > 0 && p3.cities.length > 0, `(calls=${apiCalls})`);

// jatah 'resolve' terpisah dari 'search'
await db.execute(sql`TRUNCATE public.ro_destinations, public.ro_search_log, public.ro_api_usage`);
const { tryConsumeApiBudget } = await import("../lib/ro-budget.server");
for (let i = 0; i < RO_DAILY_LIMITS.search; i++) await tryConsumeApiBudget("search");
apiCalls = 0;
const rv = await resolveDestination(31397, "BENER, TEGALREJO, YOGYAKARTA, DI YOGYAKARTA, 55243");
check("14. pencarian publik habis, resolve masih punya jatah sendiri", rv?.id === 31397 && apiCalls === 1, `(calls=${apiCalls})`);

console.log(fails === 0 ? "\nSEMUA LULUS" : `\n${fails} GAGAL`);
process.exit(fails === 0 ? 0 : 1);
