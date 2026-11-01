// Uji Asal Kirim P4 dengan DB lokal NYATA (tenant_forcreator): CRUD terikat pemilik, indeks, urutan penentuan asal, dan
// buildSellerGroups (refaktor). Data uji dibersihkan di akhir. Jalankan:
//   cd apps/web && bun run --preload ./scripts/stub-server-only.ts scripts/smoke-shipping-origins.ts
// Pengaman: skrip uji MENGHAPUS data — hanya boleh di DB lokal.
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL ?? "")) { console.error("Ditolak: skrip uji hanya untuk DATABASE_URL lokal."); process.exit(2); }
import { sql } from "drizzle-orm";
import { db, createTenantDb } from "@jalajogja/db";
import { parseOriginInput, resolveProductOrigin, MAX_ORIGINS_PER_OWNER } from "../lib/shipping-origins";
const { saveOrigin, deleteOrigin, setDefaultOrigin, listOrigins, loadOriginIndex, originBelongsTo } = await import("../lib/shipping-origins.server");
const { buildSellerGroups } = await import("../lib/shipping-groups.server");
const { getTokoSettings } = await import("../lib/toko-settings");

const SLUG = "forcreator";
const tc = createTenantDb(SLUG);
const T = `"tenant_${SLUG}"`;
const exec = (q: string) => db.execute(sql.raw(q));
let fails = 0;
const check = (name: string, ok: boolean, extra = "") => { console.log(`${ok ? "OK  " : "GAGAL"}  ${name} ${extra}`); if (!ok) fails++; };
const ok = (x: unknown) => { const p = parseOriginInput(x); if (!p.ok) throw new Error(p.error); return p.value; };

const PA = "aaaaaaaa-1111-4000-8000-000000000001"; // produsen A (aktif)
const PB = "aaaaaaaa-1111-4000-8000-000000000002"; // produsen B (aktif)
const PX = "aaaaaaaa-1111-4000-8000-000000000003"; // produsen nonaktif
const D1 = 1999100001, D2 = 1999100002, D3 = 1999100003;
const dest = (id: number, kel: string) => exec(`INSERT INTO public.ro_destinations (id,label,province_name,city_name,district_name,subdistrict_name,zip_code,search_text) VALUES (${id},'${kel}, KEC, KOTA${id}, PROV, 11111','PROV','KOTA${id}','KEC','${kel}','11111','${kel.toLowerCase()} kec') ON CONFLICT (id) DO NOTHING`);
const cleanup = async () => {
  await exec(`DELETE FROM ${T}.products WHERE id::text LIKE 'bbbbbbbb-1111%'`);
  await exec(`DELETE FROM ${T}.shipping_origins WHERE producer_id::text LIKE 'aaaaaaaa-1111%' OR label LIKE 'UJI%'`);
  await exec(`DELETE FROM ${T}.producers WHERE id::text LIKE 'aaaaaaaa-1111%'`);
  await exec(`DELETE FROM public.ro_destinations WHERE id IN (${D1},${D2},${D3})`);
};

