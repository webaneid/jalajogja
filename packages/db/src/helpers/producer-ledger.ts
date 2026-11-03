/**
 * Saldo produsen — rumus kredit per pengiriman + penyelesaian (ledger). docs/arsitektur-pencairan-produsen.md § 3, § 12.
 *
 * Satuan = PENGIRIMAN (invoice_shipping_lines milik satu produsen, D12). Kredit pengiriman terdiri dari:
 *   - satu baris `sale` per invoice_items produsen itu (bagian produk), dan
 *   - satu baris `shipping` = ongkir yang DIBAYAR pembeli (invoice_shipping_lines.cost, sudah setelah gratis ongkir — D13/D14).
 * Rumus bagian produk per baris (K23/K25, angka dibekukan saat checkout):
 *   dasar   = unit_price × quantity           (harga setelah diskon anggota, SEBELUM voucher)
 *   bagian  = dasar × (100 − persen_tenant)/100 − (diskon bila discount_funded_by = 'producer')
 * Semua angka dibaca dari baris yang tersimpan — TIDAK PERNAH dari input klien.
 *
 * Kredit dibuat HANYA saat pengiriman selesai (completeProducerShipment) — satu titik tulis, idempoten (indeks unik) dan aman dipanggil
 * berulang (pembeli menekan dua kali, sapuan cron bersamaan). Saldo "Menunggu" dihitung saat dibaca (loadShipmentCredit), tanpa baris.
 */

import { and, eq, isNull, isNotNull, lt, or, sql } from "drizzle-orm";
import type { TenantDb } from "../tenant-client";
import { generateFinancialNumber } from "./finance";
import { resolveProducerAccounts, systemActorUserId, postJournalTx, journalDate } from "./producer-accounting";

const round2 = (n: number) => Math.round(n * 100) / 100;

export type ShipmentCreditLine = {
  invoiceItemId: string;
  name:          string;
  quantity:      number;
  base:          number;                 // dasar (sebelum voucher)
  percent:       number | null;          // persen bagian TENANT (snapshot); null = belum tercatat → perlu ditinjau
  fundedBy:      "tenant" | "producer" | null;
  discount:      number;                 // potongan voucher pada baris ini
  amount:        number;                 // bagian produsen (>= 0)
  clamped:       boolean;                // true bila hasil negatif dipaksa 0 (potongan produsen melebihi bagiannya)
};

export type ShipmentCredit = {
  shippingLineId: string;
  invoiceId:      string;
  invoiceNumber:  string | null;
  invoiceStatus:  string;
  producerId:     string;
  lines:          ShipmentCreditLine[];
  shippingAmount: number;                // ongkir yang dibayar pembeli = milik produsen
  freeShippingDiscount: number;          // INFO: ongkir kutipan yang tidak dibayar pembeli (ditanggung produsen)
  productAmount:  number;
  total:          number;
  /** Alasan tidak boleh dikreditkan otomatis; kosong = aman. */
  blocker:        "belum_lunas" | "persentase_tidak_tercatat" | "tanpa_produk" | null;
  status:         string;                // status pengiriman (pending..delivered)
  shippedAt:      Date | null;
  buyerConfirmedAt: Date | null;
  completedAt:    Date | null;
  completionSource: "buyer" | "auto" | null;
  createdAt:      Date;
};

/** Murni: hitung satu baris. Persen null → amount 0 dan pemanggil WAJIB menolak mengkreditkan. */
export function computeLineCredit(row: {
  invoiceItemId: string; name: string; unitPrice: number; quantity: number; discountAmount: number;
  percent: number | null; fundedBy: "tenant" | "producer" | null;
}): ShipmentCreditLine {
  const base = round2(row.unitPrice * row.quantity);
  const discount = round2(row.discountAmount);
  if (row.percent === null || !(row.percent >= 0 && row.percent < 100)) {
    return { invoiceItemId: row.invoiceItemId, name: row.name, quantity: row.quantity, base, percent: null, fundedBy: row.fundedBy, discount, amount: 0, clamped: false };
  }
  const raw = round2(base * (100 - row.percent) / 100 - (row.fundedBy === "producer" ? discount : 0));
  const clamped = raw < 0;
  return { invoiceItemId: row.invoiceItemId, name: row.name, quantity: row.quantity, base, percent: row.percent, fundedBy: row.fundedBy, discount, amount: clamped ? 0 : raw, clamped };
}

type Db = TenantDb["db"];
type Schema = TenantDb["schema"];
type TxLike = { db: Db; schema: Schema };

