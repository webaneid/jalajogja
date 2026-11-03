/**
 * Pencairan dana produsen — rekening, pengajuan, persetujuan, pembayaran (bukti WAJIB), refund→hutang, pelunasan, tahan.
 * docs/arsitektur-pencairan-produsen.md § 13. Semua nominal DIHITUNG di sini dari ledger (producer_ledger_entries) — tidak pernah dari klien.
 * Semua perubahan ledger + jurnal terjadi dalam SATU transaksi (atomik). Pemanggil (Server Action) bertanggung jawab atas otorisasi
 * dan memberikan `producerId`/aktor dari SESI.
 */
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { TenantDb } from "../tenant-client";
import { encryptPii } from "./pii-crypto";
import { BANK_CODES, bankNameOf } from "./banks";
import { resolveProducerAccounts, postJournalTx, journalDate } from "./producer-accounting";
import { generateFinancialNumber } from "./finance";

type Db = TenantDb["db"];
type Schema = TenantDb["schema"];
type TxLike = { db: Db; schema: Schema };
const round2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown) => parseFloat(String(v ?? "0")) || 0;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const clean = (s: unknown, max: number) => String(s ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

// ── Pengaturan pencairan tenant ──────────────────────────────────────────────────────────────────────────────
export type PayoutSettings = { minAmount: number; feeSameBank: number; feeOtherBank: number; slaDays: number };
export const DEFAULT_PAYOUT_SETTINGS: PayoutSettings = { minAmount: 200_000, feeSameBank: 0, feeOtherBank: 7_500, slaDays: 3 };
export const MAX_TRANSFER_FEE = 50_000;
export const BANK_CHANGE_DELAY_HOURS = 24;
const SETTINGS_KEY = "producer_payout";

export function sanitizePayoutSettings(raw: unknown): PayoutSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const n = (v: unknown, def: number, lo: number, hi: number) => { const x = Number(v); return Number.isFinite(x) && x >= lo && x <= hi ? Math.round(x) : def; };
  return {
    minAmount:    n(r.minAmount,    DEFAULT_PAYOUT_SETTINGS.minAmount,    10_000, 10_000_000),
    feeSameBank:  n(r.feeSameBank,  DEFAULT_PAYOUT_SETTINGS.feeSameBank,  0, MAX_TRANSFER_FEE),
    feeOtherBank: n(r.feeOtherBank, DEFAULT_PAYOUT_SETTINGS.feeOtherBank, 0, MAX_TRANSFER_FEE),
    slaDays:      n(r.slaDays,      DEFAULT_PAYOUT_SETTINGS.slaDays,      1, 14),
  };
}

export async function getPayoutSettings(tc: TxLike): Promise<PayoutSettings> {
  const [row] = await tc.db.select({ value: tc.schema.settings.value }).from(tc.schema.settings)
    .where(and(eq(tc.schema.settings.key, SETTINGS_KEY), eq(tc.schema.settings.group, "payment"))).limit(1);
  return sanitizePayoutSettings(row?.value);
}

export async function savePayoutSettings(tc: TxLike, input: PayoutSettings): Promise<PayoutSettings> {
  const v = sanitizePayoutSettings(input);
  await tc.db.insert(tc.schema.settings).values({ key: SETTINGS_KEY, group: "payment", value: v })
    .onConflictDoUpdate({ target: [tc.schema.settings.key, tc.schema.settings.group], set: { value: v, updatedAt: new Date() } });
  return v;
}

/** Biaya transfer yang disarankan: sesama bank = feeSameBank, selain itu feeOtherBank (kode bank tenant tak dikenal → diperlakukan beda bank). */
export function suggestTransferFee(settings: PayoutSettings, producerBankCode: string, sourceBankCode: string | null): number {
  return sourceBankCode && sourceBankCode !== "lainnya" && sourceBankCode === producerBankCode ? settings.feeSameBank : settings.feeOtherBank;
}

// ── Rekening produsen ────────────────────────────────────────────────────────────────────────────────────────
export function validateBankInput(i: { bankCode: unknown; accountNumber: unknown; holder: unknown }):
  Result<{ bankCode: string; number: string; holder: string }> {
  const bankCode = String(i.bankCode ?? "");
  if (!BANK_CODES.has(bankCode)) return fail("Pilih bank dari daftar.");
  const number = String(i.accountNumber ?? "").replace(/[\s-]/g, "");
  if (!/^\d{5,20}$/.test(number)) return fail("Nomor rekening harus berupa angka 5–20 digit.");
  const holder = clean(i.holder, 60);
  if (holder.length < 3) return fail("Nama pemilik rekening wajib diisi (sesuai buku tabungan).");
  return { ok: true, bankCode, number, holder };
}

