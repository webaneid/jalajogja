// Regresi data-nyata voucher PRODUSEN ("Promo Produsen", V2) — docs/arsitektur-produk-produsen.md § 4, § 12.
//   cd apps/web && SMOKE_I_KNOW=1 bun run --preload ./scripts/stub-server-only.ts scripts/smoke-producer-vouchers.ts
// PENGAMAN: DATABASE_URL harus localhost; wajib SMOKE_I_KNOW=1; data uji bertanda "SMOKE-" dan dihapus di finally.
import { randomUUID } from "crypto";
import { and, eq, inArray, like } from "drizzle-orm";
import { createTenantDb } from "@jalajogja/db";
import { parseVoucherInput, checkVoucherCap } from "../lib/producer-vouchers";
import { createProducerVoucher, updateProducerVoucher, setProducerVoucherActive, deleteProducerVoucher, listProducerVouchers, getProducerVoucher } from "../lib/producer-vouchers.server";

const isLocalHost = (h: string) => h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h === "::1";
let dbHost = ""; try { dbHost = new URL(process.env.DATABASE_URL ?? "").hostname; } catch { /* kosong → ditolak */ }
if (!isLocalHost(dbHost) || process.env.SMOKE_I_KNOW !== "1") { console.error(`DITOLAK: butuh DATABASE_URL localhost (terbaca: '${dbHost}') dan SMOKE_I_KNOW=1.`); process.exit(2); }
const SLUG = process.env.SMOKE_TENANT ?? "pc-ikpm-jogjakarta";
let fails = 0;
const ok = (n: string, v: boolean, x = "") => { console.log((v ? "PASS " : "FAIL ") + n + (x ? "  " + x : "")); if (!v) fails++; };

// ── murni ──
const P1 = randomUUID();
const base = { code: "hemat5", name: "Promo", description: "", discountType: "percentage", discountValue: 5, targetItemIds: [P1], usageLimit: "", usageLimitPerCustomer: null, restrictPhone: "", restrictEmail: "", validFrom: "", validUntil: "", isActive: true };
ok("parse: sah (kode di-uppercase)", (() => { const r = parseVoucherInput(base); return r.ok && r.value.code === "HEMAT5" && r.value.usageLimit === null; })());
ok("parse: bukan objek", !parseVoucherInput(null).ok && !parseVoucherInput([]).ok);
ok("parse: kode pendek / karakter aneh", !parseVoucherInput({ ...base, code: "ab" }).ok && !parseVoucherInput({ ...base, code: "A B!" }).ok && !parseVoucherInput({ ...base, code: "X".repeat(31) }).ok);
ok("parse: kode diabaikan bila requireCode=false", parseVoucherInput({ ...base, code: "" }, { requireCode: false }).ok);
ok("parse: nilai 0 / negatif / NaN / >100%", !parseVoucherInput({ ...base, discountValue: 0 }).ok && !parseVoucherInput({ ...base, discountValue: -1 }).ok && !parseVoucherInput({ ...base, discountValue: "x" }).ok && !parseVoucherInput({ ...base, discountValue: 101 }).ok);
ok("parse: jenis aneh ditolak", !parseVoucherInput({ ...base, discountType: "bonus" }).ok);
ok("parse: tanpa target / target bukan uuid / >20", !parseVoucherInput({ ...base, targetItemIds: [] }).ok && !parseVoucherInput({ ...base, targetItemIds: ["' OR 1=1"] }).ok && !parseVoucherInput({ ...base, targetItemIds: Array.from({ length: 21 }, () => randomUUID()) }).ok);
ok("parse: target ganda dibuang", (() => { const r = parseVoucherInput({ ...base, targetItemIds: [P1, P1] }); return r.ok && r.value.targetItemIds.length === 1; })());
ok("parse: batas pakai desimal/0 ditolak", !parseVoucherInput({ ...base, usageLimit: 0 }).ok && !parseVoucherInput({ ...base, usageLimit: 1.5 }).ok);
ok("parse: tanggal tidak valid / terbalik ditolak", !parseVoucherInput({ ...base, validFrom: "2026-13-40" }).ok && !parseVoucherInput({ ...base, validFrom: "2026-05-02", validUntil: "2026-05-01" }).ok);
ok("parse: HP dinormalisasi E.164, email lowercase", (() => { const r = parseVoucherInput({ ...base, restrictPhone: "081234567890", restrictEmail: "A@B.CO" }); return r.ok && r.value.restrictPhone === "+6281234567890" && r.value.restrictEmail === "a@b.co"; })());
ok("parse: HP/email rusak ditolak", !parseVoucherInput({ ...base, restrictPhone: "abc" }).ok && !parseVoucherInput({ ...base, restrictEmail: "bukan-email" }).ok);
ok("parse: field berbahaya diabaikan (ownerProducerId/usedCount)", (() => { const r = parseVoucherInput({ ...base, ownerProducerId: randomUUID(), usedCount: 99, targetType: "ticket" }); return r.ok && !("ownerProducerId" in r.value) && !("usedCount" in r.value) && !("targetType" in r.value); })());
ok("batas: persen 10 @10% sah, 10,01 ditolak", checkVoucherCap({ discountType: "percentage", discountValue: 10 }, 10, 1000) === null && checkVoucherCap({ discountType: "percentage", discountValue: 10.01 }, 10, 1000) !== null);
ok("batas: nominal 10.000 pada harga 100.000 @10% sah, 10.001 ditolak", checkVoucherCap({ discountType: "fixed", discountValue: 10000 }, 10, 100000) === null && checkVoucherCap({ discountType: "fixed", discountValue: 10001 }, 10, 100000) !== null);