/** Baca satu pengiriman + hitung kreditnya (tanpa menulis). null = pengiriman tidak ada / bukan milik produsen. */
export async function loadShipmentCredit(tc: TxLike, shippingLineId: string): Promise<ShipmentCredit | null> {
  const { db, schema: s } = tc;
  const [sl] = await db.select({
    id: s.invoiceShippingLines.id, invoiceId: s.invoiceShippingLines.invoiceId, producerId: s.invoiceShippingLines.producerId,
    cost: s.invoiceShippingLines.cost, freeDisc: s.invoiceShippingLines.freeShippingDiscount, status: s.invoiceShippingLines.status,
    shippedAt: s.invoiceShippingLines.shippedAt, buyerConfirmedAt: s.invoiceShippingLines.buyerConfirmedAt,
    completedAt: s.invoiceShippingLines.completedAt, completionSource: s.invoiceShippingLines.completionSource,
    createdAt: s.invoiceShippingLines.createdAt,
  }).from(s.invoiceShippingLines).where(eq(s.invoiceShippingLines.id, shippingLineId)).limit(1);
  if (!sl || !sl.producerId) return null;

  const [inv] = await db.select({ status: s.invoices.status, number: s.invoices.invoiceNumber })
    .from(s.invoices).where(eq(s.invoices.id, sl.invoiceId)).limit(1);
  if (!inv) return null;

  const items = await db.select({
    id: s.invoiceItems.id, name: s.invoiceItems.name, unitPrice: s.invoiceItems.unitPrice, quantity: s.invoiceItems.quantity,
    discountAmount: s.invoiceItems.discountAmount, percent: s.invoiceItems.producerSharePercent, fundedBy: s.invoiceItems.discountFundedBy,
  }).from(s.invoiceItems).where(and(
    eq(s.invoiceItems.invoiceId, sl.invoiceId), eq(s.invoiceItems.producerId, sl.producerId), eq(s.invoiceItems.itemType, "product"),
  )).orderBy(s.invoiceItems.sortOrder);

  const lines = items.map((it) => computeLineCredit({
    invoiceItemId: it.id, name: it.name, unitPrice: parseFloat(String(it.unitPrice)), quantity: it.quantity,
    discountAmount: parseFloat(String(it.discountAmount ?? "0")),
    percent: it.percent === null || it.percent === undefined ? null : parseFloat(String(it.percent)),
    fundedBy: (it.fundedBy ?? null) as "tenant" | "producer" | null,
  }));
  const productAmount = round2(lines.reduce((a, l) => a + l.amount, 0));
  const shippingAmount = round2(parseFloat(String(sl.cost ?? "0")));

  let blocker: ShipmentCredit["blocker"] = null;
  if (inv.status !== "paid") blocker = "belum_lunas";
  else if (lines.length === 0) blocker = "tanpa_produk";
  else if (lines.some((l) => l.percent === null)) blocker = "persentase_tidak_tercatat";

  return {
    shippingLineId: sl.id, invoiceId: sl.invoiceId, invoiceNumber: inv.number ?? null, invoiceStatus: inv.status, producerId: sl.producerId,
    lines, shippingAmount, freeShippingDiscount: round2(parseFloat(String(sl.freeDisc ?? "0"))),
    productAmount, total: round2(productAmount + shippingAmount), blocker, status: sl.status,
    shippedAt: sl.shippedAt, buyerConfirmedAt: sl.buyerConfirmedAt, completedAt: sl.completedAt,
    completionSource: (sl.completionSource ?? null) as "buyer" | "auto" | null, createdAt: sl.createdAt,
  };
}

export type CompleteResult =
  | { ok: true; already: boolean; total: number }
  | { ok: false; reason: "tidak_ditemukan" | "belum_lunas" | "persentase_tidak_tercatat" | "tanpa_produk" | "akun_belum_dikonfigurasi" };

/**
 * Selesaikan satu pengiriman produsen → buat kredit ledger. Idempoten & aman bersamaan (kunci baris + indeks unik).
 * `source` hanya mencatat asal ('buyer' bila pembeli sudah menekan konfirmasi, 'auto' = batas waktu). Tidak pernah menerima nominal dari luar.
 */
