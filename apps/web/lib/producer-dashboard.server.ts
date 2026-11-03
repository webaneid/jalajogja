// Data Dashboard Produsen — docs/arsitektur-portal-produsen.md § 29. HANYA BACA. Semua kueri difilter `producerId` (dari SESI pemanggil).
// Hanya sistem bagi hasil baru yang dihitung: baris dengan persentase tersimpan & pengiriman bukan model lama (payout_legacy).
import "server-only";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  createTenantDb, computeEligible, getBankAccounts, getPayoutSettings, getProducerBalance, getProducerDebt, getVariableProductStockTotals, listPayouts,
} from "@jalajogja/db";

type Tc = ReturnType<typeof createTenantDb>;
export type Periode = "30" | "90" | "semua";
export const parsePeriode = (v: unknown): Periode => (v === "90" || v === "semua" ? v : "30");
const rows = <T,>(r: unknown) => Array.from(r as Iterable<T>);
const num = (v: unknown) => Number(v ?? 0) || 0;
const round2 = (n: number) => Math.round(n * 100) / 100;
const dayKey = (d: unknown) => (d instanceof Date ? d.toISOString() : String(d)).slice(0, 10);

/** Bagian produsen per baris item (K23/K25) sebagai ekspresi SQL — sama dengan `computeLineCredit` (>= 0). */
const earnExpr = (ii: string) => sql.raw(`GREATEST(${ii}.unit_price * ${ii}.quantity * (100 - ${ii}.producer_share_percent) / 100 - CASE WHEN ${ii}.discount_funded_by = 'producer' THEN ${ii}.discount_amount ELSE 0 END, 0)`);
const buyerKey = sql.raw(`COALESCE(i.member_id::text, i.profile_id::text, NULLIF(i.customer_phone, ''), NULLIF(i.customer_email, ''), i.id::text)`);

function sinceOf(p: Periode, now: Date): string | null {
  if (p === "semua") return null;
  return new Date(now.getTime() - Number(p) * 86_400_000).toISOString();
}

export type TopProduct = { productId: string; name: string; image: string | null; units: number; orders: number; buyers: number; earned: number };

