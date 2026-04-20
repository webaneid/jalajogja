"use server";

import { eq, and, desc, sql, count, inArray } from "drizzle-orm";
import type { InvoiceStatus } from "@jalajogja/db";
import { revalidatePath } from "next/cache";
import { createTenantDb, generateFinancialNumber } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { hasFullAccess } from "@/lib/permissions";
import { recordIncome } from "@jalajogja/db";

// ─── Types ────────────────────────────────────────────────────────────────────

type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export type InvoiceItemInput = {
  itemType: "product" | "ticket" | "donation" | "custom";
  itemId?: string;
  name: string;
  description?: string;
  unitPrice: number;
  quantity: number;
};

export type CreateInvoiceData = {
  customerName:  string;
  customerPhone?: string;
  customerEmail?: string;
  memberId?:     string;
  items:         InvoiceItemInput[];
  discount?:     number;
  dueDate?:      string; // YYYY-MM-DD
  notes?:        string;
};

export type ConfirmInvoicePaymentData = {
  amount:       number;
  method:       "cash" | "transfer" | "qris";
  payerBank?:   string;
  transferDate?: string;
  notes?:       string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function revalidateBilling(slug: string) {
  revalidatePath(`/${slug}/finance/billing`);
  revalidatePath(`/${slug}/finance`);
}

function calcSubtotal(items: InvoiceItemInput[]): number {
  return items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
}

// ─── createInvoiceAction ─────────────────────────────────────────────────────
// Buat invoice manual dari dashboard admin.

export async function createInvoiceAction(
  slug: string,
  data: CreateInvoiceData
): Promise<ActionResult<{ invoiceId: string }>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "keuangan"))
    return { success: false as const, error: "Akses ditolak." };

  if (!data.customerName?.trim())
    return { success: false, error: "Nama customer wajib diisi." };
  if (!data.items?.length)
    return { success: false, error: "Minimal satu item harus ditambahkan." };

  for (const item of data.items) {
    if (!item.name?.trim())  return { success: false, error: "Nama item tidak boleh kosong." };
    if (item.unitPrice < 0)  return { success: false, error: "Harga tidak boleh negatif." };
    if (item.quantity < 1)   return { success: false, error: "Kuantitas minimal 1." };
  }

  const tenantDb = createTenantDb(slug);
  const { db, schema } = tenantDb;

  try {
    const invoiceNumber = await generateFinancialNumber(tenantDb, "invoice");
    const subtotal  = calcSubtotal(data.items);
    const discount  = data.discount ?? 0;
    const total     = Math.max(0, subtotal - discount);

    // Default due date: 3 hari dari sekarang
    const dueDate = data.dueDate ?? (() => {
      const d = new Date();
      d.setDate(d.getDate() + 3);
      return d.toISOString().slice(0, 10);
    })();

    const [invoice] = await db
      .insert(schema.invoices)
      .values({
        invoiceNumber,
        sourceType:    "manual",
        sourceId:      null,
        customerName:  data.customerName.trim(),
        customerPhone: data.customerPhone?.trim() ?? null,
        customerEmail: data.customerEmail?.trim() ?? null,
        memberId:      data.memberId ?? null,
        subtotal:      subtotal.toFixed(2),
        discount:      discount.toFixed(2),
        total:         total.toFixed(2),
        paidAmount:    "0",
        status:        "pending",
        dueDate,
        notes:         data.notes?.trim() ?? null,
        createdBy:     access.userId,
      })
      .returning({ id: schema.invoices.id });

    // Insert items
    await db.insert(schema.invoiceItems).values(
      data.items.map((item, i) => ({
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

    revalidateBilling(slug);
    return { success: true, data: { invoiceId: invoice.id } };
  } catch (err) {
    console.error("[createInvoiceAction]", err);
    return { success: false, error: "Gagal membuat invoice." };
  }
}

// ─── updateInvoiceDueDateAction ───────────────────────────────────────────────

export async function updateInvoiceDueDateAction(
  slug: string,
  invoiceId: string,
  dueDate: string
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "keuangan"))
    return { success: false as const, error: "Akses ditolak." };

  const { db, schema } = createTenantDb(slug);
  await db
    .update(schema.invoices)
    .set({ dueDate, updatedAt: new Date() })
    .where(eq(schema.invoices.id, invoiceId));

  revalidateBilling(slug);
  return { success: true, data: undefined };
}

// ─── cancelInvoiceAction ──────────────────────────────────────────────────────

export async function cancelInvoiceAction(
  slug: string,
  invoiceId: string,
  reason: string
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "keuangan"))
    return { success: false as const, error: "Akses ditolak." };

  const { db, schema } = createTenantDb(slug);

  const [inv] = await db
    .select({ status: schema.invoices.status, paidAmount: schema.invoices.paidAmount })
    .from(schema.invoices)
    .where(eq(schema.invoices.id, invoiceId))
    .limit(1);

  if (!inv) return { success: false, error: "Invoice tidak ditemukan." };
  if (inv.status === "paid") return { success: false, error: "Invoice yang sudah lunas tidak bisa dibatalkan." };
  if (parseFloat(String(inv.paidAmount)) > 0)
    return { success: false, error: "Invoice yang sudah ada pembayaran tidak bisa dibatalkan langsung. Refund dulu pembayarannya." };

  await db
    .update(schema.invoices)
    .set({
      status:    "cancelled",
      notes:     reason.trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(schema.invoices.id, invoiceId));

  revalidateBilling(slug);
  return { success: true, data: undefined };
}

