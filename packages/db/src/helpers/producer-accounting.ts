/**
 * Pencatatan keuangan pencairan produsen (docs/arsitektur-pencairan-produsen.md § 13.2). Semua jurnal ditulis DALAM transaksi pemanggil
 * (atomik dengan perubahan ledger) — tidak memakai recordJournal yang membuka transaksi sendiri.
 *
 *   Pengiriman selesai : Dr Pendapatan Toko / Cr Hutang Produsen   (bagian produsen BUKAN milik tenant — D8)
 *   Refund dibebankan  : Dr Hutang Produsen / Cr Pendapatan Toko   (hutang refund produsen)
 *   Pelunasan hutang   : Dr Kas/Bank / Cr Hutang Produsen          (produsen mentransfer balik)
 *   Pencairan dibayar  : Dr Hutang Produsen / Cr Kas/Bank          (jumlah = subtotal; biaya transfer dipotong dari produsen, bukan beban tenant)
 */
import { and, asc, eq } from "drizzle-orm";
import type { TenantDb } from "../tenant-client";

type Db = TenantDb["db"];
type Schema = TenantDb["schema"];

export type ProducerAccounts = { income: string | null; hutang: string | null; cash: string | null };

async function byCode(db: Db, s: Schema, code: string): Promise<string | null> {
  const [r] = await db.select({ id: s.accounts.id }).from(s.accounts).where(and(eq(s.accounts.code, code), eq(s.accounts.isActive, true))).limit(1);
  return r?.id ?? null;
}

/** Akun untuk jurnal produsen: dari mapping Keuangan (settings keuangan/account_mappings) bila ada, kalau tidak dicari menurut kode default. */
export async function resolveProducerAccounts(db: Db, s: Schema): Promise<ProducerAccounts> {
  const [row] = await db.select({ value: s.settings.value }).from(s.settings)
    .where(and(eq(s.settings.key, "account_mappings"), eq(s.settings.group, "keuangan"))).limit(1);
  const m = (row?.value && typeof row.value === "object" ? row.value : {}) as Record<string, string | null | undefined>;
  const income = m.income_toko ?? m.income_manual ?? (await byCode(db, s, "4300")) ?? (await byCode(db, s, "4100"));
  const hutang = m.hutang_produsen ?? (await byCode(db, s, "2300"));
  const cash   = m.bank_default ?? m.cash_default ?? (await byCode(db, s, "1102")) ?? (await byCode(db, s, "1101"));
  return { income: income ?? null, hutang: hutang ?? null, cash: cash ?? null };
}

/** Pengguna tenant yang dipakai sebagai pembuat jurnal OTOMATIS (pembeli/cron tidak punya pengguna dashboard): pemilik tertua. */
export async function systemActorUserId(db: Db, s: Schema): Promise<string | null> {
  const [o] = await db.select({ id: s.users.id }).from(s.users).where(eq(s.users.role, "owner")).orderBy(asc(s.users.createdAt)).limit(1);
  if (o) return o.id;
  const [any] = await db.select({ id: s.users.id }).from(s.users).orderBy(asc(s.users.createdAt)).limit(1);
  return any?.id ?? null;
}

export type JournalInput = {
  date: string; description: string; referenceNumber: string; createdBy: string;
  entries: { accountId: string; type: "debit" | "credit"; amount: number; note?: string }[];
};

/** Tulis jurnal berimbang di dalam transaksi `tx`. Melempar bila tidak berimbang / nominal tidak valid. */
export async function postJournalTx(tx: Db, s: Schema, input: JournalInput): Promise<string> {
  const deb = input.entries.filter((e) => e.type === "debit").reduce((a, e) => a + e.amount, 0);
  const cre = input.entries.filter((e) => e.type === "credit").reduce((a, e) => a + e.amount, 0);
  if (!(deb > 0) || Math.abs(deb - cre) > 0.001 || input.entries.some((e) => !(e.amount > 0))) throw new Error(`Jurnal tidak valid: debit ${deb} ≠ kredit ${cre}`);
  const [t] = await tx.insert(s.transactions).values({
    date: input.date, description: input.description, referenceNumber: input.referenceNumber, createdBy: input.createdBy,
  }).returning({ id: s.transactions.id });
  await tx.insert(s.transactionEntries).values(input.entries.map((e) => ({
    transactionId: t.id, accountId: e.accountId, type: e.type, amount: e.amount.toFixed(2), note: e.note,
  })));
  return t.id;
}

/** Tanggal jurnal (YYYY-MM-DD, zona Asia/Jakarta). */
export const journalDate = (d: Date = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(d);
