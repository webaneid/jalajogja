// Regresi data-nyata "Dashboard Produsen" — docs/arsitektur-portal-produsen.md § 29. DB LOKAL saja; data uji bertanda SMOKE- dan dibersihkan.
//   cd apps/web && SMOKE_I_KNOW=1 bun run --preload ./scripts/stub-server-only.ts scripts/smoke-producer-dashboard.ts
import { randomUUID } from "crypto";
import { eq, inArray, like, sql } from "drizzle-orm";
import { createTenantDb, systemActorUserId } from "@jalajogja/db";
import { loadProducerDashboard, parsePeriode } from "../lib/producer-dashboard.server";

const isLocalHost = (h: string) => ["localhost", "127.0.0.1", "[::1]", "::1"].includes(h);
let dbHost = ""; try { dbHost = new URL(process.env.DATABASE_URL ?? "").hostname; } catch { /* ditolak */ }
if (!isLocalHost(dbHost) || process.env.SMOKE_I_KNOW !== "1") { console.error(`DITOLAK: butuh DATABASE_URL localhost (terbaca: '${dbHost}') dan SMOKE_I_KNOW=1.`); process.exit(2); }
const SLUG = process.env.SMOKE_TENANT ?? "pc-ikpm-jogjakarta";
let fails = 0;
const ok = (n: string, v: boolean, x = "") => { console.log((v ? "PASS " : "FAIL ") + n + (x ? "  " + x : "")); if (!v) fails++; };
ok("periode: bawaan 30, nilai sah 90/semua, selain itu → 30", parsePeriode(undefined) === "30" && parsePeriode("90") === "90" && parsePeriode("semua") === "semua" && parsePeriode("x") === "30");

const tc = createTenantDb(SLUG); const { db, schema: s } = tc;
const tag = `SMOKE-${randomUUID().slice(0, 6)}`;
const made = { producers: [] as string[], invoices: [] as string[], products: [] as string[], payments: [] as string[], txs: [] as string[] };
const DAY = 86_400_000;
let seq = 0;

