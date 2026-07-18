/**
 * billing.ts — Helper shared untuk integrasi invoice di seluruh modul.
 *
 * Dipanggil dari toko/actions, donasi/actions, event/actions saat record baru dibuat
 * agar setiap transaksi punya invoice universalnya.
 *
 * Tidak memanggil server actions — murni query DB sehingga aman di-import dari
 * file "use server" manapun tanpa circular dependency.
 */

import { eq, and, sql, inArray, type ExtractTablesWithRelations } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import { generateFinancialNumber } from "./finance";
import { getSettings } from "./settings";
import { getTenantTimezone, anchorTodayUtc } from "./tenant-timezone";
import type { TenantDb } from "../tenant-client";
import type { InvoiceSourceType } from "../schema/tenant/billing";

// Tipe transaction callback param dari TenantDb["db"].transaction(async (tx) => ...) —
// `tx` (PgTransaction) TIDAK structurally assignable ke TenantDb["db"] penuh (beda `$client`
// requirement), jadi helper yang menerima `tx` dari transaction existing WAJIB pakai tipe ini,
// bukan TenantDb["db"].
type TenantTx = PgTransaction<
  PostgresJsQueryResultHKT,
  Record<string, unknown>,
  ExtractTablesWithRelations<Record<string, unknown>>
>;

// ─── Types ────────────────────────────────────────────────────────────────────

export type LinkedInvoiceItem = {
  itemType:    "product" | "ticket" | "donation" | "custom";
  itemId?:     string | null;
  name:        string;
  description?: string | null;
  unitPrice:   number;
  quantity:    number;
};

export type CreateLinkedInvoiceInput = {
  sourceType:    InvoiceSourceType;
  sourceId:      string;
  customerName:  string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  memberId?:     string | null;
  items:         LinkedInvoiceItem[];
  discount?:     number;
  dueDate?:      string;  // YYYY-MM-DD, default +3 hari
  notes?:        string | null;
  createdBy?:    string | null;
  installmentPlanId?: string | null;  // program cicilan — lihat docs/arsitektur-billing.md
};

// ─── generateUniqueCode ───────────────────────────────────────────────────────
// Cari kode Rp 100–999 yang belum dipakai oleh invoice pending/partial/waiting.
// Return 0 jika semua kode terpakai (sangat jarang) atau fitur mati.

export async function generateUniqueCode(tenantDb: TenantDb): Promise<number> {
  const { db, schema } = tenantDb;

  const usedRows = await db
    .select({ code: schema.invoices.uniqueCode })
    .from(schema.invoices)
    .where(
      and(
        sql`${schema.invoices.uniqueCode} > 0`,
        inArray(schema.invoices.status, ["pending", "partial", "waiting_verification"])
      )
    );

  const usedCodes = new Set(usedRows.map((r) => r.code));
  const available: number[] = [];
  for (let i = 100; i <= 999; i++) {
    if (!usedCodes.has(i)) available.push(i);
  }
  if (available.length === 0) return 0;
  return available[Math.floor(Math.random() * available.length)];
}

// ─── generateInstallmentScheduleCode ─────────────────────────────────────────
// Sama pola dengan generateUniqueCode(), tapi namespace TERPISAH: cek keunikan
// terhadap installment_schedules.unique_code (bukan invoices.unique_code) —
// dua tabel beda kolom, satu code bisa dipakai bersamaan di keduanya tanpa konflik
// karena maknanya beda (invoice = sekali bayar lunas, termin = per transfer cicilan).

// `extraExclude` — kode yang sudah dipilih dalam batch yang sama (belum ter-INSERT ke DB
// saat fungsi ini dipanggil lagi untuk termin berikutnya) — WAJIB diisi saat generate
// banyak kode sekaligus dalam satu loop (lihat convertInvoiceToInstallmentAction), kalau
// tidak dua termin dalam invoice yang sama bisa dapat kode identik.

export async function generateInstallmentScheduleCode(
  tenantDb: TenantDb,
  extraExclude?: Set<number>,
): Promise<number> {
  const { db, schema } = tenantDb;

  const usedRows = await db
    .select({ code: schema.installmentSchedules.uniqueCode })
    .from(schema.installmentSchedules)
    .where(
      and(
        sql`${schema.installmentSchedules.uniqueCode} IS NOT NULL`,
        eq(schema.installmentSchedules.status, "pending")
      )
    );

  const usedCodes = new Set(usedRows.map((r) => r.code));
  if (extraExclude) for (const c of extraExclude) usedCodes.add(c);

  const available: number[] = [];
  for (let i = 100; i <= 999; i++) {
    if (!usedCodes.has(i)) available.push(i);
  }
  if (available.length === 0) return 0;
  return available[Math.floor(Math.random() * available.length)];
}

