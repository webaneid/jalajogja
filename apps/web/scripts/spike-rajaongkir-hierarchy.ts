// SPIKE P0 (docs/arsitektur-alamat.md § 7): verifikasi struktur data RajaOngkir/Komerce sebelum membuat tabel lokal.
// Read-only, ±15 panggilan API. Jalankan di VPS:  cd apps/web && bun run scripts/spike-rajaongkir-hierarchy.ts
// Mencetak BENTUK respons (item pertama) — tidak mencetak API key.
const BASE = "https://rajaongkir.komerce.id/api/v1";
const key = process.env.RAJAONGKIR_PLATFORM_KEY;
if (!key) { console.error("RAJAONGKIR_PLATFORM_KEY tidak ada di env"); process.exit(1); }

let calls = 0;
async function get(path: string) {
  calls++;
  const res = await fetch(`${BASE}${path}`, { headers: { key } });
  const body = await res.json().catch(() => null) as { meta?: { code?: number; message?: string }; data?: unknown } | null;
  return { http: res.status, code: body?.meta?.code, msg: body?.meta?.message, data: body?.data };
}
async function cost(origin: number, destination: number, weight: number, courier = "jne") {
  calls++;
  const form = new FormData();
  form.append("origin", String(origin)); form.append("destination", String(destination));
  form.append("weight", String(weight)); form.append("courier", courier);
  const res = await fetch(`${BASE}/calculate/domestic-cost`, { method: "POST", headers: { key }, body: form });
  const body = await res.json().catch(() => null) as { meta?: { code?: number }; data?: { service: string; cost: number; etd: string }[] } | null;
  return { http: res.status, code: body?.meta?.code, services: (body?.data ?? []).map((d) => `${d.service}:${d.cost}`) };
}
const first = (d: unknown) => (Array.isArray(d) ? { total: d.length, sample: d[0] } : d);
const show = (title: string, v: unknown) => console.log(`\n=== ${title} ===\n${JSON.stringify(v, null, 1)}`);

const prov = await get("/destination/province");
show("province", { http: prov.http, code: prov.code, ...(first(prov.data) as object) });
const provList = (prov.data as { id: number; name: string }[]) ?? [];
const diy = provList.find((p) => /YOGYAKARTA/i.test(p.name)) ?? provList[0];

const cities = await get(`/destination/city/${diy?.id}`);
show(`city (provinsi ${diy?.name})`, { http: cities.http, code: cities.code, ...(first(cities.data) as object) });
const cityList = (cities.data as { id: number }[]) ?? [];

const dist = await get(`/destination/district/${cityList[0]?.id}`);
show("district", { http: dist.http, code: dist.code, msg: dist.msg, ...(first(dist.data) as object) });
const distList = (dist.data as { id: number }[]) ?? [];

const sub = await get(`/destination/sub-district/${distList[0]?.id}`);
show("sub-district", { http: sub.http, code: sub.code, msg: sub.msg, ...(first(sub.data) as object) });
const subList = (sub.data as { id: number; name?: string; zip_code?: string }[]) ?? [];

// Apakah ID kelurahan dari hierarki = ID dari pencarian = ID yang diterima API ongkir?
const subId = subList[0]?.id;
const q = subList[0]?.name ?? "yogyakarta";
const search = await get(`/destination/domestic-destination?search=${encodeURIComponent(q)}&limit=30&offset=0`);
const found = ((search.data as { id: number }[]) ?? []).some((d) => d.id === subId);
show("ID hierarki == ID pencarian?", { subId, q, ditemukanDiPencarian: found, sampleSearch: first(search.data) });

// Pola harga per berat (menentukan kunci cache): asal=tujuan di DIY vs tujuan Jakarta
const jak = await get(`/destination/domestic-destination?search=${encodeURIComponent("kebon jeruk jakarta barat")}&limit=1&offset=0`);
const jakId = (jak.data as { id: number }[])?.[0]?.id;
if (subId && jakId) {
  const rows: Record<string, string[]> = {};
  for (const w of [900, 1000, 1001, 1500, 2000]) rows[`${w}g`] = (await cost(subId, jakId, w)).services;
  show("pola harga JNE per berat (asal DIY → Jakarta)", rows);
}
console.log(`\nTotal panggilan API: ${calls}`);