export type BankAccountRow = { id: string; bankCode: string; bankName: string; accountLast4: string; accountHolder: string; effectiveAt: Date };

/** Rekening AKTIF (sudah berlaku) + rekening menunggu masa jeda (bila ada). Nomor utuh tidak dikembalikan. */
export async function getBankAccounts(tc: TxLike, producerId: string, now: Date = new Date()) {
  const { db, schema: s } = tc;
  const rows = await db.select().from(s.producerBankAccounts).where(eq(s.producerBankAccounts.producerId, producerId)).orderBy(desc(s.producerBankAccounts.effectiveAt));
  const strip = (r: typeof rows[number]): BankAccountRow => ({ id: r.id, bankCode: r.bankCode, bankName: r.bankName, accountLast4: r.accountLast4, accountHolder: r.accountHolder, effectiveAt: r.effectiveAt });
  const active = rows.find((r) => r.effectiveAt <= now && (!r.replacedAt || r.replacedAt > now));
  const pending = rows.find((r) => r.effectiveAt > now);
  return { active: active ? strip(active) : null, pending: pending ? strip(pending) : null, activeFull: active ?? null };
}

/** Simpan/ganti rekening. Rekening pertama langsung berlaku; penggantian berlaku setelah BANK_CHANGE_DELAY_HOURS (anti-pembajakan). */
export async function setProducerBankAccount(tc: TenantDb, producerId: string, input: { bankCode: unknown; accountNumber: unknown; holder: unknown }, now: Date = new Date()):
  Promise<Result<{ effectiveAt: Date; immediate: boolean }>> {
  const v = validateBankInput(input);
  if (!v.ok) return v;
  const enc = encryptPii(v.number);
  if (!enc) return fail("Gagal mengamankan nomor rekening.");
  return tc.db.transaction(async (tx) => {
    const s = tc.schema;
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"prodbank:" + producerId}))`);
    const rows = await tx.select().from(s.producerBankAccounts).where(eq(s.producerBankAccounts.producerId, producerId));
    const active = rows.find((r) => r.effectiveAt <= now && (!r.replacedAt || r.replacedAt > now));
    const effectiveAt = active ? new Date(now.getTime() + BANK_CHANGE_DELAY_HOURS * 3_600_000) : now;
    // buang rekening yang masih menunggu (diganti yang terbaru)
    for (const r of rows.filter((x) => x.effectiveAt > now)) await tx.delete(s.producerBankAccounts).where(eq(s.producerBankAccounts.id, r.id));
    if (active) await tx.update(s.producerBankAccounts).set({ replacedAt: effectiveAt }).where(eq(s.producerBankAccounts.id, active.id));
    await tx.insert(s.producerBankAccounts).values({
      producerId, bankCode: v.bankCode, bankName: bankNameOf(v.bankCode), accountNumberEnc: enc, accountLast4: v.number.slice(-4), accountHolder: v.holder, effectiveAt,
    });
    return { ok: true as const, effectiveAt, immediate: !active };
  });
}

// ── Saldo yang bisa diajukan ─────────────────────────────────────────────────────────────────────────────────
export type EligibleLine = {
  shippingLineId: string | null; label: string;
  productAmount: number; shippingAmount: number; adjustmentAmount: number; total: number; entryIds: string[];
};
export type EligibleSummary = {
  creditsTotal: number; debtTotal: number; adjustmentTotal: number; subtotal: number;
  lines: EligibleLine[]; heldCount: number; heldAmount: number;
};

/** Hak yang bisa diajukan = entri ledger `available` milik produsen, TANPA pengiriman yang sedang ditahan (hutang/pelunasan selalu ikut). */
export async function computeEligible(tc: TxLike, producerId: string): Promise<EligibleSummary> {
  const { db, schema: s } = tc;
  const rows = await db.select({
    id: s.producerLedgerEntries.id, kind: s.producerLedgerEntries.kind, amount: s.producerLedgerEntries.amount,
    shippingLineId: s.producerLedgerEntries.shippingLineId, meta: s.producerLedgerEntries.meta, invoiceId: s.producerLedgerEntries.invoiceId,
    hold: s.invoiceShippingLines.payoutHoldAt, invoiceNumber: s.invoices.invoiceNumber,
  }).from(s.producerLedgerEntries)
    .leftJoin(s.invoiceShippingLines, eq(s.invoiceShippingLines.id, s.producerLedgerEntries.shippingLineId))
    .leftJoin(s.invoices, eq(s.invoices.id, s.producerLedgerEntries.invoiceId))
    .where(and(eq(s.producerLedgerEntries.producerId, producerId), eq(s.producerLedgerEntries.status, "available")))
    .orderBy(asc(s.producerLedgerEntries.createdAt));

  const ship = new Map<string, EligibleLine>();
  const adj: EligibleLine[] = [];
  let heldCount = 0, heldAmount = 0;
  const heldShips = new Set<string>();
  let credits = 0, debt = 0, adjustments = 0;
  for (const r of rows) {
    const amt = num(r.amount);
    if (r.kind === "sale" || r.kind === "shipping") {
      if (r.hold) { heldAmount += amt; if (r.shippingLineId) heldShips.add(r.shippingLineId); continue; }
      const key = r.shippingLineId ?? r.id;
      const line = ship.get(key) ?? { shippingLineId: r.shippingLineId, label: r.invoiceNumber ?? "Pesanan", productAmount: 0, shippingAmount: 0, adjustmentAmount: 0, total: 0, entryIds: [] };
      if (r.kind === "sale") line.productAmount = round2(line.productAmount + amt); else line.shippingAmount = round2(line.shippingAmount + amt);
      line.total = round2(line.total + amt); line.entryIds.push(r.id);
      ship.set(key, line); credits += amt;
    } else if (r.kind === "refund_debt" || r.kind === "adjustment") {
      const meta = (r.meta ?? {}) as Record<string, unknown>;
      const reason = clean(meta.reason ?? meta.note ?? "", 80);
      const label = r.kind === "refund_debt" ? `Potongan refund ${r.invoiceNumber ?? ""}${reason ? ` — ${reason}` : ""}`.trim() : `Pelunasan hutang${reason ? ` — ${reason}` : ""}`;
      adj.push({ shippingLineId: null, label, productAmount: 0, shippingAmount: 0, adjustmentAmount: round2(amt), total: round2(amt), entryIds: [r.id] });
      if (r.kind === "refund_debt") debt += -amt; else adjustments += amt;
    }
  }
  heldCount = heldShips.size;
  const lines = [...ship.values(), ...adj];
  return {
    creditsTotal: round2(credits), debtTotal: round2(debt), adjustmentTotal: round2(adjustments),
    subtotal: round2(credits - debt + adjustments), lines, heldCount, heldAmount: round2(heldAmount),
  };
}

// ── Pengajuan ────────────────────────────────────────────────────────────────────────────────────────────────
async function nextPayoutNumber(tx: Db, s: Schema, now: Date): Promise<string> {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('prodpayoutno'))`);
  const ym = journalDate(now).slice(0, 7).replace("-", "");
  const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(s.producerPayouts).where(sql`${s.producerPayouts.number} LIKE ${"PRC-" + ym + "-%"}`);
  return `PRC-${ym}-${String(Number(n) + 1).padStart(4, "0")}`;
}