// ─── settleInstallmentSchedules ───────────────────────────────────────────────
// Waterfall FIFO: tandai installment_schedules lunas berurutan (termin 1, 2, dst)
// sejauh newPaidAmount kumulatif mencukupi. Customer TIDAK memilih termin mana yang
// dibayar — pembayaran otomatis mengalir ke termin tertua dulu. Dipanggil dari 3 tempat:
// confirmInvoicePaymentAction, verifySubmittedPaymentAction (setelah paid_amount invoice
// di-update), dan convertInvoiceToInstallmentAction (setelah jadwal termin baru dibuat,
// untuk auto-lunas-kan termin awal kalau invoice sudah pernah dibayar sebagian sebelum
// dikonversi). `tx` HARUS transaction object yang sedang mengunci baris invoice terkait
// (FOR UPDATE) — fungsi ini tidak membuka transaction sendiri.
//
// paymentId nullable: saat dipanggil dari convertInvoiceToInstallmentAction, termin yang
// auto-lunas dari histori pembayaran SEBELUM konversi tidak punya satu payment spesifik
// yang bisa diatribusikan per termin — dibiarkan null (approksimasi yang disengaja).

export async function settleInstallmentSchedules(
  tx: TenantTx,
  schema: TenantDb["schema"],
  invoiceId: string,
  newPaidAmount: number,
  paymentId: string | null,
): Promise<void> {
  const schedules = await tx
    .select()
    .from(schema.installmentSchedules)
    .where(eq(schema.installmentSchedules.invoiceId, invoiceId))
    .orderBy(schema.installmentSchedules.termNumber);

  let cumulative = 0;
  for (const sch of schedules) {
    cumulative += parseFloat(String(sch.amount));
    if (sch.status === "paid") continue;
    if (newPaidAmount + 0.01 < cumulative) break; // belum cukup untuk termin ini
    await tx.update(schema.installmentSchedules)
      .set({ status: "paid", paymentId, paidAt: new Date() })
      .where(eq(schema.installmentSchedules.id, sch.id));
  }
}

// ─── findEligibleInstallmentPlan ──────────────────────────────────────────────
// Cek apakah sebuah invoice bisa diubah jadi cicilan: belum installmentPlanId, belum
// lunas/dibatalkan, dan salah satu item tiketnya cocok dengan program cicilan aktif+
// published (installment_plans.sourceType='event', sourceId=eventTickets.id). Dipakai
// untuk render prompt "Ubah jadi Cicilan" di halaman invoice publik, DAN dipanggil lagi
// di dalam transaction saat konversi sungguhan terjadi (jangan cuma percaya hasil di sini).

export type EligibleInstallmentPlan = {
  id:               string;
  name:             string;
  installmentCount: number;
  intervalDays:     number;
};

export async function findEligibleInstallmentPlan(
  tenantDb: TenantDb,
  invoiceId: string,
): Promise<EligibleInstallmentPlan | null> {
  const { db, schema } = tenantDb;

  const [inv] = await db
    .select({
      status:             schema.invoices.status,
      installmentPlanId:  schema.invoices.installmentPlanId,
    })
    .from(schema.invoices)
    .where(eq(schema.invoices.id, invoiceId))
    .limit(1);

  if (!inv) return null;
  if (inv.installmentPlanId) return null; // sudah cicilan
  if (inv.status === "paid" || inv.status === "cancelled") return null;

  const ticketItems = await db
    .select({ itemId: schema.invoiceItems.itemId })
    .from(schema.invoiceItems)
    .where(
      and(
        eq(schema.invoiceItems.invoiceId, invoiceId),
        eq(schema.invoiceItems.itemType, "ticket")
      )
    );

  const ticketIds = ticketItems.map((i) => i.itemId).filter((id): id is string => !!id);
  if (ticketIds.length === 0) return null;

  const [plan] = await db
    .select()
    .from(schema.installmentPlans)
    .where(
      and(
        eq(schema.installmentPlans.sourceType, "event"),
        inArray(schema.installmentPlans.sourceId, ticketIds),
        eq(schema.installmentPlans.isActive, true),
        eq(schema.installmentPlans.isPublished, true)
      )
    )
    .limit(1);

  if (!plan) return null;
  return {
    id:               plan.id,
    name:             plan.name,
    installmentCount: plan.installmentCount,
    intervalDays:     plan.intervalDays,
  };
}

// ─── createLinkedInvoice ──────────────────────────────────────────────────────
// Buat invoice + invoice_items untuk record dari modul mana saja.
// Dipanggil setelah order/donation/registration berhasil disimpan.

