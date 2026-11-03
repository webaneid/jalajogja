// Regresi data-nyata Voucher dua jenis + snapshot bagi hasil (V1) — docs/arsitektur-produk-produsen.md § 4, K23–K25.
// Memanggil checkoutAction/previewVoucherAction NYATA terhadap DB LOKAL (modul Next `headers`/`cookies`/`revalidatePath` ditiru di sini,
// DB dan logika bisnis asli), lalu membersihkan semua baris buatannya.
//
//   cd apps/web && SMOKE_I_KNOW=1 bun run --preload ./scripts/stub-server-only.ts scripts/smoke-voucher-owner.ts
//
// PENGAMAN: host DATABASE_URL harus PERSIS localhost/127.0.0.1; wajib SMOKE_I_KNOW=1; data uji bertanda "SMOKE-".
import { randomUUID } from "crypto";
import { and, eq, inArray, like } from "drizzle-orm";
import { db as pdb, createTenantDb, tenants } from "@jalajogja/db";
import { computeVoucherDiscount, type VoucherRow } from "@jalajogja/db";

const isLocalHost = (h: string) => h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h === "::1";
let dbHost = ""; try { dbHost = new URL(process.env.DATABASE_URL ?? "").hostname; } catch { /* kosong → ditolak */ }
if (!isLocalHost(dbHost) || process.env.SMOKE_I_KNOW !== "1") {
  console.error(`DITOLAK: butuh DATABASE_URL localhost (terbaca: '${dbHost}') dan SMOKE_I_KNOW=1.`); process.exit(2);
}
const SLUG = process.env.SMOKE_TENANT ?? "pc-ikpm-jogjakarta";
let fails = 0;
const ok = (n: string, v: boolean, x = "") => { console.log((v ? "PASS " : "FAIL ") + n + (x ? "  " + x : "")); if (!v) fails++; };