/** Produsen mengajukan pencairan SEMUA haknya yang bisa dicairkan. Atomik; satu pengajuan aktif per produsen. */
export async function requestPayout(tc: TenantDb, producerId: string, now: Date = new Date()): Promise<Result<{ payoutId: string; number: string; subtotal: number }>> {
  const settings = await getPayoutSettings(tc);
  return tc.db.transaction(async (tx) => {
    const s = tc.schema; const txl: TxLike = { db: tx as unknown as Db, schema: s };
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"prodpayout:" + producerId}))`);
    const [prod] = await tx.select({ isActive: s.producers.isActive }).from(s.producers).where(eq(s.producers.id, producerId)).limit(1);
    if (!prod?.isActive) return fail("Akun produsen tidak aktif.");
    const [open] = await tx.select({ id: s.producerPayouts.id }).from(s.producerPayouts)
      .where(and(eq(s.producerPayouts.producerId, producerId), inArray(s.producerPayouts.status, ["requested", "approved"]))).limit(1);
    if (open) return fail("Masih ada pengajuan pencairan yang berjalan. Tunggu sampai selesai atau batalkan dulu.");

    const { activeFull } = await getBankAccounts(txl, producerId, now);
    if (!activeFull) return fail("Isi rekening tujuan dulu (rekening baru berlaku setelah masa jeda keamanan).");

    const el = await computeEligible(txl, producerId);
    if (el.subtotal < settings.minAmount) return fail(`Saldo yang bisa dicairkan Rp${Math.round(el.subtotal).toLocaleString("id-ID")} belum mencapai minimum Rp${settings.minAmount.toLocaleString("id-ID")}.`);

    const number = await nextPayoutNumber(tx as unknown as Db, s, now);
    const [p] = await tx.insert(s.producerPayouts).values({
      number, producerId, status: "requested", creditsTotal: el.creditsTotal.toFixed(2), debtTotal: el.debtTotal.toFixed(2),
      adjustmentTotal: el.adjustmentTotal.toFixed(2), subtotal: el.subtotal.toFixed(2),
      bankCode: activeFull.bankCode, bankName: activeFull.bankName, accountNumberEnc: activeFull.accountNumberEnc, accountLast4: activeFull.accountLast4, accountHolder: activeFull.accountHolder,
      requestedAt: now,
    }).returning({ id: s.producerPayouts.id });
    if (el.lines.length) await tx.insert(s.producerPayoutLines).values(el.lines.map((l, i) => ({
      payoutId: p.id, shippingLineId: l.shippingLineId, label: l.label, productAmount: l.productAmount.toFixed(2), shippingAmount: l.shippingAmount.toFixed(2),
      adjustmentAmount: l.adjustmentAmount.toFixed(2), total: l.total.toFixed(2), sortOrder: i,
    })));
    const ids = el.lines.flatMap((l) => l.entryIds);
    await tx.update(s.producerLedgerEntries).set({ status: "reserved", payoutId: p.id }).where(and(inArray(s.producerLedgerEntries.id, ids), eq(s.producerLedgerEntries.status, "available")));
    return { ok: true as const, payoutId: p.id, number, subtotal: el.subtotal };
  });
}

async function releaseEntries(tx: Db, s: Schema, payoutId: string) {
  await tx.update(s.producerLedgerEntries).set({ status: "available", payoutId: null }).where(and(eq(s.producerLedgerEntries.payoutId, payoutId), eq(s.producerLedgerEntries.status, "reserved")));
}

export async function cancelPayoutByProducer(tc: TenantDb, producerId: string, payoutId: string): Promise<Result> {
  if (!UUID_RE.test(payoutId)) return fail("Pengajuan tidak ditemukan.");
  return tc.db.transaction(async (tx) => {
    const s = tc.schema;
    const [p] = await tx.select().from(s.producerPayouts).where(and(eq(s.producerPayouts.id, payoutId), eq(s.producerPayouts.producerId, producerId))).for("update").limit(1);
    if (!p) return fail("Pengajuan tidak ditemukan.");
    if (p.status !== "requested") return fail("Pengajuan yang sudah disetujui tidak bisa dibatalkan sendiri. Hubungi bendahara.");
    await releaseEntries(tx as unknown as Db, s, payoutId);
    await tx.update(s.producerPayouts).set({ status: "cancelled", updatedAt: new Date() }).where(eq(s.producerPayouts.id, payoutId));
    return { ok: true as const };
  });
}

type Actor = { userId: string; memberId: string | null };

async function lockPayout(tx: Db, s: Schema, payoutId: string) {
  const [p] = await tx.select().from(s.producerPayouts).where(eq(s.producerPayouts.id, payoutId)).for("update").limit(1);
  if (!p) return null;
  const [prod] = await tx.select({ memberId: s.producers.memberId }).from(s.producers).where(eq(s.producers.id, p.producerId)).limit(1);
  return { p, producerMemberId: prod?.memberId ?? null };
}

export async function approvePayout(tc: TenantDb, payoutId: string, actor: Actor): Promise<Result> {
  if (!UUID_RE.test(payoutId)) return fail("Pengajuan tidak ditemukan.");
  return tc.db.transaction(async (tx) => {
    const L = await lockPayout(tx as unknown as Db, tc.schema, payoutId);
    if (!L) return fail("Pengajuan tidak ditemukan.");
    if (L.p.status !== "requested") return fail("Pengajuan ini tidak dalam status menunggu persetujuan.");
    if (actor.memberId && L.producerMemberId && actor.memberId === L.producerMemberId) return fail("Anda tidak boleh menyetujui pencairan milik Anda sendiri.");
    await tx.update(tc.schema.producerPayouts).set({ status: "approved", approvedBy: actor.userId, approvedAt: new Date(), updatedAt: new Date() }).where(eq(tc.schema.producerPayouts.id, payoutId));
    return { ok: true as const };
  });
}

export async function rejectPayout(tc: TenantDb, payoutId: string, actor: Actor, reasonRaw: unknown): Promise<Result> {
  if (!UUID_RE.test(payoutId)) return fail("Pengajuan tidak ditemukan.");
  const reason = clean(reasonRaw, 300);
  if (reason.length < 5) return fail("Alasan penolakan wajib diisi (minimal 5 karakter) — produsen akan membacanya.");
  return tc.db.transaction(async (tx) => {
    const L = await lockPayout(tx as unknown as Db, tc.schema, payoutId);
    if (!L) return fail("Pengajuan tidak ditemukan.");
    if (L.p.status !== "requested" && L.p.status !== "approved") return fail("Pengajuan ini sudah selesai diproses.");
    if (actor.memberId && L.producerMemberId && actor.memberId === L.producerMemberId) return fail("Anda tidak boleh memproses pencairan milik Anda sendiri.");
    await releaseEntries(tx as unknown as Db, tc.schema, payoutId);
    await tx.update(tc.schema.producerPayouts).set({ status: "rejected", rejectedReason: reason, approvedBy: actor.userId, updatedAt: new Date() }).where(eq(tc.schema.producerPayouts.id, payoutId));
    return { ok: true as const };
  });
}

/**
 * Catat transfer: BUKTI WAJIB (media id + url yang sudah diverifikasi pemanggil dari tabel media tenant), biaya transfer 0..MAX dan < subtotal.
 * Jurnal: Dr Hutang Produsen / Cr Kas-Bank sebesar subtotal (net ditransfer + biaya transfer yang dipotong dari produsen).
 */
export async function markPayoutPaid(tc: TenantDb, payoutId: string, actor: Actor, input: {
  transferFee: unknown; proofMediaId: unknown; proofUrl: unknown; sourceBankLabel?: unknown; note?: unknown;
}): Promise<Result<{ netAmount: number; transactionId: string }>> {
  if (!UUID_RE.test(payoutId)) return fail("Pengajuan tidak ditemukan.");
  const proofMediaId = String(input.proofMediaId ?? "");
  const proofUrl = String(input.proofUrl ?? "");
  if (!UUID_RE.test(proofMediaId) || !proofUrl) return fail("Bukti transfer wajib dilampirkan sebelum menandai pencairan dibayar.");
  const fee = round2(Number(input.transferFee ?? 0));
  if (!Number.isFinite(fee) || fee < 0 || fee > MAX_TRANSFER_FEE) return fail(`Biaya transfer harus 0 sampai Rp${MAX_TRANSFER_FEE.toLocaleString("id-ID")}.`);

  const accts = await resolveProducerAccounts(tc.db, tc.schema);
  if (!accts.hutang || !accts.cash) return fail("Akun Hutang Produsen atau Kas/Bank belum dikonfigurasi di Keuangan.");
  const hutangAcc: string = accts.hutang, cashAcc: string = accts.cash;
  const ref = await generateFinancialNumber(tc, "journal");

  return tc.db.transaction(async (tx) => {
    const s = tc.schema;
    const L = await lockPayout(tx as unknown as Db, s, payoutId);
    if (!L) return fail("Pengajuan tidak ditemukan.");
    if (L.p.status !== "approved") return fail("Setujui pengajuan terlebih dahulu sebelum mencatat transfer.");
    if (actor.memberId && L.producerMemberId && actor.memberId === L.producerMemberId) return fail("Anda tidak boleh memproses pencairan milik Anda sendiri.");
    const subtotal = num(L.p.subtotal);
    if (!(fee < subtotal)) return fail("Biaya transfer harus lebih kecil dari jumlah pencairan.");
    const net = round2(subtotal - fee);

    const entries = await tx.select({ amount: s.producerLedgerEntries.amount }).from(s.producerLedgerEntries)
      .where(and(eq(s.producerLedgerEntries.payoutId, payoutId), eq(s.producerLedgerEntries.status, "reserved")));
    const sum = round2(entries.reduce((a, e) => a + num(e.amount), 0));
    if (Math.abs(sum - subtotal) > 0.005) throw new Error(`Integritas ledger pencairan gagal: ${sum} ≠ ${subtotal}`);   // batalkan; jangan membayar angka yang tak cocok

    const txId = await postJournalTx(tx as unknown as Db, s, {
      date: journalDate(), referenceNumber: ref, createdBy: actor.userId,
      description: `Pencairan produsen ${L.p.number} — ${L.p.accountHolder} (${L.p.bankName} ••••${L.p.accountLast4})`,
      entries: [
        { accountId: hutangAcc, type: "debit",  amount: subtotal, note: "Pelunasan hutang produsen" },
        { accountId: cashAcc,   type: "credit", amount: subtotal, note: `Transfer Rp${net.toLocaleString("id-ID")} + biaya transfer dipotong Rp${fee.toLocaleString("id-ID")}` },
      ],
    });
    await tx.update(s.producerLedgerEntries).set({ status: "paid" }).where(and(eq(s.producerLedgerEntries.payoutId, payoutId), eq(s.producerLedgerEntries.status, "reserved")));
    await tx.update(s.producerPayouts).set({
      status: "paid", transferFee: fee.toFixed(2), netAmount: net.toFixed(2), paidBy: actor.userId, paidAt: new Date(), proofMediaId, proofUrl,
      sourceBankLabel: input.sourceBankLabel ? clean(input.sourceBankLabel, 120) : null, note: input.note ? clean(input.note, 300) : null,
      transactionId: txId, updatedAt: new Date(),
    }).where(eq(s.producerPayouts.id, payoutId));
    return { ok: true as const, netAmount: net, transactionId: txId };
  });
}

// ── Refund → hutang produsen, pelunasan, tahan ───────────────────────────────────────────────────────────────
/** Hutang produsen saat ini (positif = produsen berutang ke tenant): −Σ(refund_debt + pelunasan) pada entri available/reserved. */
export async function getProducerDebt(tc: TxLike, producerId: string): Promise<number> {
  const { db, schema: s } = tc;
  const [r] = await db.select({ sum: sql<string>`coalesce(sum(${s.producerLedgerEntries.amount}), 0)` }).from(s.producerLedgerEntries)
    .where(and(eq(s.producerLedgerEntries.producerId, producerId), inArray(s.producerLedgerEntries.kind, ["refund_debt", "adjustment"]), inArray(s.producerLedgerEntries.status, ["available", "reserved"])));
  return Math.max(0, round2(-num(r.sum)));
}

/** Catat refund pesanan yang dibebankan ke produsen (nominal ≤ yang pernah dikreditkan dikurangi refund sebelumnya). Menjadi potongan pencairan berikutnya. */
export async function recordProducerRefund(tc: TenantDb, input: { shippingLineId: string; amount: unknown; reason: unknown; actorUserId: string }): Promise<Result<{ amount: number }>> {
  if (!UUID_RE.test(input.shippingLineId)) return fail("Pengiriman tidak ditemukan.");
  const amount = round2(Number(input.amount));
  if (!(amount > 0)) return fail("Nominal refund harus lebih dari 0.");
  const reason = clean(input.reason, 200);
  if (reason.length < 5) return fail("Alasan refund wajib diisi (minimal 5 karakter).");
  const accts = await resolveProducerAccounts(tc.db, tc.schema);
  if (!accts.income || !accts.hutang) return fail("Akun Pendapatan Toko / Hutang Produsen belum dikonfigurasi.");
  const incomeAcc: string = accts.income, hutangAcc: string = accts.hutang;
  const ref = await generateFinancialNumber(tc, "journal");

  return tc.db.transaction(async (tx) => {
    const s = tc.schema;
    const [sl] = await tx.select({ id: s.invoiceShippingLines.id, producerId: s.invoiceShippingLines.producerId, invoiceId: s.invoiceShippingLines.invoiceId, completedAt: s.invoiceShippingLines.completedAt })
      .from(s.invoiceShippingLines).where(eq(s.invoiceShippingLines.id, input.shippingLineId)).for("update").limit(1);
    if (!sl?.producerId) return fail("Pengiriman produsen tidak ditemukan.");
    if (!sl.completedAt) return fail("Pengiriman ini belum selesai (belum ada kredit untuk produsen), jadi tidak ada yang perlu dipotong.");
    const [cr] = await tx.select({ sum: sql<string>`coalesce(sum(${s.producerLedgerEntries.amount}), 0)` }).from(s.producerLedgerEntries)
      .where(and(eq(s.producerLedgerEntries.shippingLineId, sl.id), inArray(s.producerLedgerEntries.kind, ["sale", "shipping"])));
    const [rf] = await tx.select({ sum: sql<string>`coalesce(sum(${s.producerLedgerEntries.amount}), 0)` }).from(s.producerLedgerEntries)
      .where(and(eq(s.producerLedgerEntries.kind, "refund_debt"), sql`${s.producerLedgerEntries.meta}->>'shippingLineId' = ${sl.id}`));
    const remaining = round2(num(cr.sum) + num(rf.sum));   // refund tersimpan negatif
    if (amount > remaining + 0.005) return fail(`Nominal melebihi sisa hak produsen pada pengiriman ini (Rp${remaining.toLocaleString("id-ID")}).`);

    await tx.insert(s.producerLedgerEntries).values({
      producerId: sl.producerId, kind: "refund_debt", amount: (-amount).toFixed(2), invoiceId: sl.invoiceId, status: "available",
      meta: { shippingLineId: sl.id, reason, by: input.actorUserId },
    });
    await postJournalTx(tx as unknown as Db, s, {
      date: journalDate(), referenceNumber: ref, createdBy: input.actorUserId,
      description: `Refund dibebankan ke produsen — ${reason}`,
      entries: [
        { accountId: hutangAcc, type: "debit",  amount, note: "Hutang produsen berkurang (refund)" },
        { accountId: incomeAcc, type: "credit", amount, note: "Pembalikan bagian produsen" },
      ],
    });
    return { ok: true as const, amount };
  });
}

/** Produsen melunasi hutang dengan mentransfer ke tenant (opsi D7b). Bukti WAJIB. */
export async function recordDebtRepayment(tc: TenantDb, input: { producerId: string; amount: unknown; proofMediaId: unknown; proofUrl: unknown; note?: unknown; actorUserId: string }): Promise<Result<{ amount: number }>> {
  const amount = round2(Number(input.amount));
  if (!(amount > 0)) return fail("Nominal pelunasan harus lebih dari 0.");
  if (!UUID_RE.test(String(input.proofMediaId ?? "")) || !input.proofUrl) return fail("Bukti transfer pelunasan wajib dilampirkan.");
  const accts = await resolveProducerAccounts(tc.db, tc.schema);
  if (!accts.hutang || !accts.cash) return fail("Akun Hutang Produsen atau Kas/Bank belum dikonfigurasi.");
  const hutangAcc: string = accts.hutang, cashAcc: string = accts.cash;
  const ref = await generateFinancialNumber(tc, "journal");
  return tc.db.transaction(async (tx) => {
    const s = tc.schema; const txl: TxLike = { db: tx as unknown as Db, schema: s };
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"prodpayout:" + input.producerId}))`);
    const debt = await getProducerDebt(txl, input.producerId);
    if (amount > debt + 0.005) return fail(`Nominal melebihi hutang produsen saat ini (Rp${debt.toLocaleString("id-ID")}).`);
    await tx.insert(s.producerLedgerEntries).values({
      producerId: input.producerId, kind: "adjustment", amount: amount.toFixed(2), status: "available",
      meta: { note: input.note ? clean(input.note, 200) : "transfer dari produsen", proofMediaId: String(input.proofMediaId), proofUrl: String(input.proofUrl), by: input.actorUserId },
    });
    await postJournalTx(tx as unknown as Db, s, {
      date: journalDate(), referenceNumber: ref, createdBy: input.actorUserId,
      description: "Pelunasan hutang refund oleh produsen (transfer)",
      entries: [
        { accountId: cashAcc,   type: "debit",  amount, note: "Transfer masuk dari produsen" },
        { accountId: hutangAcc, type: "credit", amount, note: "Hutang produsen pulih" },
      ],
    });
    return { ok: true as const, amount };
  });
}