// ── DB nyata ──
const tc = createTenantDb(SLUG); const { db, schema: s } = tc;
const tag = `SMOKE-${randomUUID().slice(0, 6)}`;
const made = { producers: [] as string[], products: [] as string[] };
try {
  const mkProducer = async (name: string, share: string | null) => { const [r] = await db.insert(s.producers).values({ type: "custom", customName: `${tag} ${name}`, revenueSharePercent: share }).returning({ id: s.producers.id }); made.producers.push(r.id); return r.id; };
  const mkProduct = async (producerId: string | null, name: string, pub: string, type = "simple", mitra: string | null = null) => {
    const [r] = await db.insert(s.products).values({ slug: `${tag.toLowerCase()}-${made.products.length}`, name: `${tag} ${name}`, price: "1", publicPrice: pub, memberPrice: pub === "100000" ? "90000" : null, stock: 5, producerId, status: "active" as never, productType: type as never, mitraId: mitra }).returning({ id: s.products.id });
    made.products.push(r.id); return r.id;
  };
  const A = await mkProducer("A", "10"), B = await mkProducer("B", "10"), N = await mkProducer("Tanpa", null);
  const pa = await mkProduct(A, "PA", "100000"), pb = await mkProduct(B, "PB", "100000"), pvar = await mkProduct(A, "PVar", "100000", "variable"), pmitra = await mkProduct(A, "PMitra", "100000", "simple", randomUUID()), pn = await mkProduct(N, "PN", "100000");
  const acc = (id: string) => ({ tenant: { slug: SLUG }, producer: { id } });
  const inp = (over: Record<string, unknown> = {}) => { const r = parseVoucherInput({ ...base, code: `${tag}-V1`, targetItemIds: [pa], ...over }); if (!r.ok) throw new Error(r.error); return r.value; };

  const c1 = await createProducerVoucher(acc(A), inp());
  ok("buat: sukses", c1.ok, c1.ok ? "" : c1.error);
  const vid = c1.ok ? c1.voucherId : "";
  const [row] = await db.select().from(s.vouchers).where(eq(s.vouchers.id, vid));
  ok("buat: pemilik = produsen sesi, targetType product, kode UPPERCASE", row?.ownerProducerId === A && row.targetType === "product" && row.code === `${tag}-V1`.toUpperCase());
  ok("buat: kode ganda ditolak", !(await createProducerVoucher(acc(A), inp())).ok);
  ok("buat: kode ganda dari produsen LAIN juga ditolak", !(await createProducerVoucher(acc(B), inp({ targetItemIds: [pb] }))).ok);
  ok("buat: target produk produsen lain ditolak", !(await createProducerVoucher(acc(A), inp({ code: `${tag}-V2`, targetItemIds: [pb] }))).ok);
  ok("buat: target produk bervariasi ditolak", !(await createProducerVoucher(acc(A), inp({ code: `${tag}-V3`, targetItemIds: [pvar] }))).ok);
  ok("buat: target produk mitra / id acak ditolak", !(await createProducerVoucher(acc(A), inp({ code: `${tag}-V4`, targetItemIds: [pmitra] }))).ok && !(await createProducerVoucher(acc(A), inp({ code: `${tag}-V5`, targetItemIds: [randomUUID()] }))).ok);
  ok("buat: campuran (satu milik sendiri + satu orang lain) ditolak", !(await createProducerVoucher(acc(A), inp({ code: `${tag}-V6`, targetItemIds: [pa, pb] }))).ok);
  ok("buat: persen di atas bagian tenant (11% @10%) ditolak + pesan batas", await (async () => { const r = await createProducerVoucher(acc(A), inp({ code: `${tag}-V7`, discountValue: 11 })); return !r.ok && /maksimal 10%/.test(r.error); })());
  ok("buat: nominal di atas batas (harga terendah 90.000 anggota → 9.000) ditolak", !(await createProducerVoucher(acc(A), inp({ code: `${tag}-V8`, discountType: "fixed", discountValue: 9001 }))).ok);
  ok("buat: nominal tepat di batas (9.000) sah", (await createProducerVoucher(acc(A), inp({ code: `${tag}-V9`, discountType: "fixed", discountValue: 9000 }))).ok);
  ok("buat: produsen tanpa persentase ditolak", !(await createProducerVoucher(acc(N), inp({ code: `${tag}-V10`, targetItemIds: [pn] }))).ok);
  await db.update(s.producers).set({ isActive: false }).where(eq(s.producers.id, B));
  ok("buat: produsen nonaktif ditolak", !(await createProducerVoucher(acc(B), inp({ code: `${tag}-V11`, targetItemIds: [pb] }))).ok);
  ok("buat: tanggal dianchor ke kalender tenant (berakhir 23:59)", await (async () => {
    const r = await createProducerVoucher(acc(A), inp({ code: `${tag}-V12`, validFrom: "2030-01-10", validUntil: "2030-01-15" }));
    if (!r.ok) return false;
    const [v] = await db.select().from(s.vouchers).where(eq(s.vouchers.id, r.voucherId));
    return !!v.validFrom && !!v.validUntil && v.validUntil.getTime() - v.validFrom.getTime() > 5 * 86400_000 && v.validUntil.getTime() - v.validFrom.getTime() < 6 * 86400_000;
  })());

  // admin voucher (owner NULL) sebagai pembanding
  const [adminV] = await db.insert(s.vouchers).values({ code: `${tag}-ADM`.toUpperCase(), name: `${tag} admin`, discountType: "percentage", discountValue: "5", targetType: "product", targetItemIds: [] } as never).returning({ id: s.vouchers.id });

  // ubah
  ok("ubah: sukses (kode tidak berubah)", (await updateProducerVoucher(acc(A), vid, inp({ code: "TIDAKDIPAKAI", name: "Nama Baru", discountValue: 8 }))).ok && (await db.select().from(s.vouchers).where(eq(s.vouchers.id, vid)))[0].code === `${tag}-V1`.toUpperCase());
  ok("ubah: nilai tersimpan", Number((await db.select().from(s.vouchers).where(eq(s.vouchers.id, vid)))[0].discountValue) === 8);
  ok("ubah: voucher produsen LAIN → tidak ditemukan", !(await updateProducerVoucher(acc(B), vid, inp({ targetItemIds: [pb] }))).ok);
  ok("ubah: voucher ADMIN (owner NULL) tidak bisa diubah produsen", !(await updateProducerVoucher(acc(A), adminV.id, inp())).ok && (await db.select().from(s.vouchers).where(eq(s.vouchers.id, adminV.id)))[0].name === `${tag} admin`);
  ok("ubah: batas tetap ditegakkan (12% @10% ditolak)", !(await updateProducerVoucher(acc(A), vid, inp({ discountValue: 12 }))).ok);
  ok("ubah: id bukan uuid", !(await updateProducerVoucher(acc(A), "x", inp())).ok);

  // daftar
  const mine = await listProducerVouchers(tc, A);
  ok("daftar: hanya milik sendiri (tanpa voucher admin / produsen lain)", mine.length >= 2 && mine.every((m) => m.id !== adminV.id));
  ok("detail: milik sendiri ada; voucher admin & produsen lain = null", (await getProducerVoucher(tc, A, vid)) !== null && (await getProducerVoucher(tc, A, adminV.id)) === null && (await getProducerVoucher(tc, B, vid)) === null);

  // aktif/nonaktif
  ok("nonaktifkan / aktifkan", (await setProducerVoucherActive(acc(A), vid, false)).ok && (await db.select().from(s.vouchers).where(eq(s.vouchers.id, vid)))[0].isActive === false && (await setProducerVoucherActive(acc(A), vid, true)).ok);
  ok("aktif/nonaktif: voucher admin & orang lain ditolak", !(await setProducerVoucherActive(acc(A), adminV.id, false)).ok && !(await setProducerVoucherActive(acc(B), vid, false)).ok && (await db.select().from(s.vouchers).where(eq(s.vouchers.id, adminV.id)))[0].isActive === true);

  // hapus
  const [inv] = await db.insert(s.invoices).values({ invoiceNumber: `${tag}-INV`, sourceType: "cart", customerName: tag, subtotal: "10", total: "10" }).returning({ id: s.invoices.id });
  await db.insert(s.voucherRedemptions).values({ voucherId: vid, invoiceId: inv.id, customerPhone: "+6281200000000", discountTotal: "1" } as never);
  ok("hapus: sudah pernah dipakai → DITOLAK (nonaktifkan saja)", await (async () => { const r = await deleteProducerVoucher(acc(A), vid); return !r.ok && /Nonaktifkan/.test(r.error); })());
  const c2 = await createProducerVoucher(acc(A), inp({ code: `${tag}-DEL` }));
  ok("hapus: belum dipakai → terhapus", c2.ok && (await deleteProducerVoucher(acc(A), c2.voucherId)).ok && (await db.select().from(s.vouchers).where(eq(s.vouchers.id, c2.voucherId))).length === 0);
  ok("hapus: voucher admin / orang lain ditolak & tetap ada", !(await deleteProducerVoucher(acc(A), adminV.id)).ok && !(await deleteProducerVoucher(acc(B), vid)).ok);
  await db.delete(s.voucherRedemptions).where(eq(s.voucherRedemptions.invoiceId, inv.id));
  await db.delete(s.invoices).where(eq(s.invoices.id, inv.id));
} finally {
  const cleanup = async (label: string, fn: () => Promise<unknown>) => { try { await fn(); } catch (e) { console.error("cleanup", label, e instanceof Error ? e.message : e); fails++; } };
  await cleanup("redemptions", async () => { const ids = (await db.select({ id: s.vouchers.id }).from(s.vouchers).where(like(s.vouchers.code, `${tag.toUpperCase()}%`))).map((x) => x.id); if (ids.length) await db.delete(s.voucherRedemptions).where(inArray(s.voucherRedemptions.voucherId, ids)); });
  await cleanup("invoices", () => db.delete(s.invoices).where(like(s.invoices.invoiceNumber, `${tag}%`)));
  await cleanup("vouchers", () => db.delete(s.vouchers).where(like(s.vouchers.code, `${tag.toUpperCase()}%`)));
  await cleanup("products", () => made.products.length ? db.delete(s.products).where(inArray(s.products.id, made.products)) : Promise.resolve());
  await cleanup("producers", () => made.producers.length ? db.delete(s.producers).where(inArray(s.producers.id, made.producers)) : Promise.resolve());
}
console.log(fails ? `\n${fails} GAGAL` : "\nSEMUA LULUS");
process.exit(fails ? 1 : 0);
