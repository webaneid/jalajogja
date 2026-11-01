// Uji cache ongkir P5 (docs/arsitektur-alamat.md § 14) dengan DB lokal + API RajaOngkir PALSU (tanpa kuota asli).
// Jalankan: cd apps/web && bun run --preload ./scripts/stub-server-only.ts scripts/smoke-ro-cost.ts
import { sql } from "drizzle-orm";
import { db } from "@jalajogja/db";
process.env.RAJAONGKIR_PLATFORM_KEY = "test-key";

let apiCalls = 0;
const requested: string[] = [];
let mode: "ok" | "500" | "429" | "weird" | "empty" | "badcost" = "ok";
const opt = (code: string, service: string, cost: number) => ({ name: code.toUpperCase(), code, service, description: service, cost, etd: "2-3 D" });
globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
  apiCalls++;
  if (mode === "429") return new Response("{}", { status: 429 });
  if (mode === "500") return new Response("boom", { status: 500 });
  const f = init?.body as FormData;
  const codes = String(f.get("courier")).split(":");
  requested.push(codes.join(":"));
  const weight = Number(f.get("weight"));
  const data: ReturnType<typeof opt>[] = [];
  if (mode === "empty") return new Response(JSON.stringify({ meta: { code: 200 }, data: null }), { status: 200 });
  for (const c of codes) {
    if (mode === "badcost") { data.push(opt(c, "REG", -5)); data.push(opt(c, "OKE", 12000)); continue; }
    if (c === "tiki") continue;                          // tiki tidak melayani rute ini
    if (mode === "weird" && c === "jne") { data.push(opt("JNE-X", "REG", 9999)); continue; }
    data.push(opt(c, "REG", 8000 * Math.ceil(weight / 1000)));
  }
  return new Response(JSON.stringify({ meta: { code: 200 }, data }), { status: 200 });
}) as typeof fetch;

const { fetchDomesticCost } = await import("../lib/rajaongkir.server");
const { tryConsumeApiBudget, RO_DAILY_LIMITS } = await import("../lib/ro-budget.server");

let fails = 0;
const check = (name: string, ok: boolean, extra = "") => { console.log(`${ok ? "OK  " : "GAGAL"}  ${name} ${extra}`); if (!ok) fails++; };
const reset = async () => { await db.execute(sql`TRUNCATE public.ro_cost_cache, public.ro_api_usage`); apiCalls = 0; requested.length = 0; mode = "ok"; };
const P = { origin: 31397, destination: 17000, weight: 1500 };

await reset();
let r = await fetchDomesticCost({ ...P, courier: "jne" });
check("1. miss → 1 panggilan, hasil benar", apiCalls === 1 && r.length === 1 && r[0].cost === 16000, `(calls=${apiCalls})`);
r = await fetchDomesticCost({ ...P, courier: "jne" });
check("2. ulang → dari cache, tanpa API", apiCalls === 1 && r[0].cost === 16000, `(calls=${apiCalls})`);

await reset();
r = await fetchDomesticCost({ ...P, courier: "jne:tiki:pos" });
check("3a. multi-kurir → 1 panggilan; hanya kurir yang melayani muncul", apiCalls === 1 && r.map((x) => x.code).sort().join() === "jne,pos", `(${r.map((x) => x.code)})`);
r = await fetchDomesticCost({ ...P, courier: "jne" });
check("3b. verifikasi SATU kurir sesudah form multi-kurir → kena cache", apiCalls === 1);
r = await fetchDomesticCost({ ...P, courier: "tiki" });
check("3c. kurir tanpa layanan tersimpan sebagai [] → kena cache, hasil kosong", apiCalls === 1 && r.length === 0);
r = await fetchDomesticCost({ ...P, courier: "jne:sicepat" });
check("3d. sebagian ada di cache → hanya yang kurang diminta ke API", apiCalls === 2 && requested[1] === "sicepat" && r.map((x) => x.code).sort().join() === "jne,sicepat", `(diminta=${requested[1]})`);

r = await fetchDomesticCost({ ...P, weight: 1501, courier: "jne" });
check("4. berat beda (gram persis) → kunci beda → API", apiCalls === 3 && r[0].cost === 16000);

await reset();
await fetchDomesticCost({ ...P, courier: "jne" });
await db.execute(sql`UPDATE public.ro_cost_cache SET fetched_at = now() - interval '13 hours'`);
r = await fetchDomesticCost({ ...P, courier: "jne" });
check("5. lewat 12 jam → ambil ulang", apiCalls === 2);

