// Regresi data-nyata "Saldo produsen (C1a)" — docs/arsitektur-pencairan-produsen.md § 12.
// Menjalankan fungsi NYATA terhadap DB LOKAL lalu membersihkan semua baris buatannya.
//
//   cd apps/web && SMOKE_I_KNOW=1 bun run --preload ./scripts/stub-server-only.ts scripts/smoke-producer-ledger.ts
//
// PENGAMAN: host DATABASE_URL harus PERSIS localhost/127.0.0.1; wajib SMOKE_I_KNOW=1; data uji bertanda "SMOKE-" dan dihapus di finally.
import { randomUUID } from "crypto";
import { eq, inArray, like } from "drizzle-orm";
import { createTenantDb, computeLineCredit, loadShipmentCredit, completeProducerShipment, sweepProducerSettlements, getProducerBalance, listProducerShipments } from "@jalajogja/db";

const isLocalHost = (h: string) => h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h === "::1";
let dbHost = ""; try { dbHost = new URL(process.env.DATABASE_URL ?? "").hostname; } catch { /* ditolak */ }
if (!isLocalHost(dbHost) || process.env.SMOKE_I_KNOW !== "1") { console.error(`DITOLAK: butuh DATABASE_URL localhost (terbaca: '${dbHost}') dan SMOKE_I_KNOW=1.`); process.exit(2); }
const SLUG = process.env.SMOKE_TENANT ?? "pc-ikpm-jogjakarta";
let fails = 0;
const ok = (n: string, v: boolean, x = "") => { console.log((v ? "PASS " : "FAIL ") + n + (x ? "  " + x : "")); if (!v) fails++; };

// ── Bagian MURNI: rumus K23/K25 ──
const L = (o: Partial<Parameters<typeof computeLineCredit>[0]>) => computeLineCredit({ invoiceItemId: "x", name: "p", unitPrice: 10000, quantity: 1, discountAmount: 0, percent: 10, fundedBy: null, ...o });
ok("rumus: harga umum 10.000 @10% → produsen 9.000", L({}).amount === 9000);
ok("rumus: harga anggota 9.000 @10% → produsen 8.100", L({ unitPrice: 9000 }).amount === 8100);
ok("rumus K23: Promo Tenant (diskon 500) → produsen tetap 9.000", L({ discountAmount: 500, fundedBy: "tenant" }).amount === 9000);
ok("rumus K23: Promo Produsen (diskon 500) → produsen 8.500", L({ discountAmount: 500, fundedBy: "producer" }).amount === 8500);
ok("rumus: jumlah 3 × 10.000 @10% = 27.000", L({ quantity: 3 }).amount === 27000);
ok("rumus: pembulatan 2 desimal (99.999 @7,5%)", L({ unitPrice: 99999, percent: 7.5 }).amount === 92499.08);
ok("rumus: persen tak tercatat → amount 0, percent null", (() => { const l = L({ percent: null }); return l.amount === 0 && l.percent === null; })());
ok("rumus: potongan produsen melebihi bagiannya → dipaksa 0 + ditandai", (() => { const l = L({ percent: 60, discountAmount: 6000, fundedBy: "producer" }); return l.amount === 0 && l.clamped; })());

// ── Bagian DB nyata ──
const tc = createTenantDb(SLUG); const { db, schema: s } = tc;
const tag = `SMOKE-${randomUUID().slice(0, 6)}`;
const made = { producers: [] as string[], invoices: [] as string[] };
const DAY = 86_400_000;