/** Tahan / lepas tahan pencairan satu pengiriman (sengketa, dugaan resi palsu). reason kosong = lepas. Tak bisa menahan yang sudah masuk pengajuan. */
export async function setShipmentHold(tc: TenantDb, shippingLineId: string, actorUserId: string, reasonRaw: unknown): Promise<Result> {
  if (!UUID_RE.test(shippingLineId)) return fail("Pengiriman tidak ditemukan.");
  const reason = clean(reasonRaw, 300);
  return tc.db.transaction(async (tx) => {
    const s = tc.schema;
    const [sl] = await tx.select({ id: s.invoiceShippingLines.id, producerId: s.invoiceShippingLines.producerId }).from(s.invoiceShippingLines)
      .where(eq(s.invoiceShippingLines.id, shippingLineId)).for("update").limit(1);
    if (!sl?.producerId) return fail("Pengiriman produsen tidak ditemukan.");
    if (reason) {
      if (reason.length < 5) return fail("Alasan tahan wajib diisi (minimal 5 karakter).");
      const [res] = await tx.select({ id: s.producerLedgerEntries.id }).from(s.producerLedgerEntries)
        .where(and(eq(s.producerLedgerEntries.shippingLineId, shippingLineId), inArray(s.producerLedgerEntries.status, ["reserved", "paid"]))).limit(1);
      if (res) return fail("Pengiriman ini sudah masuk pengajuan/pencairan, tidak bisa ditahan. Gunakan refund bila perlu.");
      await tx.update(s.invoiceShippingLines).set({ payoutHoldAt: new Date(), payoutHoldReason: reason, payoutHoldBy: actorUserId, updatedAt: new Date() }).where(eq(s.invoiceShippingLines.id, shippingLineId));
    } else {
      await tx.update(s.invoiceShippingLines).set({ payoutHoldAt: null, payoutHoldReason: null, payoutHoldBy: null, updatedAt: new Date() }).where(eq(s.invoiceShippingLines.id, shippingLineId));
    }
    return { ok: true as const };
  });
}