await reset();
await fetchDomesticCost({ ...P, courier: "jne" });
await db.execute(sql`UPDATE public.ro_cost_cache SET fetched_at = now() - interval '1 day'`);
for (let i = 0; i < RO_DAILY_LIMITS.cost; i++) await tryConsumeApiBudget("cost");
apiCalls = 0;
r = await fetchDomesticCost({ ...P, courier: "jne" });
check("6a. kuota habis + ada cache kedaluwarsa → dipakai (tanpa API)", apiCalls === 0 && r[0]?.cost === 16000);
const noStale = await fetchDomesticCost({ ...P, destination: 99999, courier: "jne" }).then(() => "ok", (e) => (e as { status?: number }).status);
check("6b. kuota habis + tanpa cache → galat 429", noStale === 429 && apiCalls === 0, `(${noStale})`);

await reset();
await fetchDomesticCost({ ...P, courier: "jne" });
await db.execute(sql`UPDATE public.ro_cost_cache SET fetched_at = now() - interval '1 day'`);
mode = "500";
r = await fetchDomesticCost({ ...P, courier: "jne" });
check("7a. API error 500 + ada cache kedaluwarsa → dipakai", r[0]?.cost === 16000);
await db.execute(sql`UPDATE public.ro_cost_cache SET fetched_at = now() - interval '3 days'`);
const tooOld = await fetchDomesticCost({ ...P, courier: "jne" }).then(() => "ok", () => "error");
check("7b. cache lebih tua dari 2 hari TIDAK dipakai", tooOld === "error");

await reset();
const par = await Promise.all([1, 2, 3, 4].map(() => fetchDomesticCost({ ...P, courier: "jne" })));
check("8. permintaan bersamaan yang sama → 1 panggilan (single-flight)", apiCalls === 1 && par.every((x) => x.length === 1), `(calls=${apiCalls})`);

await reset();
mode = "weird";
r = await fetchDomesticCost({ ...P, courier: "jne" });
const stored = Array.from(await db.execute(sql`SELECT 1 FROM public.ro_cost_cache`)).length;
check("9. kode kurir tak dikenal di respons → diabaikan & tidak men-cache kosong yang menyesatkan", r.length === 0 && stored === 0, `(tersimpan=${stored})`);

// --- Perbaikan audit P5 ---
await reset();
await fetchDomesticCost({ ...P, courier: "jne" });
await db.execute(sql`UPDATE public.ro_cost_cache SET fetched_at = now() - interval '13 hours'`);
mode = "empty"; apiCalls = 0;
r = await fetchDomesticCost({ ...P, courier: "jne" });
const kept = Array.from(await db.execute(sql`SELECT payload FROM public.ro_cost_cache WHERE courier = 'jne'`)) as { payload: unknown[] }[];
check("10. respons upstream KOSONG tidak menimpa tarif yang baik", r.length === 0 && kept[0]?.payload.length === 1, `(payload tersimpan=${kept[0]?.payload.length})`);

await reset();
mode = "empty";
await fetchDomesticCost({ ...P, courier: "jne" });
const neg = Array.from(await db.execute(sql`SELECT 1 FROM public.ro_cost_cache WHERE courier = 'jne' AND payload = '[]'::jsonb`)).length;
mode = "ok"; apiCalls = 0;
await fetchDomesticCost({ ...P, courier: "jne" });
check("11a. seluruh respons kosong → negatif singkat tersimpan (belum ada baris)", neg === 1);
check("11b. negatif dalam 30 menit → tanpa API", apiCalls === 0);
await db.execute(sql`UPDATE public.ro_cost_cache SET fetched_at = now() - interval '40 minutes'`);
r = await fetchDomesticCost({ ...P, courier: "jne" });
check("11c. negatif > 30 menit → ambil ulang & pulih", apiCalls === 1 && r.length === 1);

await reset();
mode = "badcost";
r = await fetchDomesticCost({ ...P, courier: "jne" });
check("12. opsi dengan biaya <= 0 dibuang sebelum disimpan/ditagih", r.length === 1 && r[0].service === "OKE" && r[0].cost === 12000, `(${r.map((x) => x.service + ":" + x.cost)})`);

await reset();
for (let i = 0; i < RO_DAILY_LIMITS.cost; i++) await tryConsumeApiBudget("cost");
const pub = await fetchDomesticCost({ ...P, courier: "jne" }).then(() => "ok", (e) => (e as { status?: number }).status);
const ver = await fetchDomesticCost({ ...P, destination: 18000, courier: "jne", budget: "costverify" }).then(() => "ok", (e) => (e as { status?: number }).status);
check("13. jatah publik habis tidak menghabiskan jatah verifikasi checkout", pub === 429 && ver === "ok", `(publik=${pub}, verifikasi=${ver})`);

await reset();
apiCalls = 0;
const gated = await fetchDomesticCost({ ...P, courier: "jne", gate: () => false }).then(() => "ok", (e) => (e as { status?: number }).status);
check("14. gerbang per-IP menolak cache miss → tanpa API", gated === 429 && apiCalls === 0);

console.log(fails === 0 ? "\nSEMUA LULUS" : `\n${fails} GAGAL`);
process.exit(fails === 0 ? 0 : 1);
