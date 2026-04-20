/**
 * billing.ts — Helper shared untuk integrasi invoice di seluruh modul.
 *
 * Dipanggil dari toko/actions, donasi/actions, event/actions saat record baru dibuat
 * agar setiap transaksi punya invoice universalnya.
 *
 * Tidak memanggil server actions — murni query DB sehingga aman di-import dari
 * file "use server" manapun tanpa circular dependency.
 */

import { eq, and, sql } from "drizzle-orm";
import { generateFinancialNumber } from "./finance";
import type { TenantDb } from "../tenant-client";
import type { InvoiceSourceType } from "../schema/tenant/billing";

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
};

// ─── createLinkedInvoice ──────────────────────────────────────────────────────
// Buat invoice + invoice_items untuk record dari modul mana saja.
// Dipanggil setelah order/donation/registration berhasil disimpan.

export async function createLinkedInvoice(
  tenantDb: TenantDb,
  input: CreateLinkedInvoiceInput
): Promise<{ invoiceId: string; invoiceNumber: string }> {
  const { db, schema } = tenantDb;

  const invoiceNumber = await generateFinancialNumber(tenantDb, "invoice");

  const subtotal = input.items.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
  const discount = input.discount ?? 0;
  const total    = Math.max(0, subtotal - discount);

  const dueDate = input.dueDate ?? (() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().slice(0, 10);
  })();

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
      status:        "pending",
      dueDate,
      notes:         input.notes?.trim() ?? null,
      createdBy:     input.createdBy ?? null,
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

  return { invoiceId: invoice.id, invoiceNumber };
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