// ─── confirmInvoicePaymentAction ──────────────────────────────────────────────
// Konfirmasi pembayaran invoice — insert payment, update paid_amount, evaluasi status.

export async function confirmInvoicePaymentAction(
  slug: string,
  invoiceId: string,
  data: ConfirmInvoicePaymentData
): Promise<ActionResult<{ paymentId: string }>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "keuangan"))
    return { success: false as const, error: "Akses ditolak." };

  if (!data.amount || data.amount <= 0)
    return { success: false, error: "Jumlah pembayaran harus lebih dari 0." };

  const tenantDb = createTenantDb(slug);
  const { db, schema } = tenantDb;

  const [inv] = await db
    .select()
    .from(schema.invoices)
    .where(eq(schema.invoices.id, invoiceId))
    .limit(1);

  if (!inv) return { success: false, error: "Invoice tidak ditemukan." };
  if (inv.status === "paid")     return { success: false, error: "Invoice sudah lunas." };
  if (inv.status === "cancelled") return { success: false, error: "Invoice dibatalkan." };

  const total      = parseFloat(String(inv.total));
  const paidSoFar  = parseFloat(String(inv.paidAmount));
  const remaining  = total - paidSoFar;

  if (data.amount > remaining)
    return { success: false, error: `Jumlah melebihi sisa tagihan (Rp ${remaining.toLocaleString("id-ID")}).` };

  try {
    const newPaidAmount = paidSoFar + data.amount;
    const newStatus     = newPaidAmount >= total ? "paid" : "partial";

    // Resolve akun untuk jurnal
    const { resolveAccountMappingsForBilling } = await import("../actions");
    const { cashAccountId, incomeAccountId } = await resolveAccountMappingsForBilling(
      tenantDb, data.method, "manual"
    );

    if (!cashAccountId || !incomeAccountId) {
      return {
        success: false,
        error: "Konfigurasi mapping akun belum lengkap. Atur di menu Akun → Pengaturan Mapping.",
      };
    }

    // Jalankan atomik dalam transaction
    const paymentId = await db.transaction(async (tx) => {
      const payNum = await generateFinancialNumber(tenantDb, "payment");

      const [payment] = await tx
        .insert(schema.payments)
        .values({
          number:       payNum,
          sourceType:   "invoice",
          sourceId:     invoiceId,
          amount:       data.amount.toFixed(2),
          uniqueCode:   0,
          method:       data.method,
          status:       "paid",
          transferDate: data.transferDate ?? null,
          payerName:    inv.customerName,
          payerBank:    data.payerBank?.trim() ?? null,
          payerNote:    data.notes?.trim() ?? null,
          confirmedBy:  access.userId,
          confirmedAt:  new Date(),
          submittedAt:  new Date(),
        })
        .returning({ id: schema.payments.id });

      // Link invoice ↔ payment
      await tx.insert(schema.invoicePayments).values({
        invoiceId,
        paymentId: payment.id,
        amount:    data.amount.toFixed(2),
      });

      // Update invoice paid_amount + status
      await tx
        .update(schema.invoices)
        .set({
          paidAmount: newPaidAmount.toFixed(2),
          status:     newStatus,
          updatedAt:  new Date(),
        })
        .where(eq(schema.invoices.id, invoiceId));

      // Jurnal double-entry (hanya jika lunas — partial tidak jurnal dulu)
      if (newStatus === "paid") {
        const txNum = await generateFinancialNumber(tenantDb, "journal");
        await recordIncome(tenantDb, {
          date:            new Date().toISOString().slice(0, 10),
          description:     `Pelunasan invoice ${inv.invoiceNumber}`,
          referenceNumber: txNum,
          createdBy:       access.userId,
          amount:          total,
          cashAccountId,
          incomeAccountId,
        });
      }

      return payment.id;
    });

    revalidateBilling(slug);
    return { success: true, data: { paymentId } };
  } catch (err) {
    console.error("[confirmInvoicePaymentAction]", err);
    return { success: false, error: "Gagal mencatat pembayaran." };
  }
}