try {
  await cleanup();
  await dest(D1, "KEL1"); await dest(D2, "KEL2"); await dest(D3, "KEL3");
  await exec(`INSERT INTO ${T}.producers (id,type,custom_name,is_active) VALUES ('${PA}','custom','Uji A',true),('${PB}','custom','Uji B',true),('${PX}','custom','Uji X',false)`);
  const tenantBefore = await listOrigins(tc, { producerId: null });
  const tenantDefaultBefore = tenantBefore.find((o) => o.isDefault);

  // --- validasi ---
  check("1a. nama kosong ditolak", !parseOriginInput({ label: " ", detail: "Jl. Uji 123", destinationId: D1 }).ok);
  check("1b. alamat pendek ditolak", !parseOriginInput({ label: "G", detail: "Jl", destinationId: D1 }).ok);
  check("1c. id bukan uuid ditolak", !parseOriginInput({ id: "x'; DROP", label: "G", detail: "Jl. Uji 123", destinationId: D1 }).ok);

  // --- CRUD produsen A ---
  const A = { producerId: PA }, B = { producerId: PB };
  let r = await saveOrigin(tc, A, ok({ label: "Gudang A1", detail: "Jl. Gudang A1 No 1", destinationId: D1 }));
  check("2a. asal pertama otomatis UTAMA", r.ok && r.origins.length === 1 && r.origins[0].isDefault);
  const a1 = r.ok ? r.origins[0].id : "";
  r = await saveOrigin(tc, A, ok({ label: "Pabrik A2", detail: "Jl. Pabrik A2 No 2", destinationId: D2 }));
  const a2 = r.ok ? r.origins.find((o) => o.label === "Pabrik A2")!.id : "";
  check("2b. asal kedua bukan utama; produsen boleh punya banyak asal", r.ok && r.origins.length === 2 && r.origins.filter((o) => o.isDefault).length === 1);
  r = await setDefaultOrigin(tc, A, a2);
  check("2c. Jadikan Utama memindahkan penanda", r.ok && r.origins.find((o) => o.isDefault)!.id === a2 && r.origins.filter((o) => o.isDefault).length === 1);
  r = await saveOrigin(tc, A, ok({ id: a2, label: "Pabrik A2 baru", detail: "Jl. Pabrik A2 No 2", destinationId: D2, isDefault: false }));
  check("2d. ubah asal utama tidak 'mencabut' statusnya lewat form", r.ok && r.origins.find((o) => o.id === a2)!.isDefault && r.origins.find((o) => o.id === a2)!.label === "Pabrik A2 baru");
  const noDest = await saveOrigin(tc, A, ok({ label: "X", detail: "Jl. Uji 123", destinationId: 1999999997 }));
  check("2e. tujuan yang tak ada di ro_destinations ditolak", !noDest.ok);

  // --- isolasi pemilik (anti-IDOR antar produsen & dengan toko) ---
  const i1 = await deleteOrigin(tc, B, a1), i2 = await setDefaultOrigin(tc, B, a1);
  const i3 = await saveOrigin(tc, B, ok({ id: a1, label: "Diretas", detail: "Jl. Uji 123", destinationId: D3 }));
  const i4 = await deleteOrigin(tc, { producerId: null }, a1);
  const stillA = await listOrigins(tc, A);
  check("3a. produsen lain / toko TIDAK bisa hapus/utama/ubah asal produsen A", !i1.ok && !i2.ok && !i3.ok && !i4.ok && stillA.some((o) => o.id === a1 && o.label === "Gudang A1"));
  check("3b. daftar B kosong (tidak melihat milik A)", (await listOrigins(tc, B)).length === 0);
  check("3c. originBelongsTo: milik A sah untuk A, tidak sah untuk B/toko", (await originBelongsTo(tc, a1, PA)) && !(await originBelongsTo(tc, a1, PB)) && !(await originBelongsTo(tc, a1, null)));

  // --- batas jumlah ---
  let last: Awaited<ReturnType<typeof saveOrigin>> = { ok: true, origins: [] };
  for (let i = 0; i < MAX_ORIGINS_PER_OWNER + 2; i++) last = await saveOrigin(tc, B, ok({ label: `UJI B${i}`, detail: "Jl. Uji Banyak 1", destinationId: D3 }));
  const nB = (await listOrigins(tc, B)).length;
  check(`3d. batas ${MAX_ORIGINS_PER_OWNER} asal per pemilik`, nB === MAX_ORIGINS_PER_OWNER && !last.ok, `(jumlah=${nB})`);

  // --- indeks & urutan penentuan asal ---
  await saveOrigin(tc, { producerId: PX }, ok({ label: "UJI X", detail: "Jl. Nonaktif 1", destinationId: D1 }));
  const idx = await loadOriginIndex(tc);
  check("4a. indeks: asal utama produsen aktif ada", idx.producerDefault.get(PA)?.id === a2);
  check("4b. indeks: asal produsen NONAKTIF tidak dipakai", !idx.producerDefault.has(PX));
  check("4c. indeks: asal utama toko ada (hasil migrasi/pengaturan)", !!idx.tenantDefault && idx.tenantDefault.id === tenantDefaultBefore?.id);
  const R = (originId: string | null, producerId: string | null) => resolveProductOrigin(idx, { originId, producerId })?.id;
  check("4d. produk ber-origin_id eksplisit milik produsennya → dipakai", R(a1, PA) === a1);
  check("4e. tanpa origin_id → asal utama produsen", R(null, PA) === a2);
  check("4f. produsen tanpa asal → asal utama toko", R(null, PB) === idx.tenantDefault?.id || idx.byId.size > 0 && R(null, "aaaaaaaa-1111-4000-8000-0000000000ff") === idx.tenantDefault?.id);
  check("4g. origin_id milik PRODUSEN LAIN diabaikan (tak bisa diselundupkan)", R(a1, PB) !== a1 && R(a1, null) !== a1);

  // --- buildSellerGroups (refaktor) dengan produk nyata ---
  const prod = (n: number, producer: string | null, originId: string | null) =>
    exec(`INSERT INTO ${T}.products (id,slug,name,price,weight_gram,status,producer_id,origin_id) VALUES ('bbbbbbbb-1111-4000-8000-00000000000${n}','uji-p${n}','Uji P${n}',1000,500,'active',${producer ? `'${producer}'` : "NULL"},${originId ? `'${originId}'` : "NULL"})`);
  await prod(1, PA, a1);        // eksplisit a1 (D1)
  await prod(2, PA, null);      // default produsen A = a2 (D2)
  await prod(3, null, null);    // toko → default toko
  await prod(4, PA, a1);        // sama dengan P1 → satu kelompok
  const toko = await getTokoSettings(SLUG);
  const item = (n: number, q: number) => ({ id: `ci${n}`, itemType: "product", itemId: `bbbbbbbb-1111-4000-8000-00000000000${n}`, name: `Uji P${n}`, quantity: q });
  const groups = await buildSellerGroups({ slug: SLUG, tenantName: "Uji", cartItems: [item(1, 2), item(2, 1), item(3, 1), item(4, 1)], tokoSettings: toko });
  const byOrigin = new Map(groups.map((g) => [`${g.producerId ?? "-"}:${g.originCityId}`, g]));
  check("5a. empat produk → TIGA paket (A@D1 gabung P1+P4, A@D2, toko)", groups.length === 3, `(paket=${groups.length})`);
  check("5b. paket produsen A asal eksplisit: kota D1, berat (2+1)×500 = 1500 g", byOrigin.get(`${PA}:${D1}`)?.totalWeightGram === 1500, `(${byOrigin.get(`${PA}:${D1}`)?.totalWeightGram})`);
  check("5c. paket produsen A tanpa pilihan → asal utama (D2)", byOrigin.get(`${PA}:${D2}`)?.totalWeightGram === 500);
  check("5d. paket toko → asal utama toko", !!idx.tenantDefault && byOrigin.get(`-:${idx.tenantDefault.cityId}`)?.totalWeightGram === 500);
  check("5f. originCityName ke klien = label AMAN (kota, provinsi) — kelurahan produsen tidak bocor", groups.filter((g) => g.producerId).every((g) => !/KEL\d/.test(g.originCityName) && /KOTA\d+, PROV/.test(g.originCityName)), `(${groups.map((g) => g.originCityName).join(" | ")})`);
  check("5e. judul paket produsen memuat kota asal; identitas produsen tidak bocor", groups.filter((g) => g.producerId).every((g) => /\(KOTA\d+\)/.test(g.sellerName) && !g.sellerName.includes("Uji A")), `(${groups.map((g) => g.sellerName).join(" | ")})`);

  // --- gagal-tertutup: galat baca asal TIDAK boleh jadi "tanpa asal" (ongkir Rp0 diam-diam) ---
  const broken = createTenantDb("tenant-yang-tidak-ada");
  const strictErr = await loadOriginIndex(broken, { strict: true }).then(() => "tidak-melempar", () => "melempar");
  const lenient = await loadOriginIndex(broken).then((i) => i.byId.size === 0 && i.tenantDefault === null, () => false);
  check("5g. loadOriginIndex strict MELEMPAR saat tabel tak terbaca; non-strict degradasi ke kosong", strictErr === "melempar" && lenient);
  const buildErr = await buildSellerGroups({ slug: "tenant-yang-tidak-ada", tenantName: "X", cartItems: [item(1, 1)], tokoSettings: toko }).then(() => "tidak-melempar", () => "melempar");
  check("5h. buildSellerGroups melempar (checkout gagal-tertutup) bila asal tak terbaca", buildErr === "melempar");

  // --- hapus asal yang dipakai produk ditolak; setelah dilepas boleh ---
  const used = await deleteOrigin(tc, A, a1);
  check("6a. hapus asal yang dipakai produk DITOLAK", !used.ok && /dipakai/.test(used.error));
  await exec(`UPDATE ${T}.products SET origin_id = NULL WHERE producer_id = '${PA}'`);
  const freed = await deleteOrigin(tc, A, a1);
  check("6b. setelah produk dilepas, asal bisa dihapus", freed.ok);
  const delDefault = await deleteOrigin(tc, A, a2);
  check("6c. hapus asal utama terakhir → daftar kosong", delDefault.ok && delDefault.origins.length === 0);
} finally {
  await cleanup();
}
console.log(fails === 0 ? "\nSEMUA LULUS" : `\n${fails} GAGAL`);
process.exit(fails === 0 ? 0 : 1);