export async function completeProducerShipment(tc: TenantDb, shippingLineId: string, source: "buyer" | "auto"): Promise<CompleteResult> {
  // Pra-cek di luar transaksi (murah): tak perlu menghabiskan nomor jurnal untuk yang sudah selesai / terblokir.
  const pre = await loadShipmentCredit({ db: tc.db, schema: tc.schema }, shippingLineId);
  if (!pre) return { ok: false, reason: "tidak_ditemukan" };
  if (pre.completedAt) return { ok: true, already: true, total: pre.total };
  if (pre.blocker) return { ok: false, reason: pre.blocker };
  // Pengakuan hutang (D8): bagian produsen dipindah dari Pendapatan Toko ke Hutang Produsen. Akun/aktor tak ada → TIDAK diselesaikan (dilaporkan, tidak ditebak).
  const accts = await resolveProducerAccounts(tc.db, tc.schema);
  const actor = await systemActorUserId(tc.db, tc.schema);
  if (!accts.income || !accts.hutang || !actor) return { ok: false, reason: "akun_belum_dikonfigurasi" };
  const incomeAcc: string = accts.income, hutangAcc: string = accts.hutang, actorId: string = actor;
  const journalRef = pre.total > 0 ? await generateFinancialNumber(tc, "journal") : null;

  return tc.db.transaction(async (tx) => {
    const txl: TxLike = { db: tx as unknown as Db, schema: tc.schema };
    const s = tc.schema;
    // Kunci baris pengiriman supaya dua penyelesaian bersamaan berurutan.
    const [locked] = await tx.select({ id: s.invoiceShippingLines.id, completedAt: s.invoiceShippingLines.completedAt })
      .from(s.invoiceShippingLines).where(eq(s.invoiceShippingLines.id, shippingLineId)).for("update").limit(1);
    if (!locked) return { ok: false as const, reason: "tidak_ditemukan" as const };

    const credit = await loadShipmentCredit(txl, shippingLineId);
    if (!credit) return { ok: false as const, reason: "tidak_ditemukan" as const };
    if (locked.completedAt) return { ok: true as const, already: true, total: credit.total };
    if (credit.blocker) return { ok: false as const, reason: credit.blocker };

    const rows = [
      ...credit.lines.map((l) => ({
        producerId: credit.producerId, kind: "sale" as const, amount: l.amount.toFixed(2),
        invoiceId: credit.invoiceId, invoiceItemId: l.invoiceItemId, shippingLineId,
        meta: { name: l.name, quantity: l.quantity, base: l.base, tenantPercent: l.percent, discount: l.discount, discountFundedBy: l.fundedBy, clamped: l.clamped },
      })),
      ...(credit.shippingAmount > 0 ? [{
        producerId: credit.producerId, kind: "shipping" as const, amount: credit.shippingAmount.toFixed(2),
        invoiceId: credit.invoiceId, invoiceItemId: null, shippingLineId,
        meta: { freeShippingDiscount: credit.freeShippingDiscount },
      }] : []),
    ];
    if (rows.length > 0) {
      await tx.insert(s.producerLedgerEntries).values(rows).onConflictDoNothing();
      // ON CONFLICT tanpa target menelan pelanggaran unik APA PUN — pastikan semua baris benar-benar ada (kalau tidak, batalkan seluruh transaksi
      // agar pengiriman tidak ditandai selesai dengan kredit hilang).
      const have = await tx.select({ id: s.producerLedgerEntries.id }).from(s.producerLedgerEntries).where(eq(s.producerLedgerEntries.shippingLineId, shippingLineId));
      if (have.length < rows.length) throw new Error("ledger: baris kredit tidak lengkap setelah insert");
    }
    if (journalRef && credit.total > 0) {
      await postJournalTx(tx as unknown as Db, tc.schema, {
        date: journalDate(), referenceNumber: journalRef, createdBy: actorId,
        description: `Pengakuan hutang produsen — pengiriman ${credit.invoiceNumber ?? credit.invoiceId.slice(0, 8)} (otomatis)`,
        entries: [
          { accountId: incomeAcc, type: "debit",  amount: credit.total, note: "Bagian produsen (bukan pendapatan tenant)" },
          { accountId: hutangAcc, type: "credit", amount: credit.total, note: `Hutang produsen ${credit.producerId.slice(0, 8)}` },
        ],
      });
    }

    await tx.update(s.invoiceShippingLines).set({
      completedAt: new Date(), completionSource: source, updatedAt: new Date(),
    }).where(and(eq(s.invoiceShippingLines.id, shippingLineId), isNull(s.invoiceShippingLines.completedAt)));

    return { ok: true as const, already: false, total: credit.total };
  });
}

export const AUTO_COMPLETE_DAYS = 10;

/**
 * Sapuan harian: selesaikan pengiriman produsen yang (a) sudah dikonfirmasi pembeli tetapi kreditnya belum terbit (mis. invoice baru lunas
 * sesudahnya) atau (b) dikirim lebih dari AUTO_COMPLETE_DAYS hari lalu tanpa konfirmasi. Mengembalikan ringkasan; "perlu ditinjau"
 * (persentase tak tercatat) DILAPORKAN, tidak ditebak.
 */