try {
  const mkProducer = async (name: string) => { const [r] = await db.insert(s.producers).values({ type: "custom", customName: `${tag} ${name}`, revenueSharePercent: "10", productLimit: 5 }).returning({ id: s.producers.id }); made.producers.push(r.id); return r.id; };
  const pA = await mkProducer("A"), pB = await mkProducer("B");
  const mkProduct = async (producerId: string, name: string, stock: number, type: "simple" | "variable" = "simple", status = "active") => {
    const [r] = await db.insert(s.products).values({ slug: `${tag.toLowerCase()}-${made.products.length}`, name: `${tag} ${name}`, price: "1", publicPrice: "10", stock, producerId, status: status as never, productType: type, images: [{ url: "https://x/y.png", variants: { square: "https://x/sq.png" } }] }).returning({ id: s.products.id });
    made.products.push(r.id); return r.id;
  };
  const kaos = await mkProduct(pA, "Kaos", 3), sajadah = await mkProduct(pA, "Sajadah", 0), batik = await mkProduct(pA, "Batik", 50, "variable");
  await mkProduct(pA, "Draf", 5, "simple", "draft"); await mkProduct(pB, "Milik B", 9);
  const [batikVar] = await db.insert(s.productVariations).values({ productId: batik, publicPrice: "100000", stock: 4, attributeCombo: { U: "S" }, isActive: true }).returning({ id: s.productVariations.id });

  type It = { producerId: string; itemId: string; unit: number; qty: number; percent?: string | null };
  const mkOrder = async (opts: { buyer: string; city: string | null; daysAgo: number; items: It[]; ship?: { producerId: string; cost: number; status?: string; legacy?: boolean }; status?: string; paid?: boolean }) => {
    const [inv] = await db.insert(s.invoices).values({
      invoiceNumber: `${tag}-${seq++}`, sourceType: "cart", customerName: opts.buyer, customerPhone: opts.buyer, subtotal: "1", total: "1", status: (opts.status ?? "paid") as never,
      shippingCityName: opts.city, createdAt: new Date(Date.now() - opts.daysAgo * DAY),
    }).returning({ id: s.invoices.id });
    made.invoices.push(inv.id);
    for (const [i, it] of opts.items.entries()) await db.insert(s.invoiceItems).values({
      invoiceId: inv.id, itemType: "product", itemId: it.itemId, name: `${tag} x`, unitPrice: String(it.unit), quantity: it.qty, total: String(it.unit * it.qty), sortOrder: i,
      producerId: it.producerId, producerSharePercent: it.percent === undefined ? "10" : it.percent,
    });
    if (opts.ship) await db.insert(s.invoiceShippingLines).values({ invoiceId: inv.id, sellerType: "tenant", producerId: opts.ship.producerId, sellerName: tag, cost: String(opts.ship.cost), status: (opts.ship.status ?? "pending") as never, payoutLegacy: !!opts.ship.legacy });
    if (opts.paid !== false && (opts.status ?? "paid") === "paid") {
      const [pay] = await db.insert(s.payments).values({ number: `${tag}-P${seq}`, sourceType: "invoice", sourceId: inv.id, amount: "1", method: "transfer", status: "paid", confirmedAt: new Date(Date.now() - opts.daysAgo * DAY) } as never).returning({ id: s.payments.id });
      made.payments.push(pay.id);
      await db.insert(s.invoicePayments).values({ invoiceId: inv.id, paymentId: pay.id, amount: "1" });
    }
    return inv.id;
  };

  // Kaos: 3 pesanan (2 pembeli, satu berulang); Batik (via VARIASI): 1 pesanan; Sajadah: 1 pesanan lama (60 hari)
  await mkOrder({ buyer: "081111", city: "KOTA BANDUNG", daysAgo: 2, items: [{ producerId: pA, itemId: kaos, unit: 100000, qty: 2 }], ship: { producerId: pA, cost: 15000, status: "pending" } });
  await mkOrder({ buyer: "081111", city: "KOTA BANDUNG", daysAgo: 5, items: [{ producerId: pA, itemId: kaos, unit: 100000, qty: 1 }], ship: { producerId: pA, cost: 10000, status: "shipped" } });
  await mkOrder({ buyer: "082222", city: "KOTA SURABAYA", daysAgo: 9, items: [{ producerId: pA, itemId: kaos, unit: 100000, qty: 1 }, { producerId: pA, itemId: batikVar.id, unit: 100000, qty: 3 }], ship: { producerId: pA, cost: 20000, status: "processing" } });
  await mkOrder({ buyer: "083333", city: "KOTA BANDUNG", daysAgo: 60, items: [{ producerId: pA, itemId: sajadah, unit: 50000, qty: 1 }] });
  // dikecualikan: belum lunas, tanpa persentase (model lama), milik produsen lain
  await mkOrder({ buyer: "084444", city: "X", daysAgo: 1, items: [{ producerId: pA, itemId: kaos, unit: 999999, qty: 9 }], status: "pending" });
  await mkOrder({ buyer: "085555", city: "X", daysAgo: 1, items: [{ producerId: pA, itemId: kaos, unit: 999999, qty: 9, percent: null }], ship: { producerId: pA, cost: 5000, legacy: true } });
  await mkOrder({ buyer: "086666", city: "KOTA BANDUNG", daysAgo: 1, items: [{ producerId: pB, itemId: kaos, unit: 777777, qty: 7 }] });

  const d30 = await loadProducerDashboard(tc, pA, "30");
  const kaosRow = d30.topProducts.find((t) => t.productId === kaos), batikRow = d30.topProducts.find((t) => t.productId === batik);
  ok("top produk 30 hari: Kaos 4 unit, 3 pesanan, 2 pembeli", kaosRow?.units === 4 && kaosRow?.orders === 3 && kaosRow?.buyers === 2, JSON.stringify(kaosRow));
  ok("top produk: pesanan atas VARIASI dikelompokkan ke produk induk (Batik 3 unit, 1 pembeli)", batikRow?.units === 3 && batikRow?.buyers === 1 && batikRow?.orders === 1, JSON.stringify(batikRow));
  ok("top produk: urutan menurut unit (Kaos 4 di atas Batik 3)", d30.topProducts[0]?.productId === kaos);
  ok("top produk: hak diterima = 90% × harga (Kaos 4×100.000 → 360.000)", kaosRow?.earned === 360000, `=${kaosRow?.earned}`);
  ok("top produk: gambar kecil dibawa", kaosRow?.image === "https://x/sq.png");
  ok("top produk: belum lunas / model lama / produsen lain TIDAK ikut (tak ada unit 9 / 7)", !d30.topProducts.some((t) => t.units >= 7));
  ok("top produk 30 hari: Sajadah (60 hari lalu) tak ikut; 'semua' memuatnya", !d30.topProducts.some((t) => t.productId === sajadah) && (await loadProducerDashboard(tc, pA, "semua")).topProducts.some((t) => t.productId === sajadah));
  ok("ringkasan 30 hari: 3 pesanan, 7 unit, 2 pembeli, 1 berulang", d30.summary.orders === 3 && d30.summary.units === 7 && d30.summary.buyers === 2 && d30.summary.repeatBuyers === 1, JSON.stringify(d30.summary));
  ok("ringkasan: rata-rata nilai pesanan = (200.000 + 100.000 + 400.000)/3", Math.abs(d30.summary.avgValue - 233333.33) < 0.02, `=${d30.summary.avgValue}`);
  ok("kota teratas: Bandung 2 pesanan, Surabaya 1; tanpa kota/produsen lain tak ikut", d30.cities[0]?.city === "KOTA BANDUNG" && d30.cities[0]?.n === 2 && d30.cities[1]?.city === "KOTA SURABAYA" && d30.cities.length === 2, JSON.stringify(d30.cities));

  // Tren: pemasukan = hak produk (90%) + ongkir pada hari pembayaran
  const byDay = new Map(d30.chart.map((c) => [c.date, c.income]));
  const dayStr = (ago: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date(Date.now() - ago * DAY));
  ok("tren: 30 titik harian berurutan", d30.chart.length === 30 && d30.chart[0].date < d30.chart[29].date);
  ok("tren: hari ke-2 = 90% × 200.000 + ongkir 15.000 = 195.000", byDay.get(dayStr(2)) === 195000, `=${byDay.get(dayStr(2))}`);
  ok("tren: hari ke-5 = 90.000 + 10.000 = 100.000", byDay.get(dayStr(5)) === 100000, `=${byDay.get(dayStr(5))}`);
  ok("tren: hari ke-9 = 90.000 + 270.000 + 20.000 = 380.000", byDay.get(dayStr(9)) === 380000, `=${byDay.get(dayStr(9))}`);
  ok("tren: model lama/belum lunas/produsen lain tak masuk (hari ke-1 = 0)", (byDay.get(dayStr(1)) ?? 0) === 0);

  // Pengiriman & produk
  ok("alur pengiriman: menunggu 1, diproses 1, dikirim 1 (model lama tak dihitung)", d30.shipping.pending === 1 && d30.shipping.processing === 1 && d30.shipping.shipped === 1 && d30.shipping.packed === 0, JSON.stringify(d30.shipping));
  ok("produk: aktif 3, draft 1, total 4, kuota 5", d30.products.active === 3 && d30.products.draft === 1 && d30.products.total === 4 && d30.products.limit === 5, JSON.stringify(d30.products));
  ok("stok: Kaos 3 → menipis (≤5), Sajadah 0 → habis, Batik variasi 4 → menipis", d30.products.low === 2 && d30.products.empty === 1, `low=${d30.products.low} empty=${d30.products.empty}`);
  ok("saldo: belum ada kredit → bisa dicairkan 0, tanpa rekening, tanpa hutang", d30.available === 0 && d30.debt === 0 && !d30.hasBank && d30.activePayout === null);

  // Isolasi: produsen B tak melihat data A
  const dB = await loadProducerDashboard(tc, pB, "semua");
  ok("isolasi: dashboard B hanya memuat produknya (777.777 × 7), tanpa Kaos milik A", dB.topProducts.length === 1 && dB.topProducts[0].units === 7 && dB.summary.orders === 1 && dB.products.total === 1);

  // Pencairan di tren
  const actor = await systemActorUserId(db, s);
  const [tx] = await db.insert(s.transactions).values({ date: dayStr(3), description: `${tag} jurnal uji`, referenceNumber: `${tag}-J`, createdBy: actor! }).returning({ id: s.transactions.id });
  made.txs.push(tx.id);
  const [pay] = await db.insert(s.producerPayouts).values({ number: `PRC-SMOKE-${tag}`, producerId: pA, status: "paid", creditsTotal: "300000", subtotal: "300000", transferFee: "7500", netAmount: "292500",
    bankCode: "bri", bankName: "BRI", accountNumberEnc: "x", accountLast4: "1234", accountHolder: tag, paidAt: new Date(Date.now() - 3 * DAY), proofUrl: "https://x/b.png", proofMediaId: randomUUID(), transactionId: tx.id } as never).returning({ id: s.producerPayouts.id }).catch(() => [undefined as never]);
  if (pay) {
    const d2 = await loadProducerDashboard(tc, pA, "30");
    ok("pencairan masuk tren pada hari dibayar (net 292.500) + total diterima", d2.chart.find((c) => c.date === dayStr(3))?.expense === 292500 && d2.paidTotal === 292500 && d2.lastPayout?.status === "paid", JSON.stringify(d2.lastPayout));
  } else console.log("INFO  baris pencairan uji tak bisa dibuat (CHECK DB: bukti+jurnal wajib) — pengecekan tren pencairan dilewati");
} finally {
  const cleanup = async (label: string, fn: () => Promise<unknown>) => { try { await fn(); } catch (e) { console.error("cleanup", label, e instanceof Error ? e.message : e); fails++; } };
  await cleanup("payouts", () => made.producers.length ? db.delete(s.producerPayouts).where(inArray(s.producerPayouts.producerId, made.producers)) : Promise.resolve());
  await cleanup("tx", () => made.txs.length ? db.delete(s.transactions).where(inArray(s.transactions.id, made.txs)) : Promise.resolve());
  await cleanup("invoice_payments", () => made.invoices.length ? db.delete(s.invoicePayments).where(inArray(s.invoicePayments.invoiceId, made.invoices)) : Promise.resolve());
  await cleanup("payments", () => made.payments.length ? db.delete(s.payments).where(inArray(s.payments.id, made.payments)) : Promise.resolve());
  await cleanup("shipping", () => made.invoices.length ? db.delete(s.invoiceShippingLines).where(inArray(s.invoiceShippingLines.invoiceId, made.invoices)) : Promise.resolve());
  await cleanup("items", () => made.invoices.length ? db.delete(s.invoiceItems).where(inArray(s.invoiceItems.invoiceId, made.invoices)) : Promise.resolve());
  await cleanup("invoices", () => made.invoices.length ? db.delete(s.invoices).where(inArray(s.invoices.id, made.invoices)) : Promise.resolve());
  await cleanup("variasi", () => made.products.length ? db.delete(s.productVariations).where(inArray(s.productVariations.productId, made.products)) : Promise.resolve());
  await cleanup("produk", () => made.products.length ? db.delete(s.products).where(inArray(s.products.id, made.products)) : Promise.resolve());
  await cleanup("producers", () => made.producers.length ? db.delete(s.producers).where(inArray(s.producers.id, made.producers)) : Promise.resolve());
  await cleanup("sisa", async () => { await db.delete(s.invoices).where(like(s.invoices.invoiceNumber, `${tag}%`)); await db.execute(sql`SELECT 1`); void eq; });
}
console.log(fails ? `\n${fails} GAGAL` : "\nSEMUA LULUS");
process.exit(fails ? 1 : 0);