try {
  const mkProducer = async (name: string) => { const [r] = await db.insert(s.producers).values({ type: "custom", customName: `${tag} ${name}`, revenueSharePercent: "10" }).returning({ id: s.producers.id }); made.producers.push(r.id); return r.id; };
  const pA = await mkProducer("A"), pB = await mkProducer("B");

  type It = { producerId: string; unit: number; qty?: number; percent?: string | null; discount?: number; fundedBy?: "tenant" | "producer" | null };
  const mkInvoice = async (status: string, items: It[], ships: { producerId: string; cost: number; free?: number; status?: string; shippedAt?: Date | null; confirmed?: Date | null }[]) => {
    const [inv] = await db.insert(s.invoices).values({ invoiceNumber: `${tag}-${made.invoices.length}`, sourceType: "cart", customerName: tag, subtotal: "1", total: "1", status: status as never }).returning({ id: s.invoices.id });
    made.invoices.push(inv.id);
    const itemIds: string[] = [];
    for (const [i, it] of items.entries()) {
      const total = it.unit * (it.qty ?? 1) - (it.discount ?? 0);
      const [r] = await db.insert(s.invoiceItems).values({
        invoiceId: inv.id, itemType: "product", name: `${tag} item ${i}`, unitPrice: String(it.unit), quantity: it.qty ?? 1, total: String(total), sortOrder: i,
        producerId: it.producerId, producerSharePercent: it.percent === undefined ? "10" : it.percent, discountAmount: String(it.discount ?? 0), discountFundedBy: it.fundedBy ?? null,
      }).returning({ id: s.invoiceItems.id });
      itemIds.push(r.id);
    }
    const lineIds: string[] = [];
    for (const sh of ships) {
      const [r] = await db.insert(s.invoiceShippingLines).values({
        invoiceId: inv.id, sellerType: "tenant", producerId: sh.producerId, sellerName: tag, cost: String(sh.cost),
        freeShippingDiscount: sh.free ? String(sh.free) : null, status: (sh.status ?? "shipped") as never,
        shippedAt: sh.shippedAt === undefined ? new Date() : sh.shippedAt, buyerConfirmedAt: sh.confirmed ?? null,
      }).returning({ id: s.invoiceShippingLines.id });
      lineIds.push(r.id);
    }
    return { invoiceId: inv.id, itemIds, lineIds };
  };
  const ledgerOf = (shippingLineId: string) => db.select().from(s.producerLedgerEntries).where(eq(s.producerLedgerEntries.shippingLineId, shippingLineId));

  // 1) Invoice lunas: produsen A punya 2 baris (satu voucher Promo Produsen), produsen B 1 baris; ongkir A 15.000 (+ info gratis ongkir 5.000), B 20.000
  const inv1 = await mkInvoice("paid",
    [{ producerId: pA, unit: 10000 }, { producerId: pA, unit: 9000, qty: 2, discount: 900, fundedBy: "producer" }, { producerId: pB, unit: 50000 }],
    [{ producerId: pA, cost: 15000, free: 5000 }, { producerId: pB, cost: 20000 }]);
  const [slA, slB] = inv1.lineIds;
  const credA = await loadShipmentCredit({ db, schema: s }, slA);
  // baris 1: 9.000 ; baris 2: 18.000×0,9 − 900 = 15.300 ; ongkir 15.000
  ok("hitung: hanya baris milik produsen A (2 baris)", credA?.lines.length === 2);
  ok("hitung: bagian produk = 9.000 + 15.300", credA?.productAmount === 24300, `=${credA?.productAmount}`);
  ok("hitung: ongkir dibayar pembeli diteruskan penuh; total = 39.300", credA?.shippingAmount === 15000 && credA?.total === 39300, `=${credA?.total}`);
  ok("hitung: info ongkir ditanggung produsen (gratis ongkir) = 5.000, tidak ikut total", credA?.freeShippingDiscount === 5000);
  ok("hitung: lunas & persen lengkap → tanpa penghalang", credA?.blocker === null);
  ok("hitung: pengiriman produsen lain tidak tercampur", (await loadShipmentCredit({ db, schema: s }, slB))?.productAmount === 45000);

  // 2) Saldo MENUNGGU sebelum selesai (tanpa baris ledger)
  const bal0 = await getProducerBalance({ db, schema: s }, pA);
  ok("saldo: sebelum selesai → Menunggu 39.300, Bisa dicairkan 0", bal0.waiting === 39300 && bal0.available === 0, JSON.stringify(bal0));
  ok("saldo: tidak ada baris ledger sebelum selesai", (await ledgerOf(slA)).length === 0);

  // 3) Selesaikan → ledger terbit; ulang → idempoten
  const r1 = await completeProducerShipment(tc, slA, "buyer");
  ok("selesai: sukses", r1.ok && !r1.already && r1.total === 39300);
  const rowsA = await ledgerOf(slA);
  ok("selesai: 2 baris sale + 1 baris shipping, jumlah = 39.300", rowsA.length === 3 && rowsA.filter((r) => r.kind === "sale").length === 2 && Math.round(rowsA.reduce((a, r) => a + Number(r.amount), 0) * 100) / 100 === 39300);
  ok("selesai: baris memuat meta audit (persen, dasar, penanggung voucher)", rowsA.some((r) => (r.meta as Record<string, unknown>)?.discountFundedBy === "producer" && (r.meta as Record<string, unknown>)?.tenantPercent === 10));
  const [slRow] = await db.select().from(s.invoiceShippingLines).where(eq(s.invoiceShippingLines.id, slA));
  ok("selesai: pengiriman ditandai selesai + sumber", !!slRow.completedAt && slRow.completionSource === "buyer");
  const r2 = await completeProducerShipment(tc, slA, "buyer");
  ok("idempoten: panggilan kedua = already, baris tidak bertambah", r2.ok && r2.already && (await ledgerOf(slA)).length === 3);
  const bal1 = await getProducerBalance({ db, schema: s }, pA);
  ok("saldo: sesudah selesai → Bisa dicairkan 39.300, Menunggu 0", bal1.available === 39300 && bal1.waiting === 0, JSON.stringify(bal1));

  // 4) Balapan: 6 penyelesaian bersamaan → kredit tepat sekali
  const race = await Promise.all(Array.from({ length: 6 }, () => completeProducerShipment(tc, slB, "auto")));
  ok("balapan: semua ok, tepat satu yang membuat kredit", race.every((r) => r.ok) && race.filter((r) => r.ok && !r.already).length === 1);
  ok("balapan: baris ledger B = 1 sale + 1 shipping", (await ledgerOf(slB)).length === 2);

  // 5) Penghalang
  const inv2 = await mkInvoice("pending", [{ producerId: pA, unit: 10000 }], [{ producerId: pA, cost: 0 }]);
  const rb = await completeProducerShipment(tc, inv2.lineIds[0], "buyer");
  ok("penghalang: invoice belum lunas → ditolak, tanpa ledger", !rb.ok && rb.reason === "belum_lunas" && (await ledgerOf(inv2.lineIds[0])).length === 0);
  const inv3 = await mkInvoice("paid", [{ producerId: pA, unit: 10000, percent: null }], [{ producerId: pA, cost: 0 }]);
  const rp = await completeProducerShipment(tc, inv3.lineIds[0], "buyer");
  ok("penghalang: persentase tak tercatat → ditolak, tanpa ledger (tidak ditebak)", !rp.ok && rp.reason === "persentase_tidak_tercatat" && (await ledgerOf(inv3.lineIds[0])).length === 0);
  ok("penghalang: pengiriman tak ada → tidak_ditemukan", (await completeProducerShipment(tc, randomUUID(), "auto")).ok === false);
  const inv4 = await mkInvoice("paid", [{ producerId: pA, unit: 10000 }], [{ producerId: pA, cost: 0, free: 7000 }]);
  await completeProducerShipment(tc, inv4.lineIds[0], "buyer");
  ok("gratis ongkir: ongkir Rp0 → TIDAK ada baris shipping, hanya bagian produk 9.000", (await ledgerOf(inv4.lineIds[0])).filter((r) => r.kind === "shipping").length === 0 && (await ledgerOf(inv4.lineIds[0])).length === 1);

  // 6) Sapuan: >10 hari tanpa konfirmasi → otomatis; 3 hari → belum; sudah dikonfirmasi pembeli → selesai; persen null → dilaporkan
  const old = await mkInvoice("paid", [{ producerId: pA, unit: 10000 }], [{ producerId: pA, cost: 1000, shippedAt: new Date(Date.now() - 11 * DAY) }]);
  const recent = await mkInvoice("paid", [{ producerId: pA, unit: 10000 }], [{ producerId: pA, cost: 1000, shippedAt: new Date(Date.now() - 3 * DAY) }]);
  const conf = await mkInvoice("paid", [{ producerId: pA, unit: 10000 }], [{ producerId: pA, cost: 1000, shippedAt: new Date(Date.now() - 1 * DAY), confirmed: new Date() }]);
  const oldNull = await mkInvoice("paid", [{ producerId: pA, unit: 10000, percent: null }], [{ producerId: pA, cost: 0, shippedAt: new Date(Date.now() - 12 * DAY) }]);
  const sw = await sweepProducerSettlements(tc, { limit: 500 });
  const done = async (id: string) => (await db.select().from(s.invoiceShippingLines).where(eq(s.invoiceShippingLines.id, id)))[0];
  ok("sapuan: >10 hari → selesai otomatis (sumber auto)", (await done(old.lineIds[0])).completionSource === "auto" && (await ledgerOf(old.lineIds[0])).length === 2);
  ok("sapuan: baru 3 hari tanpa konfirmasi → belum selesai", (await done(recent.lineIds[0])).completedAt === null && (await ledgerOf(recent.lineIds[0])).length === 0);
  ok("sapuan: sudah dikonfirmasi pembeli → selesai (sumber buyer)", (await done(conf.lineIds[0])).completionSource === "buyer");
  ok("sapuan: persen tak tercatat dilaporkan (blocked), tidak dikreditkan", (sw.blocked.persentase_tidak_tercatat ?? 0) >= 1 && (await done(oldNull.lineIds[0])).completedAt === null);
  const sw2 = await sweepProducerSettlements(tc, { limit: 500 });
  ok("sapuan: dijalankan ulang tidak membuat kredit ganda", sw2.completed === 0 && (await ledgerOf(old.lineIds[0])).length === 2);

  // 7) Isolasi antar-produsen
  const listB = await listProducerShipments({ db, schema: s }, pB, { limit: 50 });
  ok("isolasi: daftar produsen B hanya miliknya", listB.length >= 1 && listB.every((c) => c.producerId === pB) && !listB.some((c) => c.shippingLineId === slA));
  const balB = await getProducerBalance({ db, schema: s }, pB);
  ok("isolasi: saldo B = 45.000 + 20.000, tidak memuat A", balB.available === 65000, JSON.stringify(balB));
  ok("integritas: ledger tak bisa memuat dua kredit sale untuk item yang sama (indeks unik)", await (async () => {
    const [row] = await db.select().from(s.producerLedgerEntries).where(eq(s.producerLedgerEntries.kind, "sale")).limit(1);
    try { await db.insert(s.producerLedgerEntries).values({ producerId: row.producerId, kind: "sale", amount: "1", invoiceItemId: row.invoiceItemId, shippingLineId: row.shippingLineId }); return false; } catch { return true; }
  })());
} finally {
  const cleanup = async (label: string, fn: () => Promise<unknown>) => { try { await fn(); } catch (e) { console.error("cleanup", label, e instanceof Error ? e.message : e); fails++; } };
  await cleanup("ledger", () => made.producers.length ? db.delete(s.producerLedgerEntries).where(inArray(s.producerLedgerEntries.producerId, made.producers)) : Promise.resolve());
  await cleanup("shipping", () => made.invoices.length ? db.delete(s.invoiceShippingLines).where(inArray(s.invoiceShippingLines.invoiceId, made.invoices)) : Promise.resolve());
  await cleanup("items", () => made.invoices.length ? db.delete(s.invoiceItems).where(inArray(s.invoiceItems.invoiceId, made.invoices)) : Promise.resolve());
  await cleanup("invoices", () => made.invoices.length ? db.delete(s.invoices).where(inArray(s.invoices.id, made.invoices)) : Promise.resolve());
  await cleanup("producers", () => made.producers.length ? db.delete(s.producers).where(inArray(s.producers.id, made.producers)) : Promise.resolve());
  await cleanup("sisa-bertanda", async () => { await db.delete(s.invoices).where(like(s.invoices.invoiceNumber, `${tag}%`)); });
}
console.log(fails ? `\n${fails} GAGAL` : "\nSEMUA LULUS");
process.exit(fails ? 1 : 0);