// ─── getInvoiceListAction ─────────────────────────────────────────────────────

export type InvoiceListItem = {
  id:            string;
  invoiceNumber: string;
  sourceType:    string;
  customerName:  string;
  total:         number;
  paidAmount:    number;
  status:        string;
  dueDate:       string | null;
  createdAt:     string;
  itemCount:     number;
};

export async function getInvoiceListAction(
  slug: string,
  opts: { status?: string; page?: number; search?: string } = {}
): Promise<ActionResult<{ rows: InvoiceListItem[]; total: number }>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };

  const { db, schema } = createTenantDb(slug);
  const PAGE_SIZE = 20;
  const page = opts.page ?? 1;

  const conditions = [];
  if (opts.status && opts.status !== "all") {
    conditions.push(eq(schema.invoices.status, opts.status as InvoiceStatus));
  }
  if (opts.search?.trim()) {
    const term = `%${opts.search.trim()}%`;
    conditions.push(
      sql`(${schema.invoices.invoiceNumber} ILIKE ${term} OR ${schema.invoices.customerName} ILIKE ${term})`
    );
  }

  const where = conditions.length ? and(...conditions) : undefined;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id:            schema.invoices.id,
        invoiceNumber: schema.invoices.invoiceNumber,
        sourceType:    schema.invoices.sourceType,
        customerName:  schema.invoices.customerName,
        total:         schema.invoices.total,
        paidAmount:    schema.invoices.paidAmount,
        status:        schema.invoices.status,
        dueDate:       schema.invoices.dueDate,
        createdAt:     schema.invoices.createdAt,
      })
      .from(schema.invoices)
      .where(where)
      .orderBy(desc(schema.invoices.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),

    db.select({ total: count() }).from(schema.invoices).where(where),
  ]);

  // Ambil item count per invoice
  const ids = rows.map((r) => r.id);
  let itemCounts: Record<string, number> = {};
  if (ids.length) {
    const counts = await db
      .select({
        invoiceId: schema.invoiceItems.invoiceId,
        cnt:       count(),
      })
      .from(schema.invoiceItems)
      .where(sql`${schema.invoiceItems.invoiceId} = ANY(ARRAY[${sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `)}])`)
      .groupBy(schema.invoiceItems.invoiceId);

    itemCounts = Object.fromEntries(counts.map((c) => [c.invoiceId, Number(c.cnt)]));
  }

  return {
    success: true,
    data: {
      total: Number(total),
      rows: rows.map((r) => ({
        id:            r.id,
        invoiceNumber: r.invoiceNumber,
        sourceType:    r.sourceType,
        customerName:  r.customerName,
        total:         parseFloat(String(r.total)),
        paidAmount:    parseFloat(String(r.paidAmount)),
        status:        r.status,
        dueDate:       r.dueDate,
        createdAt:     r.createdAt.toISOString(),
        itemCount:     itemCounts[r.id] ?? 0,
      })),
    },
  };
}

// ─── getInvoiceDetailAction ───────────────────────────────────────────────────

export type InvoiceDetail = {
  id:            string;
  invoiceNumber: string;
  sourceType:    string;
  customerName:  string;
  customerPhone: string | null;
  customerEmail: string | null;
  subtotal:      number;
  discount:      number;
  total:         number;
  paidAmount:    number;
  remaining:     number;
  status:        string;
  dueDate:       string | null;
  notes:         string | null;
  pdfUrl:        string | null;
  createdAt:     string;
  items: {
    id:          string;
    itemType:    string;
    name:        string;
    description: string | null;
    unitPrice:   number;
    quantity:    number;
    total:       number;
  }[];
  payments: {
    id:          string;
    amount:      number;
    method:      string;
    createdAt:   string;
  }[];
};

export async function getInvoiceDetailAction(
  slug: string,
  invoiceId: string
): Promise<ActionResult<InvoiceDetail>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };

  const { db, schema } = createTenantDb(slug);

  const [inv] = await db
    .select()
    .from(schema.invoices)
    .where(eq(schema.invoices.id, invoiceId))
    .limit(1);

  if (!inv) return { success: false, error: "Invoice tidak ditemukan." };

  const [items, paymentLinks] = await Promise.all([
    db
      .select()
      .from(schema.invoiceItems)
      .where(eq(schema.invoiceItems.invoiceId, invoiceId))
      .orderBy(schema.invoiceItems.sortOrder),

    db
      .select({
        id:        schema.payments.id,
        amount:    schema.invoicePayments.amount,
        method:    schema.payments.method,
        createdAt: schema.payments.createdAt,
      })
      .from(schema.invoicePayments)
      .innerJoin(schema.payments, eq(schema.invoicePayments.paymentId, schema.payments.id))
      .where(eq(schema.invoicePayments.invoiceId, invoiceId))
      .orderBy(desc(schema.payments.createdAt)),
  ]);

  const total      = parseFloat(String(inv.total));
  const paidAmount = parseFloat(String(inv.paidAmount));

  return {
    success: true,
    data: {
      id:            inv.id,
      invoiceNumber: inv.invoiceNumber,
      sourceType:    inv.sourceType,
      customerName:  inv.customerName,
      customerPhone: inv.customerPhone,
      customerEmail: inv.customerEmail,
      subtotal:      parseFloat(String(inv.subtotal)),
      discount:      parseFloat(String(inv.discount)),
      total,
      paidAmount,
      remaining:     Math.max(0, total - paidAmount),
      status:        inv.status,
      dueDate:       inv.dueDate,
      notes:         inv.notes,
      pdfUrl:        inv.pdfUrl,
      createdAt:     inv.createdAt.toISOString(),
      items: items.map((it) => ({
        id:          it.id,
        itemType:    it.itemType,
        name:        it.name,
        description: it.description,
        unitPrice:   parseFloat(String(it.unitPrice)),
        quantity:    it.quantity,
        total:       parseFloat(String(it.total)),
      })),
      payments: paymentLinks.map((p) => ({
        id:        p.id,
        amount:    parseFloat(String(p.amount)),
        method:    p.method,
        createdAt: p.createdAt.toISOString(),
      })),
    },
  };
}
