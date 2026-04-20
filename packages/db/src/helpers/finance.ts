import { eq, sql } from "drizzle-orm";
import type { TenantDb } from "../tenant-client";

type JournalEntry = {
  accountId: string;
  type: "debit" | "credit";
  amount: number;
  note?: string;
};

type BaseTransactionInput = {
  date: string;        // format: YYYY-MM-DD
  description: string;
  referenceNumber?: string;
  createdBy: string;   // tenant user id
};

// Escape hatch untuk transaksi kompleks dengan banyak entry
export async function recordJournal(
  { db, schema }: TenantDb,
  input: BaseTransactionInput & { entries: JournalEntry[] }
) {
  const { entries, ...txData } = input;

  // Validasi: total debit harus = total kredit
  const totalDebit = entries
    .filter((e) => e.type === "debit")
    .reduce((sum, e) => sum + e.amount, 0);
  const totalCredit = entries
    .filter((e) => e.type === "credit")
    .reduce((sum, e) => sum + e.amount, 0);

  if (Math.abs(totalDebit - totalCredit) > 0.001) {
    throw new Error(
      `Journal tidak balance: debit ${totalDebit} ≠ kredit ${totalCredit}`
    );
  }

  return await db.transaction(async (tx) => {
    const [transaction] = await tx
      .insert(schema.transactions)
      .values(txData)
      .returning();

    await tx.insert(schema.transactionEntries).values(
      entries.map((e) => ({
        transactionId: transaction.id,
        accountId: e.accountId,
        type: e.type,
        amount: e.amount.toFixed(2), // number → string untuk numeric column
        note: e.note,
      }))
    );

    return transaction;
  });
}

// Catat pengeluaran kas/bank
// Otomatis: debit akun beban, kredit akun kas
export async function recordExpense(
  tenantDb: TenantDb,
  input: BaseTransactionInput & {
    amount: number;
    expenseAccountId: string; // akun beban yang didebit
    cashAccountId: string;    // akun kas/bank yang dikredit
  }
) {
  const { amount, expenseAccountId, cashAccountId, ...txData } = input;
  return recordJournal(tenantDb, {
    ...txData,
    entries: [
      { accountId: expenseAccountId, type: "debit", amount },
      { accountId: cashAccountId, type: "credit", amount },
    ],
  });
}

// Catat penerimaan kas/bank
// Otomatis: debit akun kas, kredit akun pendapatan
export async function recordIncome(
  tenantDb: TenantDb,
  input: BaseTransactionInput & {
    amount: number;
    cashAccountId: string;    // akun kas/bank yang didebit
    incomeAccountId: string;  // akun pendapatan yang dikredit
  }
) {
  const { amount, cashAccountId, incomeAccountId, ...txData } = input;
  return recordJournal(tenantDb, {
    ...txData,
    entries: [
      { accountId: cashAccountId, type: "debit", amount },
      { accountId: incomeAccountId, type: "credit", amount },
    ],
  });
}

// Catat transfer antar akun kas/bank
// Otomatis: debit akun tujuan, kredit akun asal
export async function recordTransfer(
  tenantDb: TenantDb,
  input: BaseTransactionInput & {
    amount: number;
    fromAccountId: string; // akun asal yang dikredit
    toAccountId: string;   // akun tujuan yang didebit
  }
) {
  const { amount, fromAccountId, toAccountId, ...txData } = input;
  return recordJournal(tenantDb, {
    ...txData,
    entries: [
      { accountId: toAccountId, type: "debit", amount },
      { accountId: fromAccountId, type: "credit", amount },
    ],
  });
}

// ─── Generate Nomor Dokumen Keuangan ──────────────────────────────────────────
// Format: 620-PAY-YYYYMM-NNNNN | 620-DIS-YYYYMM-NNNNN | 620-JNL-YYYYMM-NNNNN
// "620" adalah prefix rahasia jalajogja — jangan diubah
// Atomic increment via SELECT FOR UPDATE — aman untuk concurrent requests

const DOC_TYPE_PREFIX: Record<string, string> = {
  payment:      "PAY",
  disbursement: "DIS",
  journal:      "JNL",
  invoice:      "INV",
};

export async function generateFinancialNumber(
  { db, schema }: TenantDb,
  type: "payment" | "disbursement" | "journal" | "invoice",
  now: Date = new Date()
): Promise<string> {
  const year  = now.getFullYear();
  const month = now.getMonth() + 1; // 1-indexed
  const prefix = DOC_TYPE_PREFIX[type];
  const yyyymm = `${year}${String(month).padStart(2, "0")}`;

  const nextNumber = await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(schema.financialSequences)
      .where(
        sql`${schema.financialSequences.year}  = ${year}
        AND ${schema.financialSequences.month} = ${month}
        AND ${schema.financialSequences.type}  = ${type}
        FOR UPDATE`
      );

    if (rows.length === 0) {
      await tx.insert(schema.financialSequences).values({
        year:       year  as unknown as number,
        month:      month as unknown as number,
        type,
        lastNumber: 1,
      });
      return 1;
    }

    const next = rows[0].lastNumber + 1;
    await tx
      .update(schema.financialSequences)
      .set({ lastNumber: next, updatedAt: new Date() })
      .where(eq(schema.financialSequences.id, rows[0].id));
    return next;
  });

  return `620-${prefix}-${yyyymm}-${String(nextNumber).padStart(5, "0")}`;
}

const ROMAN_MONTHS = [
  "I","II","III","IV","V","VI",
  "VII","VIII","IX","X","XI","XII",
];

// Ambil nomor surat berikutnya — atomic increment dengan SELECT FOR UPDATE
// Menghindari race condition saat dua user buat surat bersamaan
export async function getNextLetterNumber(
  { db, schema }: TenantDb,
  input: {
    year: number;
    month: number; // 1-12, bukan 0-indexed
    type: "incoming" | "outgoing" | "internal";
    category?: string;
  }
): Promise<{ number: number; formatted: string }> {
  const category = input.category ?? "UMUM";
  const monthIndex = input.month - 1; // konversi 1-12 ke 0-indexed untuk array

  return await db.transaction(async (tx) => {
    // Lock baris untuk atomic increment
    const rows = await tx
      .select()
      .from(schema.letterNumberSequences)
      .where(
        sql`${schema.letterNumberSequences.year} = ${input.year}
          AND ${schema.letterNumberSequences.type} = ${input.type}
          AND ${schema.letterNumberSequences.category} = ${category}
          FOR UPDATE`
      );

    if (rows.length === 0) {
      // Buat sequence baru mulai dari 1
      await tx.insert(schema.letterNumberSequences).values({
        year: input.year,
        type: input.type,
        category,
        lastNumber: 1,
      });
      return {
        number: 1,
        formatted: `001/${category}/${ROMAN_MONTHS[monthIndex]}/${input.year}`,
      };
    }

    const nextNumber = rows[0].lastNumber + 1;
    await tx
      .update(schema.letterNumberSequences)
      .set({ lastNumber: nextNumber })
      .where(eq(schema.letterNumberSequences.id, rows[0].id));

    return {
      number: nextNumber,
      formatted: `${String(nextNumber).padStart(3, "0")}/${category}/${ROMAN_MONTHS[monthIndex]}/${input.year}`,
    };
  });
}