export async function createLinkedInvoice(
  tenantDb: TenantDb,
  input: CreateLinkedInvoiceInput
): Promise<{ invoiceId: string; invoiceNumber: string; uniqueCode: number }> {
  const { db, schema } = tenantDb;

  const invoiceNumber = await generateFinancialNumber(tenantDb, "invoice");

  const subtotal = input.items.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
  const discount = input.discount ?? 0;
  const total    = Math.max(0, subtotal - discount);

  // Anchor ke kalender timezone tenant, bukan UTC mentah — lihat helpers/tenant-timezone.ts.
  let dueDate = input.dueDate;
  if (!dueDate) {
    const tenantTimezone = await getTenantTimezone(tenantDb);
    const d = anchorTodayUtc(tenantTimezone);
    d.setUTCDate(d.getUTCDate() + 3);
    dueDate = d.toISOString().slice(0, 10);
  }

  // Kode unik: cek setting lalu generate jika aktif
  const paymentSettings = await getSettings(tenantDb, "payment");
  const uniqueCodeEnabled = paymentSettings["unique_code_enabled"] === true;
  const uniqueCode = uniqueCodeEnabled ? await generateUniqueCode(tenantDb) : 0;

  const [invoice] = await db
    .insert(schema.invoices)
    .values({
      invoiceNumber,
      sourceType:    input.sourceType,
      sourceId:      input.sourceId,
      customerName:  input.customerName.trim(),
      customerPhone: input.customerPhone?.trim() ?? null,
      customerEmail: input.customerEmail?.trim() ?? null,
      memberId:      input.memberId ?? null,
      subtotal:      subtotal.toFixed(2),
      discount:      discount.toFixed(2),
      total:         total.toFixed(2),
      paidAmount:    "0",
      uniqueCode,
      status:        "pending",
      dueDate,
      notes:         input.notes?.trim() ?? null,
      createdBy:     input.createdBy ?? null,
      installmentPlanId: input.installmentPlanId ?? null,
    })
    .returning({ id: schema.invoices.id });

  if (input.items.length > 0) {
    await db.insert(schema.invoiceItems).values(
      input.items.map((item, i) => ({
        invoiceId:   invoice.id,
        itemType:    item.itemType,
        itemId:      item.itemId ?? null,
        name:        item.name.trim(),
        description: item.description?.trim() ?? null,
        unitPrice:   item.unitPrice.toFixed(2),
        quantity:    item.quantity,
        total:       (item.unitPrice * item.quantity).toFixed(2),
        sortOrder:   i,
      }))
    );
  }

  return { invoiceId: invoice.id, invoiceNumber, uniqueCode };
}

// ─── syncInvoicePayment ───────────────────────────────────────────────────────
// Dipanggil setelah konfirmasi pembayaran di modul (toko/donasi/event).
// Cari invoice berdasarkan sourceType+sourceId, lalu update paid_amount dan status.
// Jika tidak ada invoice linked → no-op (aman).

export async function syncInvoicePayment(
  tenantDb: TenantDb,
  opts: {
    sourceType: string;
    sourceId:   string;
    paymentId:  string;
    amount:     number;
  }
): Promise<void> {
  const { db, schema } = tenantDb;

  const [inv] = await db
    .select({
      id:         schema.invoices.id,
      total:      schema.invoices.total,
      paidAmount: schema.invoices.paidAmount,
      status:     schema.invoices.status,
    })
    .from(schema.invoices)
    .where(and(
      eq(schema.invoices.sourceType, opts.sourceType as InvoiceSourceType),
      eq(schema.invoices.sourceId,   opts.sourceId)
    ))
    .limit(1);

  if (!inv || inv.status === "paid" || inv.status === "cancelled") return;

  const total         = parseFloat(String(inv.total));
  const prevPaid      = parseFloat(String(inv.paidAmount));
  const newPaidAmount = Math.min(total, prevPaid + opts.amount);
  const newStatus     = newPaidAmount >= total ? "paid" : "partial";

  await db.transaction(async (tx) => {
    // Link payment ke invoice jika belum
    const existing = await tx
      .select({ id: schema.invoicePayments.id })
      .from(schema.invoicePayments)
      .where(and(
        eq(schema.invoicePayments.invoiceId,  inv.id),
        eq(schema.invoicePayments.paymentId,  opts.paymentId)
      ))
      .limit(1);

    if (!existing.length) {
      await tx.insert(schema.invoicePayments).values({
        invoiceId:  inv.id,
        paymentId:  opts.paymentId,
        amount:     opts.amount.toFixed(2),
      });
    }

    await tx
      .update(schema.invoices)
      .set({
        paidAmount: newPaidAmount.toFixed(2),
        status:     newStatus,
        updatedAt:  new Date(),
      })
      .where(eq(schema.invoices.id, inv.id));
  });
}