export async function loadProducerDashboard(tc: Tc, producerId: string, periode: Periode, now: Date = new Date()) {
  const { db, schema: s } = tc;
  const since = sinceOf(periode, now);
  const sinceCond = since ? sql`AND i.created_at >= ${since}::timestamptz` : sql``;
  const base = sql`${s.invoiceItems} ii JOIN ${s.invoices} i ON i.id = ii.invoice_id
    WHERE ii.producer_id = ${producerId} AND ii.item_type = 'product' AND ii.producer_share_percent IS NOT NULL AND i.status = 'paid'`;

  // ── Saldo & pencairan ──
  const [balance, eligible, debt, payouts, bank, settings] = await Promise.all([
    getProducerBalance({ db, schema: s }, producerId),
    computeEligible({ db, schema: s }, producerId),
    getProducerDebt({ db, schema: s }, producerId),
    listPayouts({ db, schema: s }, { producerId, limit: 30 }),
    getBankAccounts({ db, schema: s }, producerId),
    getPayoutSettings({ db, schema: s }),
  ]);

  // ── Produk paling laku (unit, pembeli unik, pesanan, hak diterima) ──
  const topRaw = rows<{ product_id: string; units: number; orders: number; buyers: number; earn: string }>(await db.execute(sql`
    SELECT COALESCE(p.id, v.product_id) AS product_id, SUM(ii.quantity)::int AS units, COUNT(DISTINCT i.id)::int AS orders,
           COUNT(DISTINCT ${buyerKey})::int AS buyers, SUM(${earnExpr("ii")}) AS earn
    FROM ${s.invoiceItems} ii JOIN ${s.invoices} i ON i.id = ii.invoice_id
    LEFT JOIN ${s.products} p ON p.id = ii.item_id LEFT JOIN ${s.productVariations} v ON v.id = ii.item_id
    WHERE ii.producer_id = ${producerId} AND ii.item_type = 'product' AND ii.producer_share_percent IS NOT NULL AND i.status = 'paid' ${sinceCond}
    GROUP BY 1 HAVING COALESCE(p.id, v.product_id) IS NOT NULL ORDER BY units DESC, earn DESC LIMIT 5`));
  const ids = topRaw.map((r) => r.product_id);
  const prodRows = ids.length ? await db.select({ id: s.products.id, name: s.products.name, images: s.products.images }).from(s.products).where(inArray(s.products.id, ids)) : [];
  const byId = new Map(prodRows.map((r) => [r.id, r]));
  const thumb = (images: unknown): string | null => {
    const f = Array.isArray(images) ? (images[0] as { url?: string; variants?: Record<string, string> | null } | undefined) : undefined;
    return f?.variants?.square ?? f?.url ?? null;
  };
  const topProducts: TopProduct[] = topRaw.map((r) => ({
    productId: r.product_id, name: byId.get(r.product_id)?.name ?? "Produk", image: thumb(byId.get(r.product_id)?.images),
    units: num(r.units), orders: num(r.orders), buyers: num(r.buyers), earned: round2(num(r.earn)),
  }));

  // ── Ringkasan penjualan periode ──
  const [sum] = rows<{ orders: number; units: number; avg_value: string; buyers: number; repeat_buyers: number }>(await db.execute(sql`
    WITH o AS (
      SELECT i.id, ${buyerKey} AS bk, SUM(ii.total) AS value, SUM(ii.quantity) AS units
      FROM ${s.invoiceItems} ii JOIN ${s.invoices} i ON i.id = ii.invoice_id
      WHERE ii.producer_id = ${producerId} AND ii.item_type = 'product' AND ii.producer_share_percent IS NOT NULL AND i.status = 'paid' ${sinceCond}
      GROUP BY i.id, bk)
    SELECT COUNT(*)::int AS orders, COALESCE(SUM(units), 0)::int AS units, COALESCE(AVG(value), 0) AS avg_value, COUNT(DISTINCT bk)::int AS buyers,
           (SELECT COUNT(*) FROM (SELECT bk FROM o GROUP BY bk HAVING COUNT(*) > 1) r)::int AS repeat_buyers FROM o`));

  // ── Daerah pembeli teratas (hanya nama kota teragregasi) ──
  const cities = rows<{ city: string; n: number }>(await db.execute(sql`
    SELECT i.shipping_city_name AS city, COUNT(DISTINCT i.id)::int AS n
    FROM ${s.invoiceItems} ii JOIN ${s.invoices} i ON i.id = ii.invoice_id
    WHERE ii.producer_id = ${producerId} AND ii.item_type = 'product' AND ii.producer_share_percent IS NOT NULL AND i.status = 'paid'
      AND i.shipping_city_name IS NOT NULL AND i.shipping_city_name <> '' ${sinceCond}
    GROUP BY 1 ORDER BY n DESC, city ASC LIMIT 5`));

  // ── Tren 30 hari: Pemasukan (hak produsen dari pembayaran yang dikonfirmasi hari itu) vs Pencairan (net_amount ditransfer) ──
  const since30 = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const income = rows<{ day: unknown; total: string }>(await db.execute(sql`
    WITH paid AS (
      SELECT ip.invoice_id, MAX(pay.confirmed_at) AS d FROM ${s.invoicePayments} ip JOIN ${s.payments} pay ON pay.id = ip.payment_id
      WHERE pay.status = 'paid' GROUP BY ip.invoice_id)
    SELECT (paid.d AT TIME ZONE 'Asia/Jakarta')::date AS day, SUM(x.hak) AS total FROM (
      SELECT ii.invoice_id, ${earnExpr("ii")} AS hak FROM ${s.invoiceItems} ii
        WHERE ii.producer_id = ${producerId} AND ii.item_type = 'product' AND ii.producer_share_percent IS NOT NULL
      UNION ALL
      SELECT sl.invoice_id, sl.cost AS hak FROM ${s.invoiceShippingLines} sl WHERE sl.producer_id = ${producerId} AND sl.payout_legacy = false
    ) x JOIN paid ON paid.invoice_id = x.invoice_id JOIN ${s.invoices} i ON i.id = x.invoice_id AND i.status = 'paid'
    WHERE paid.d >= ${since30}::timestamptz GROUP BY 1`));
  const out = rows<{ day: unknown; total: string }>(await db.execute(sql`
    SELECT (paid_at AT TIME ZONE 'Asia/Jakarta')::date AS day, SUM(net_amount) AS total FROM ${s.producerPayouts}
    WHERE producer_id = ${producerId} AND status = 'paid' AND paid_at >= ${since30}::timestamptz GROUP BY 1`));
  const incomeMap = new Map(income.map((r) => [dayKey(r.day), num(r.total)]));
  const outMap = new Map(out.map((r) => [dayKey(r.day), num(r.total)]));
  const todayWib = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(now);
  const chart: { date: string; income: number; expense: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(`${todayWib}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    chart.push({ date: key, income: round2(incomeMap.get(key) ?? 0), expense: round2(outMap.get(key) ?? 0) });
  }

  // ── Pengiriman terbuka (lunas, belum selesai, bukan model lama) per status ──
  const ship = rows<{ status: string; n: number }>(await db.execute(sql`
    SELECT sl.status, COUNT(*)::int AS n FROM ${s.invoiceShippingLines} sl JOIN ${s.invoices} i ON i.id = sl.invoice_id
    WHERE sl.producer_id = ${producerId} AND sl.payout_legacy = false AND sl.completed_at IS NULL AND i.status = 'paid' GROUP BY sl.status`));
  const shipBy = Object.fromEntries(ship.map((r) => [r.status, num(r.n)])) as Record<string, number>;
  const [held] = rows<{ n: number }>(await db.execute(sql`SELECT COUNT(*)::int AS n FROM ${s.invoiceShippingLines} WHERE producer_id = ${producerId} AND payout_hold_at IS NOT NULL`));

  // ── Produk: status, stok, kuota ──
  const prods = await db.select({ id: s.products.id, status: s.products.status, type: s.products.productType, stock: s.products.stock })
    .from(s.products).where(and(eq(s.products.producerId, producerId), isNull(s.products.mitraId)));
  const statusCount: Record<string, number> = { active: 0, draft: 0, archived: 0, frozen: 0 };
  for (const p of prods) statusCount[p.status] = (statusCount[p.status] ?? 0) + 1;
  const activeVar = prods.filter((p) => p.status === "active" && p.type === "variable").map((p) => p.id);
  const varTotals = activeVar.length ? await getVariableProductStockTotals(db, s, activeVar) : new Map<string, number>();
  let low = 0, empty = 0;
  for (const p of prods.filter((x) => x.status === "active")) {
    const st = p.type === "variable" ? (varTotals.get(p.id) ?? 0) : p.stock;
    if (st <= 0) empty++; else if (st <= 5) low++;
  }
  const [lim] = await db.select({ limit: s.producers.productLimit }).from(s.producers).where(eq(s.producers.id, producerId)).limit(1);

  // ── Voucher ──
  const [vc] = rows<{ n: number; used: number }>(await db.execute(sql`
    SELECT COUNT(*)::int AS n, COALESCE(SUM(used_count), 0)::int AS used FROM ${s.vouchers} WHERE owner_producer_id = ${producerId} AND is_active = true`));

  const active = payouts.find((p) => p.status === "requested" || p.status === "approved") ?? null;
  const paidTotal = round2(payouts.filter((p) => p.status === "paid").reduce((a, p) => a + num(p.netAmount), 0));
  const last = payouts.find((p) => p.status !== "cancelled") ?? null;

  return {
    balance, available: Math.max(0, eligible.subtotal), heldCount: eligible.heldCount, debt, minAmount: settings.minAmount, hasBank: !!bank.active,
    activePayout: active ? { id: active.id, number: active.number, status: active.status, subtotal: num(active.subtotal) } : null,
    lastPayout: last ? { id: last.id, number: last.number, status: last.status, subtotal: num(last.subtotal), net: last.netAmount === null ? null : num(last.netAmount), at: (last.paidAt ?? last.requestedAt).toISOString() } : null,
    paidTotal, paidCount: payouts.filter((p) => p.status === "paid").length,
    topProducts,
    summary: { orders: num(sum?.orders), units: num(sum?.units), avgValue: round2(num(sum?.avg_value)), buyers: num(sum?.buyers), repeatBuyers: num(sum?.repeat_buyers) },
    cities: cities.map((c) => ({ city: c.city, n: num(c.n) })),
    chart,
    shipping: { pending: shipBy.pending ?? 0, processing: shipBy.processing ?? 0, packed: shipBy.packed ?? 0, shipped: shipBy.shipped ?? 0, delivered: shipBy.delivered ?? 0 },
    heldShipments: num(held?.n),
    products: { active: statusCount.active ?? 0, draft: statusCount.draft ?? 0, archived: statusCount.archived ?? 0, frozen: statusCount.frozen ?? 0, total: prods.length, limit: lim?.limit ?? 3, low, empty },
    vouchers: { active: num(vc?.n), used: num(vc?.used) },
    periode,
  };
}