export async function sweepProducerSettlements(tc: TenantDb, opts: { limit?: number; now?: Date } = {}): Promise<{
  completed: number; already: number; blocked: Record<string, number>;
}> {
  const { db, schema: s } = tc;
  const now = opts.now ?? new Date();
  const cutoff = new Date(now.getTime() - AUTO_COMPLETE_DAYS * 24 * 60 * 60 * 1000);
  // Pengiriman yang barisnya TANPA persentase tersimpan (pesanan lama sebelum snapshot bagi hasil) TIDAK dipilih: tak bisa dikreditkan otomatis dan —
  // bila ikut dipilih — mereka (terlama dulu) menghabiskan batas per jalan sehingga pengiriman valid yang lebih baru tak pernah terproses.
  // Jumlahnya tetap DILAPORKAN lewat `blocked.persentase_tidak_tercatat` (dihitung terpisah, tanpa batas).
  const noPercent = sql`EXISTS (SELECT 1 FROM ${s.invoiceItems} ii WHERE ii.invoice_id = ${s.invoiceShippingLines.invoiceId} AND ii.producer_id = ${s.invoiceShippingLines.producerId} AND ii.item_type = 'product' AND ii.producer_share_percent IS NULL)`;
  const dueCond = and(
    isNotNull(s.invoiceShippingLines.producerId), isNull(s.invoiceShippingLines.completedAt),
    or(isNotNull(s.invoiceShippingLines.buyerConfirmedAt), and(isNotNull(s.invoiceShippingLines.shippedAt), lt(s.invoiceShippingLines.shippedAt, cutoff))),
  );
  const rows = await db.select({ id: s.invoiceShippingLines.id, confirmed: s.invoiceShippingLines.buyerConfirmedAt })
    .from(s.invoiceShippingLines)
    .where(and(dueCond, sql`NOT ${noPercent}`))
    .orderBy(sql`${s.invoiceShippingLines.shippedAt} ASC NULLS LAST`)
    .limit(opts.limit ?? 200);

  const out = { completed: 0, already: 0, blocked: {} as Record<string, number> };
  const [{ n: reviewN }] = await db.select({ n: sql<number>`count(*)::int` }).from(s.invoiceShippingLines).where(and(dueCond, noPercent));
  if (Number(reviewN) > 0) out.blocked.persentase_tidak_tercatat = Number(reviewN);
  for (const r of rows) {
    const res = await completeProducerShipment(tc, r.id, r.confirmed ? "buyer" : "auto");
    if (res.ok) { if (res.already) out.already++; else out.completed++; }
    else out.blocked[res.reason] = (out.blocked[res.reason] ?? 0) + 1;
  }
  return out;
}

// ── Ringkasan saldo & daftar pengiriman untuk portal produsen ────────────────────────────────────────────────
export type ProducerBalance = { waiting: number; available: number; paid: number; reviewCount: number };

/** Ringkasan: Menunggu (lunas, belum selesai) | Bisa dicairkan (ledger available) | Sudah dicairkan (ledger paid). */
export async function getProducerBalance(tc: TxLike, producerId: string): Promise<ProducerBalance> {
  const { db, schema: s } = tc;
  const led = await db.select({ status: s.producerLedgerEntries.status, sum: sql<string>`coalesce(sum(${s.producerLedgerEntries.amount}), 0)` })
    .from(s.producerLedgerEntries).where(eq(s.producerLedgerEntries.producerId, producerId)).groupBy(s.producerLedgerEntries.status);
  const by = new Map(led.map((r) => [r.status, parseFloat(String(r.sum))]));

  const open = await listProducerShipments(tc, producerId, { onlyOpen: true, limit: 500 });
  const waiting = round2(open.filter((x) => !x.blocker || x.blocker === "persentase_tidak_tercatat").reduce((a, x) => a + x.total, 0));
  const reviewCount = open.filter((x) => x.blocker === "persentase_tidak_tercatat").length;
  return { waiting, available: round2(by.get("available") ?? 0), paid: round2(by.get("paid") ?? 0), reviewCount };
}

/** Pengiriman milik produsen (terbaru dulu). `onlyOpen` = hanya yang lunas & belum selesai. Semua dari `producerId` (sesi pemanggil). */
export async function listProducerShipments(tc: TxLike, producerId: string, opts: { onlyOpen?: boolean; limit?: number } = {}): Promise<ShipmentCredit[]> {
  const { db, schema: s } = tc;
  const conds = [eq(s.invoiceShippingLines.producerId, producerId)];
  if (opts.onlyOpen) conds.push(isNull(s.invoiceShippingLines.completedAt));
  const ids = await db.select({ id: s.invoiceShippingLines.id }).from(s.invoiceShippingLines)
    .innerJoin(s.invoices, eq(s.invoices.id, s.invoiceShippingLines.invoiceId))
    .where(and(...conds, opts.onlyOpen ? eq(s.invoices.status, "paid") : sql`true`))
    .orderBy(sql`${s.invoiceShippingLines.createdAt} DESC`).limit(opts.limit ?? 50);
  const out: ShipmentCredit[] = [];
  for (const { id } of ids) {
    const c = await loadShipmentCredit(tc, id);
    if (c && c.producerId === producerId) out.push(c);
  }
  return out;
}