// ── Pembacaan ────────────────────────────────────────────────────────────────────────────────────────────────
export async function listPayouts(tc: TxLike, opts: { producerId?: string; statuses?: string[]; limit?: number } = {}) {
  const { db, schema: s } = tc;
  const conds = [];
  if (opts.producerId) conds.push(eq(s.producerPayouts.producerId, opts.producerId));
  if (opts.statuses?.length) conds.push(inArray(s.producerPayouts.status, opts.statuses as never[]));
  return db.select().from(s.producerPayouts).where(conds.length ? and(...conds) : undefined).orderBy(desc(s.producerPayouts.requestedAt)).limit(opts.limit ?? 100);
}

export async function getPayoutWithLines(tc: TxLike, payoutId: string, producerId?: string) {
  const { db, schema: s } = tc;
  if (!UUID_RE.test(payoutId)) return null;
  const [p] = await db.select().from(s.producerPayouts).where(producerId ? and(eq(s.producerPayouts.id, payoutId), eq(s.producerPayouts.producerId, producerId)) : eq(s.producerPayouts.id, payoutId)).limit(1);
  if (!p) return null;
  const lines = await db.select().from(s.producerPayoutLines).where(eq(s.producerPayoutLines.payoutId, p.id)).orderBy(asc(s.producerPayoutLines.sortOrder));
  return { payout: p, lines };
}

/** Pengiriman milik produsen yang sudah selesai + status tahan/cair — bahan halaman admin "Pengiriman produsen". */
export async function listHeldShipments(tc: TxLike) {
  const { db, schema: s } = tc;
  return db.select({ id: s.invoiceShippingLines.id, producerId: s.invoiceShippingLines.producerId, reason: s.invoiceShippingLines.payoutHoldReason, at: s.invoiceShippingLines.payoutHoldAt, invoiceNumber: s.invoices.invoiceNumber })
    .from(s.invoiceShippingLines).innerJoin(s.invoices, eq(s.invoices.id, s.invoiceShippingLines.invoiceId)).where(sql`${s.invoiceShippingLines.payoutHoldAt} IS NOT NULL`).orderBy(desc(s.invoiceShippingLines.payoutHoldAt)).limit(100);
}

