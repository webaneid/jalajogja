// Uji buku alamat P2 dengan DB lokal (data nyata: profil sementara + tujuan sementara; dibersihkan di akhir).
// Jalankan: cd apps/web && bun run --preload ./scripts/stub-server-only.ts scripts/smoke-address-book.ts
import { sql } from "drizzle-orm";
import { db } from "@jalajogja/db";
import { parseAddressInput, MAX_ADDRESSES_PER_OWNER } from "../lib/address-book";
const { saveAddress, deleteAddress, setDefaultAddress, listAddresses } = await import("../lib/address-book-store.server");

let fails = 0;
const check = (name: string, ok: boolean, extra = "") => { console.log(`${ok ? "OK  " : "GAGAL"}  ${name} ${extra}`); if (!ok) fails++; };
const rows = async (q: ReturnType<typeof sql>) => Array.from(await db.execute(q)) as Record<string, unknown>[];

// --- data uji ---
const tag = `smk${Date.now()}`;
await db.execute(sql`INSERT INTO public.ro_destinations (id, label, province_name, city_name, district_name, subdistrict_name, zip_code, search_text)
  VALUES (1999000001, 'BENER, TEGALREJO, YOGYAKARTA, DI YOGYAKARTA, 55243', 'DI YOGYAKARTA', 'YOGYAKARTA', 'TEGALREJO', 'BENER', '55243', 'bener tegalrejo yogyakarta di yogyakarta 55243')
  ON CONFLICT (id) DO NOTHING`);
const mkProfile = async (n: string) => (await rows(sql`INSERT INTO public.profiles (name, email, phone) VALUES (${"Uji " + n}, ${n + tag + "@uji.test"}, ${"+62899" + n + tag.slice(-6)}) RETURNING id`))[0].id as string;
const A = { kind: "profile" as const, id: await mkProfile("1") };
const B = { kind: "profile" as const, id: await mkProfile("2") };

const base = { label: "Rumah", recipientName: "Budi Santoso", phone: "081234567890", destinationId: 1999000001, detail: "Jl. Mawar No. 5 RT 02/RW 03", isDefault: false };
const ok = (x: unknown) => { const p = parseAddressInput(x); if (!p.ok) throw new Error(p.error); return p.value; };

try {
  // --- validasi murni ---
  check("1a. HP lokal dinormalisasi ke E.164", ok(base).phone === "+6281234567890");
  check("1b. label kosong ditolak", !parseAddressInput({ ...base, label: "  " }).ok);
  check("1c. HP tidak valid ditolak", !parseAddressInput({ ...base, phone: "abc" }).ok);
  check("1d. destinationId bukan angka ditolak", !parseAddressInput({ ...base, destinationId: "x" }).ok);
  check("1e. alamat terlalu pendek ditolak", !parseAddressInput({ ...base, detail: "Jl" }).ok);
  check("1f. id bukan uuid ditolak", !parseAddressInput({ ...base, id: "1; DROP TABLE" }).ok);

  // --- CRUD ---
  let r = await saveAddress(A, ok(base));
  check("2a. alamat pertama OTOMATIS utama", r.ok && r.addresses.length === 1 && r.addresses[0].isDefault === true);
  const firstId = r.ok ? r.addresses[0].id : "";
  r = await saveAddress(A, ok({ ...base, label: "Kantor", isDefault: false }));
  check("2b. alamat kedua bukan utama", r.ok && r.addresses.length === 2 && r.addresses.filter((a) => a.isDefault).length === 1 && r.addresses[0].label === "Rumah");
  const secondId = r.ok ? r.addresses.find((a) => a.label === "Kantor")!.id : "";
  r = await saveAddress(A, ok({ ...base, label: "Indah Permata", isDefault: true }));
  check("2c. tambah dengan isDefault → hanya SATU utama, yang baru", r.ok && r.addresses.filter((a) => a.isDefault).length === 1 && r.addresses.find((a) => a.isDefault)!.label === "Indah Permata");
  r = await setDefaultAddress(A, secondId);
  check("2d. Jadikan Utama memindahkan penanda", r.ok && r.addresses.find((a) => a.isDefault)!.id === secondId && r.addresses.filter((a) => a.isDefault).length === 1);
  r = await saveAddress(A, ok({ id: secondId, ...base, label: "Kantor Baru", isDefault: false }));
  check("2e. ubah alamat utama tidak 'mencabut' statusnya lewat form", r.ok && r.addresses.find((a) => a.id === secondId)!.isDefault && r.addresses.find((a) => a.id === secondId)!.label === "Kantor Baru");
  r = await deleteAddress(A, secondId);
  check("2f. hapus yang utama → alamat lain jadi utama otomatis", r.ok && r.addresses.length === 2 && r.addresses.filter((a) => a.isDefault).length === 1);

  // --- isolasi pemilik (anti-IDOR) ---
  const idor1 = await deleteAddress(B, firstId);
  const idor2 = await setDefaultAddress(B, firstId);
  const idor3 = await saveAddress(B, ok({ id: firstId, ...base, label: "Diretas" }));
  const stillThere = await listAddresses(A);
  check("3a. pemilik lain TIDAK bisa hapus/utama/ubah alamat orang lain", !idor1.ok && !idor2.ok && !idor3.ok && stillThere.some((a) => a.id === firstId && a.label !== "Diretas"));
  check("3b. daftar B kosong (tidak melihat milik A)", (await listAddresses(B)).length === 0);

  // --- tujuan & batas ---
  const badDest = await saveAddress(A, ok({ ...base, destinationId: 1999999998 }));
  check("4a. tujuan yang tak ada di ro_destinations ditolak (tanpa API)", !badDest.ok);
  let last: Awaited<ReturnType<typeof saveAddress>> = { ok: true, addresses: [] };
  for (let i = 0; i < MAX_ADDRESSES_PER_OWNER + 2; i++) last = await saveAddress(B, ok({ ...base, label: `A${i}` }));
  const count = (await listAddresses(B)).length;
  check(`4b. batas ${MAX_ADDRESSES_PER_OWNER} alamat per orang ditegakkan`, count === MAX_ADDRESSES_PER_OWNER && !last.ok, `(jumlah=${count})`);

  // --- batas basis data ---
  const xor = await db.execute(sql`INSERT INTO public.address_book (label, recipient_name, phone, destination_id, detail) VALUES ('x','x','+62811111111',1999000001,'xxxxxx')`).then(() => "lolos", () => "ditolak");
  check("5a. baris tanpa pemilik ditolak oleh CHECK database", xor === "ditolak");
  const dbl = await db.execute(sql`UPDATE public.address_book SET is_default = true WHERE profile_id = ${B.id}`).then(() => "lolos", () => "ditolak");
  check("5b. dua alamat utama sekaligus ditolak oleh indeks unik database", dbl === "ditolak");

  // --- kebersihan: hapus profil → alamat ikut terhapus (CASCADE) ---
  await db.execute(sql`DELETE FROM public.profiles WHERE id = ${A.id}`);
  const orphan = (await rows(sql`SELECT 1 FROM public.address_book WHERE profile_id = ${A.id}`)).length;
  check("6. hapus profil → alamatnya ikut terhapus (CASCADE)", orphan === 0);
} finally {
  await db.execute(sql`DELETE FROM public.profiles WHERE email LIKE ${"%" + tag + "@uji.test"}`);
  await db.execute(sql`DELETE FROM public.ro_destinations WHERE id = 1999000001`);
}
console.log(fails === 0 ? "\nSEMUA LULUS" : `\n${fails} GAGAL`);
process.exit(fails === 0 ? 0 : 1);