// ── Tiruan modul Next (di luar request) ──
// `bun:test` tidak punya tipe di tsc proyek (skrip di scripts/ ikut type-check) → dimuat dinamis tanpa tipe.
const { mock } = (await import("bun:" + "test")) as unknown as { mock: { module: (name: string, factory: () => unknown) => void } };
let currentToken = "";
mock.module("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ get: (n: string) => (n === "cart_session" && currentToken ? { value: currentToken } : undefined), set: () => {}, delete: () => {} }),
}));
mock.module("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

// ── Bagian MURNI: resolver ──
const v = (over: Partial<VoucherRow>): VoucherRow => ({
  id: "v", code: "X", name: "x", discountType: "percentage", discountValue: 5, targetType: "product", targetItemIds: [],
  usageLimit: null, usageLimitPerCustomer: null, usedCount: 0, restrictPhone: null, restrictEmail: null, validFrom: null, validUntil: null, isActive: true,
  ownerProducerId: null, ...over,
});
const none = { phone: null, email: null };
const P1 = "11111111-1111-4111-8111-111111111111", P2 = "22222222-2222-4222-8222-222222222222";
const item = (o: Record<string, unknown> = {}) => ({ itemType: "product", itemId: "p", unitPrice: 100000, quantity: 1, mitraId: null, producerId: P1, sharePercent: 10, ...o });
type R = ReturnType<typeof computeVoucherDiscount>;
const disc = (r: R) => ("error" in r ? -1 : r.totalDiscount);
const funded = (r: R) => ("error" in r ? "err" : r.fundedBy);
ok("murni: Promo Tenant 5% atas barang produsen = 5.000, ditanggung tenant", (() => { const r = computeVoucherDiscount(v({}), none, 0, [item()]); return disc(r) === 5000 && funded(r) === "tenant"; })());
ok("murni: Promo Tenant 20% TIDAK dibatasi persen bagian tenant (tenant boleh menombok)", disc(computeVoucherDiscount(v({ discountValue: 20 }), none, 0, [item()])) === 20000);
ok("murni: Promo Produsen 5% = 5.000, ditanggung produsen", (() => { const r = computeVoucherDiscount(v({ ownerProducerId: P1 }), none, 0, [item()]); return disc(r) === 5000 && funded(r) === "producer"; })());
ok("murni: Promo Produsen 20% dibatasi 10% (=10.000)", disc(computeVoucherDiscount(v({ ownerProducerId: P1, discountValue: 20 }), none, 0, [item()])) === 10000);
ok("murni: Promo Produsen nominal 50.000 dibatasi 10.000", disc(computeVoucherDiscount(v({ ownerProducerId: P1, discountType: "fixed", discountValue: 50000 }), none, 0, [item()])) === 10000);
ok("murni: batas mengikuti qty (2 × 100.000 @10% = 20.000)", disc(computeVoucherDiscount(v({ ownerProducerId: P1, discountValue: 50 }), none, 0, [item({ quantity: 2 })])) === 20000);
ok("murni: Promo Produsen tidak berlaku atas barang produsen LAIN", "error" in computeVoucherDiscount(v({ ownerProducerId: P1 }), none, 0, [item({ producerId: P2 })]));
ok("murni: Promo Produsen tidak berlaku atas barang internal (tanpa produsen)", "error" in computeVoucherDiscount(v({ ownerProducerId: P1 }), none, 0, [item({ producerId: null })]));
ok("murni: pemanggil tanpa data produsen (invoice manual admin) = TIDAK cocok (fail-closed)", "error" in computeVoucherDiscount(v({ ownerProducerId: P1 }), none, 0, [{ itemType: "product", itemId: "p", unitPrice: 100000, quantity: 1, mitraId: null }]));
ok("murni: persentase produsen null/0 = tidak cocok", "error" in computeVoucherDiscount(v({ ownerProducerId: P1 }), none, 0, [item({ sharePercent: null })]) && "error" in computeVoucherDiscount(v({ ownerProducerId: P1 }), none, 0, [item({ sharePercent: 0 })]));
ok("murni: campuran keranjang → hanya barang miliknya yang terpotong", (() => {
  const r = computeVoucherDiscount(v({ ownerProducerId: P1 }), none, 0, [item(), item({ producerId: P2 }), item({ producerId: null })]);
  return !("error" in r) && r.perItemDiscount.size === 1 && r.perItemDiscount.get(0) === 5000;
})());
ok("murni: pembulatan batas tidak melebihi (33.333 @7,5% → ≤ 2.499,97)", (() => { const r = computeVoucherDiscount(v({ ownerProducerId: P1, discountValue: 99 }), none, 0, [item({ unitPrice: 33333, sharePercent: 7.5 })]); return !("error" in r) && r.totalDiscount <= 2499.98; })());

// ── Bagian DB + checkout nyata ──
const [t] = await pdb.select().from(tenants).where(eq(tenants.slug, SLUG));
void t;
const tc = createTenantDb(SLUG); const { db, schema: s } = tc;
const tag = `SMOKE-${randomUUID().slice(0, 6)}`;
const made = { producers: [] as string[], products: [] as string[], vouchers: [] as string[], carts: [] as string[], invoices: [] as string[] };
const phones: string[] = [];
const { checkoutAction, previewVoucherAction } = await import("../app/(public)/[tenant]/cart/actions");

// Ambil Sendiri harus aktif di pengaturan toko agar baris pengiriman uji diterima server; dipulihkan di finally bila kita yang membuatnya
const [pk] = await db.select().from(s.settings).where(and(eq(s.settings.key, "pickup_enabled"), eq(s.settings.group, "toko")));
let createdPickup = false;
if (!pk) { await db.insert(s.settings).values({ key: "pickup_enabled", group: "toko", value: true as never }); createdPickup = true; }
else if (pk.value !== true) { console.error("pickup_enabled sudah ada dengan nilai lain — hentikan agar tidak menimpa pengaturan nyata."); process.exit(3); }

try {
  const mkProducer = async (name: string, share: string | null) => {
    const [r] = await db.insert(s.producers).values({ type: "custom", customName: `${tag} ${name}`, revenueSharePercent: share }).returning({ id: s.producers.id });
    made.producers.push(r.id); return r.id;
  };
  const prodA = await mkProducer("A", "10"), prodB = await mkProducer("B", "10"), prodNoShare = await mkProducer("TanpaPersen", null);
  const mkProduct = async (producerId: string | null, name: string, pub = "100000") => {
    const [r] = await db.insert(s.products).values({ slug: `${tag.toLowerCase()}-${made.products.length}`, name: `${tag} ${name}`, price: "90000", publicPrice: pub, stock: 50, producerId, status: "active" as never, weightGram: 100 }).returning({ id: s.products.id });
    made.products.push(r.id); return r.id;
  };
  const pA = await mkProduct(prodA, "Barang A"), pB = await mkProduct(prodB, "Barang B"), pInternal = await mkProduct(null, "Barang Internal"), pNo = await mkProduct(prodNoShare, "Barang TanpaPersen");

  const mkVoucher = async (code: string, over: Record<string, unknown>) => {
    const [r] = await db.insert(s.vouchers).values({
      code: `${tag}-${code}`.toUpperCase(), name: `${tag} ${code}`, discountType: "percentage", discountValue: "5", targetType: "product", targetItemIds: [], ...over,
    } as never).returning({ id: s.vouchers.id, code: s.vouchers.code });
    made.vouchers.push(r.id); return r.code;
  };
  const newCart = async (items: Array<{ id: string; name: string; qty?: number }>) => {
    currentToken = `${tag}-${randomUUID()}`;
    const [c] = await db.insert(s.carts).values({ sessionToken: currentToken, expiresAt: new Date(Date.now() + 3600_000) }).returning({ id: s.carts.id });
    made.carts.push(c.id);
    await db.insert(s.cartItems).values(items.map((it, i) => ({ cartId: c.id, itemType: "product" as const, itemId: it.id, name: it.name, unitPrice: "100000", quantity: it.qty ?? 1, sortOrder: i })));
  };
  // Baris pengiriman = Ambil Sendiri per produsen di keranjang (server memverifikasi terhadap isi keranjang; pickup tidak memanggil RajaOngkir)
  const lineProducers = async () => {
    const ci = await db.select({ itemId: s.cartItems.itemId }).from(s.cartItems).innerJoin(s.carts, eq(s.carts.id, s.cartItems.cartId)).where(eq(s.carts.sessionToken, currentToken));
    const prods = await db.select({ id: s.products.id, producerId: s.products.producerId }).from(s.products).where(inArray(s.products.id, ci.map((c) => c.itemId!)));
    return [...new Set(prods.map((p) => p.producerId))];
  };
  const checkout = async (voucher?: string) => {
    const phone = `+62812${Math.floor(10000000 + Math.random() * 89999999)}`; phones.push(phone);
    const lines = (await lineProducers()).map((producerId) => ({
      sellerType: "tenant" as const, sellerId: null, producerId, sellerName: "Uji", cost: 0, deliveryMethod: "pickup" as const, paymentMethod: "prepaid" as const,
      pickupLocationName: "Gudang Uji", pickupAddress: "Jl. Uji 1",
    }));
    const res = await checkoutAction(SLUG, { phone, name: `${tag} Pembeli`, method: "transfer" }, { cityId: 1, cityName: "Uji", lines } as never, voucher);
    if (res.success) made.invoices.push(res.data.invoiceId);
    return res;
  };
  const itemsOf = (invoiceId: string) => db.select().from(s.invoiceItems).where(eq(s.invoiceItems.invoiceId, invoiceId)).orderBy(s.invoiceItems.sortOrder);

  // 0. tanpa voucher: snapshot persentase ada untuk barang ber-produsen, null untuk internal
  await newCart([{ id: pA, name: "A" }, { id: pInternal, name: "Internal" }]);
  const r0 = await checkout();
  ok("checkout tanpa voucher berhasil", r0.success, r0.success ? "" : r0.error);
  if (r0.success) {
    const it = await itemsOf(r0.data.invoiceId);
    ok("snapshot: barang ber-produsen menyimpan persentase 10,00; internal NULL", Number(it[0].producerSharePercent) === 10 && it[1].producerSharePercent === null);
    ok("snapshot: tanpa diskon → penanggung NULL", it[0].discountFundedBy === null && it[1].discountFundedBy === null);
  }

  // 1. Promo Tenant 5% atas barang A
  const cTenant = await mkVoucher("TEN", { targetItemIds: [pA] });
  await newCart([{ id: pA, name: "A" }]);
  const r1 = await checkout(cTenant);
  ok("Promo Tenant: checkout berhasil", r1.success, r1.success ? "" : r1.error);
  if (r1.success) {
    const [it] = await itemsOf(r1.data.invoiceId);
    ok("Promo Tenant: potongan 5.000, ditanggung 'tenant', persentase 10 tersimpan, total 95.000", Number(it.discountAmount) === 5000 && it.discountFundedBy === "tenant" && Number(it.producerSharePercent) === 10 && Number(it.total) === 95000);
  }

  // 2. Promo Produsen A 5%
  const cProd = await mkVoucher("PRA", { ownerProducerId: prodA, targetItemIds: [pA] });
  await newCart([{ id: pA, name: "A" }]);
  const r2 = await checkout(cProd);
  ok("Promo Produsen: checkout berhasil", r2.success, r2.success ? "" : r2.error);
  if (r2.success) {
    const [it] = await itemsOf(r2.data.invoiceId);
    ok("Promo Produsen: potongan 5.000, ditanggung 'producer'", Number(it.discountAmount) === 5000 && it.discountFundedBy === "producer" && Number(it.total) === 95000);
  }

  // 3. Dibatasi persentase bagian tenant
  const cBig = await mkVoucher("BIG", { ownerProducerId: prodA, discountValue: "50", targetItemIds: [pA] });
  await newCart([{ id: pA, name: "A" }]);
  const r3 = await checkout(cBig);
  if (r3.success) { const [it] = await itemsOf(r3.data.invoiceId); ok("Promo Produsen 50% dibatasi 10% (=10.000) saat checkout", Number(it.discountAmount) === 10000 && Number(it.total) === 90000); }
  else ok("Promo Produsen 50% dibatasi 10% saat checkout", false, r3.error);

  // 4. Atas barang produsen lain / internal → ditolak
  const cOnlyA = await mkVoucher("ONLYA", { ownerProducerId: prodA, targetItemIds: [pA] });
  await newCart([{ id: pB, name: "B" }, { id: pInternal, name: "Internal" }]);
  const r4 = await checkout(cOnlyA);
  ok("Promo Produsen A atas barang produsen B + internal → DITOLAK", !r4.success && /tidak berlaku/i.test(r4.success ? "" : r4.error), r4.success ? "(lolos!)" : r4.error);
  // target dimanipulasi: voucher milik A menarget barang B
  const cSteal = await mkVoucher("STEAL", { ownerProducerId: prodA, targetItemIds: [pB] });
  await newCart([{ id: pB, name: "B" }]);
  const r4b = await checkout(cSteal);
  ok("Promo Produsen A yang menarget barang B (target dimanipulasi) → DITOLAK", !r4b.success);

  // 5. Keranjang campuran: hanya barang A terpotong
  const cMix = await mkVoucher("MIX", { ownerProducerId: prodA, targetItemIds: [] });
  await newCart([{ id: pA, name: "A" }, { id: pB, name: "B" }, { id: pInternal, name: "Internal" }]);
  const r5 = await checkout(cMix);
  if (r5.success) {
    const it = await itemsOf(r5.data.invoiceId);
    ok("campuran: hanya barang A terpotong (5.000); B & internal utuh", Number(it[0].discountAmount) === 5000 && Number(it[1].discountAmount) === 0 && Number(it[2].discountAmount) === 0 && it[1].discountFundedBy === null);
    ok("campuran: snapshot persentase per baris (A=10, B=10, internal=NULL)", Number(it[0].producerSharePercent) === 10 && Number(it[1].producerSharePercent) === 10 && it[2].producerSharePercent === null);
  } else ok("campuran: checkout berhasil", false, r5.error);

  // 6. Persentase berubah → batas ikut berubah; snapshot lama TIDAK berubah
  await db.update(s.producers).set({ revenueSharePercent: "4" }).where(eq(s.producers.id, prodA));
  await newCart([{ id: pA, name: "A" }]);
  const r6 = await checkout(cBig);
  if (r6.success) {
    const [it] = await itemsOf(r6.data.invoiceId);
    ok("persentase diturunkan ke 4%: voucher 50% kini dibatasi 4.000 + snapshot 4,00", Number(it.discountAmount) === 4000 && Number(it.producerSharePercent) === 4);
  } else ok("persentase diturunkan: checkout berhasil", false, r6.error);
  if (r3.success) { const [old] = await itemsOf(r3.data.invoiceId); ok("riwayat: snapshot invoice lama TETAP 10 (tidak ikut berubah)", Number(old.producerSharePercent) === 10 && Number(old.discountAmount) === 10000); }

  // 7. Produsen tanpa persentase
  const cNo = await mkVoucher("NOSH", { ownerProducerId: prodNoShare, targetItemIds: [pNo] });
  await newCart([{ id: pNo, name: "NoShare" }]);
  const r7 = await checkout(cNo);
  ok("Promo Produsen tanpa persentase ditetapkan → DITOLAK", !r7.success);
  await newCart([{ id: pNo, name: "NoShare" }]);
  const r7b = await checkout();
  if (r7b.success) { const [it] = await itemsOf(r7b.data.invoiceId); ok("tanpa persentase: checkout biasa tetap jalan, snapshot NULL", it.producerSharePercent === null); }
  else ok("tanpa persentase: checkout biasa tetap jalan", false, r7b.error);

  // 8. Preview memakai aturan yang sama
  await db.update(s.producers).set({ revenueSharePercent: "10" }).where(eq(s.producers.id, prodA));
  await newCart([{ id: pA, name: "A" }]);
  const pv = await previewVoucherAction(SLUG, cBig);
  ok("preview: Promo Produsen 50% dibatasi 10.000 (sama dengan checkout)", pv.success && pv.data.valid === true && pv.data.totalDiscount === 10000, pv.success ? JSON.stringify(pv.data) : pv.error);
  await newCart([{ id: pB, name: "B" }]);
  const pv2 = await previewVoucherAction(SLUG, cOnlyA);
  ok("preview: Promo Produsen A atas barang B = tidak valid", pv2.success && pv2.data.valid === false);

  // 9. Penghapusan produsen yang punya voucher ditahan database
  const delErr = await db.delete(s.producers).where(eq(s.producers.id, prodA)).then(() => null, (e: unknown) => e);
  ok("FK: produsen yang masih punya voucher tidak bisa dihapus (RESTRICT)", delErr !== null);
} finally {
  const cleanup = async (label: string, fn: () => Promise<unknown>) => { try { await fn(); } catch (e) { console.error("cleanup", label, e instanceof Error ? e.message : e); fails++; } };
  await cleanup("redemptions", () => made.invoices.length ? db.delete(s.voucherRedemptions).where(inArray(s.voucherRedemptions.invoiceId, made.invoices)) : Promise.resolve());
  await cleanup("invoice_shipping", async () => { if (made.invoices.length) await db.delete(s.invoiceShippingLines).where(inArray(s.invoiceShippingLines.invoiceId, made.invoices)); });
  await cleanup("invoice_items", () => made.invoices.length ? db.delete(s.invoiceItems).where(inArray(s.invoiceItems.invoiceId, made.invoices)) : Promise.resolve());
  await cleanup("invoices", () => made.invoices.length ? db.delete(s.invoices).where(inArray(s.invoices.id, made.invoices)) : Promise.resolve());
  await cleanup("cart_items", () => made.carts.length ? db.delete(s.cartItems).where(inArray(s.cartItems.cartId, made.carts)) : Promise.resolve());
  await cleanup("carts", () => made.carts.length ? db.delete(s.carts).where(inArray(s.carts.id, made.carts)) : Promise.resolve());
  await cleanup("vouchers", () => db.delete(s.vouchers).where(like(s.vouchers.code, `${tag.toUpperCase()}%`)));
  await cleanup("products", () => made.products.length ? db.delete(s.products).where(inArray(s.products.id, made.products)) : Promise.resolve());
  await cleanup("producers", () => made.producers.length ? db.delete(s.producers).where(inArray(s.producers.id, made.producers)) : Promise.resolve());
  await cleanup("pickup_setting", async () => { if (createdPickup) await db.delete(s.settings).where(and(eq(s.settings.key, "pickup_enabled"), eq(s.settings.group, "toko"))); });
  console.log("nomor HP uji (cek profil tamu bila perlu):", phones.length);
}
console.log(fails ? `\n${fails} GAGAL` : "\nSEMUA LULUS");
process.exit(fails ? 1 : 0);
