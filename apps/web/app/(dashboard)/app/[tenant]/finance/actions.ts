"use server";

import { eq, and, sql, gte, lte, desc, isNull, or, ilike, ne, inArray, count } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { hasFullAccess } from "@/lib/permissions";
import {
  recordJournal,
  recordIncome,
  recordExpense,
  generateFinancialNumber,
} from "@jalajogja/db";

// ─── Types ─────────────────────────────────────────────────────────────────

type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

// Mapping akun untuk jurnal otomatis
type AccountMappings = {
  cash_default:   string | null; // UUID akun 1101 Kas Tunai
  bank_default:   string | null; // UUID akun 1102 Bank
  income_toko:    string | null; // UUID akun 4300 Pendapatan Usaha
  income_donasi:  string | null; // UUID akun 4200 Pendapatan Donasi
  income_event:   string | null; // UUID akun 4400 Pendapatan Event
  income_manual:  string | null; // UUID akun 4100 Pendapatan Iuran
  dana_titipan:   string | null; // UUID akun 2200 Dana Titipan
  expense_default:string | null; // UUID akun 5100 Beban Operasional
};

// ─── Helper: resolusi akun ──────────────────────────────────────────────────

/** Ambil UUID akun by code — fallback saat mapping belum dikonfigurasi admin */
async function lookupAccountByCode(
  db: ReturnType<typeof createTenantDb>["db"],
  schema: ReturnType<typeof createTenantDb>["schema"],
  code: string
): Promise<string | null> {
  const [row] = await db
    .select({ id: schema.accounts.id })
    .from(schema.accounts)
    .where(and(eq(schema.accounts.code, code), eq(schema.accounts.isActive, true)))
    .limit(1);
  return row?.id ?? null;
}

/** Ambil account mappings dari settings, fallback ke lookup by code */
async function resolveAccountMappings(
  tenantDb: ReturnType<typeof createTenantDb>
): Promise<AccountMappings> {
  const { db, schema } = tenantDb;

  // Coba baca dari settings
  const [row] = await db
    .select({ value: schema.settings.value })
    .from(schema.settings)
    .where(and(
      eq(schema.settings.key, "account_mappings"),
      eq(schema.settings.group, "keuangan")
    ))
    .limit(1);

  if (row?.value && typeof row.value === "object") {
    return row.value as AccountMappings;
  }

  // Fallback: lookup by kode akun default
  const [cashDefault, bankDefault, incomeToko, incomeDonasi, incomeEvent, incomeManual, danaTitipan, expenseDefault] =
    await Promise.all([
      lookupAccountByCode(db, schema, "1101"),
      lookupAccountByCode(db, schema, "1102"),
      lookupAccountByCode(db, schema, "4300"),
      lookupAccountByCode(db, schema, "4200"),
      lookupAccountByCode(db, schema, "4400"),
      lookupAccountByCode(db, schema, "4100"),
      lookupAccountByCode(db, schema, "2200"),
      lookupAccountByCode(db, schema, "5100"),
    ]);

  return {
    cash_default:    cashDefault,
    bank_default:    bankDefault,
    income_toko:     incomeToko,
    income_donasi:   incomeDonasi,
    income_event:    incomeEvent,
    income_manual:   incomeManual,
    dana_titipan:    danaTitipan,
    expense_default: expenseDefault,
  };
}

/** Pilih akun kas berdasarkan metode pembayaran */
function pickCashAccount(
  method: string,
  mappings: AccountMappings
): string | null {
  if (method === "transfer" || method === "qris" ||
      method === "midtrans" || method === "xendit" || method === "ipaymu") {
    return mappings.bank_default ?? mappings.cash_default;
  }
  return mappings.cash_default;
}

/** Pilih akun pendapatan berdasarkan source_type */
function pickIncomeAccount(
  sourceType: string,
  mappings: AccountMappings
): string | null {
  if (sourceType === "order")              return mappings.income_toko;
  if (sourceType === "donation")           return mappings.dana_titipan;
  if (sourceType === "event_registration") return mappings.income_event ?? mappings.income_manual;
  return mappings.income_manual;
}

function revalidateFinance(slug: string) {
  revalidatePath(`/${slug}/finance`);
}

/** Wrapper untuk billing/actions.ts yang butuh resolusi akun kas + pendapatan */
export async function resolveAccountMappingsForBilling(
  tenantDb: ReturnType<typeof createTenantDb>,
  method: string,
  sourceType: string
): Promise<{ cashAccountId: string | null; incomeAccountId: string | null }> {
  const mappings = await resolveAccountMappings(tenantDb);
  return {
    cashAccountId:   pickCashAccount(method, mappings),
    incomeAccountId: pickIncomeAccount(sourceType, mappings),
  };
}

// ─── PEMASUKAN (Payments) ────────────────────────────────────────────────────

export type ManualPaymentData = {
  amount: number;
  method: "cash" | "transfer" | "qris";
  payerName: string;
  payerBank?: string;
  transferDate?: string; // YYYY-MM-DD
  notes?: string;
  bankAccountRef?: string;
};

export async function createManualPaymentAction(
  slug: string,
  data: ManualPaymentData
): Promise<ActionResult<{ paymentId: string }>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "keuangan")) return { success: false as const, error: "Akses ditolak." };

  if (!data.amount || data.amount <= 0)
    return { success: false, error: "Jumlah harus lebih dari 0." };
  if (!data.payerName?.trim())
    return { success: false, error: "Nama pembayar wajib diisi." };

  const tenantDb = createTenantDb(slug);
  const { db, schema } = tenantDb;

  try {
    const number = await generateFinancialNumber(tenantDb, "payment");

    const [payment] = await db
      .insert(schema.payments)
      .values({
        number,
        sourceType:     "manual",
        sourceId:       null,
        amount:         data.amount.toFixed(2),
        uniqueCode:     0,
        method:         data.method,
        bankAccountRef: data.bankAccountRef ?? null,
        status:         "submitted", // manual langsung submitted — admin yang input
        transferDate:   data.transferDate ?? null,
        payerName:      data.payerName.trim(),
        payerBank:      data.payerBank?.trim() ?? null,
        payerNote:      data.notes?.trim() ?? null,
        submittedAt:    new Date(),
      })
      .returning({ id: schema.payments.id });

    revalidateFinance(slug);
    return { success: true, data: { paymentId: payment.id } };
  } catch (err) {
    console.error("[createManualPaymentAction]", err);
    return { success: false, error: "Gagal membuat pemasukan." };
  }
}

export async function confirmPaymentAction(
  slug: string,
  paymentId: string
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "keuangan")) return { success: false as const, error: "Akses ditolak." };

  const tenantDb = createTenantDb(slug);
  const { db, schema } = tenantDb;

  const [payment] = await db
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.id, paymentId))
    .limit(1);

  if (!payment) return { success: false, error: "Pembayaran tidak ditemukan." };
  if (payment.status === "paid")
    return { success: false, error: "Pembayaran sudah dikonfirmasi sebelumnya." };
  if (payment.status === "cancelled" || payment.status === "failed")
    return { success: false, error: "Pembayaran tidak bisa dikonfirmasi." };

  try {
    const mappings = await resolveAccountMappings(tenantDb);
    const cashAccountId   = pickCashAccount(payment.method, mappings);
    const incomeAccountId = pickIncomeAccount(payment.sourceType, mappings);

    if (!cashAccountId || !incomeAccountId) {
      return {
        success: false,
        error: "Konfigurasi mapping akun belum lengkap. Atur di menu Akun → Pengaturan Mapping.",
      };
    }

    const amount = parseFloat(String(payment.amount));
    const userId = access.userId;

    // Buat journal entry otomatis
    const txNumber = await generateFinancialNumber(tenantDb, "journal");
    const transaction = await recordIncome(tenantDb, {
      date:            new Date().toISOString().slice(0, 10),
      description:     `Konfirmasi pembayaran ${payment.number}`,
      referenceNumber: txNumber,
      createdBy:       userId,
      amount,
      cashAccountId,
      incomeAccountId,
    });

    // Update status payment
    await db
      .update(schema.payments)
      .set({
        status:        "paid",
        confirmedBy:   userId,
        confirmedAt:   new Date(),
        transactionId: transaction.id,
        updatedAt:     new Date(),
      })
      .where(eq(schema.payments.id, paymentId));

    revalidateFinance(slug);
    return { success: true, data: undefined };
  } catch (err) {
    console.error("[confirmPaymentAction]", err);
    return { success: false, error: "Gagal mengkonfirmasi pembayaran." };
  }
}

export async function rejectPaymentAction(
  slug: string,
  paymentId: string,
  reason: string
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "keuangan")) return { success: false as const, error: "Akses ditolak." };

  if (!reason?.trim())
    return { success: false, error: "Alasan penolakan wajib diisi." };

  const { db, schema } = createTenantDb(slug);

  const [payment] = await db
    .select({ id: schema.payments.id, status: schema.payments.status })
    .from(schema.payments)
    .where(eq(schema.payments.id, paymentId))
    .limit(1);

  if (!payment) return { success: false, error: "Pembayaran tidak ditemukan." };
  if (payment.status === "paid")
    return { success: false, error: "Pembayaran sudah dikonfirmasi, tidak bisa ditolak." };

  await db
    .update(schema.payments)
    .set({
      status:        "rejected",
      rejectedBy:    access.userId,
      rejectedAt:    new Date(),
      rejectionNote: reason.trim(),
      updatedAt:     new Date(),
    })
    .where(eq(schema.payments.id, paymentId));

  revalidateFinance(slug);
  return { success: true, data: undefined };
}

// ─── SEARCH helpers untuk form Catat Pemasukan ──────────────────────────────

export type PendingOrderResult = {
  id: string;
  orderNumber: string;
  customerName: string;
  total: number;
};

export type ActiveCampaignResult = {
  id: string;
  title: string;
  slug: string;
};

export type UnpaidRegistrationResult = {
  id: string;
  registrationNumber: string;
  attendeeName: string;
  eventName: string;
  ticketName: string;
  ticketPrice: number;
};

/** Cari order yang belum ada payment dengan status paid */
export async function searchPendingOrdersAction(
  slug: string,
  q: string
): Promise<ActionResult<PendingOrderResult[]>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };

  const { db, schema } = createTenantDb(slug);

  // Sub-query: order IDs yang sudah paid
  const paidOrderIds = db
    .select({ sourceId: schema.payments.sourceId })
    .from(schema.payments)
    .where(
      and(
        eq(schema.payments.sourceType, "order"),
        eq(schema.payments.status, "paid")
      )
    );

  const term = `%${q}%`;
  const rows = await db
    .select({
      id:           schema.orders.id,
      orderNumber:  schema.orders.orderNumber,
      customerName: schema.orders.customerName,
      total:        schema.orders.total,
    })
    .from(schema.orders)
    .where(
      and(
        ne(schema.orders.status, "cancelled"),
        or(
          ilike(schema.orders.orderNumber, term),
          ilike(schema.orders.customerName, term)
        ),
        // belum ada payment paid
        sql`${schema.orders.id} NOT IN (${paidOrderIds})`
      )
    )
    .orderBy(desc(schema.orders.createdAt))
    .limit(20);

  return {
    success: true,
    data: rows.map((r) => ({
      id:           r.id,
      orderNumber:  r.orderNumber,
      customerName: r.customerName ?? "",
      total:        parseFloat(String(r.total)),
    })),
  };
}

/** Ambil campaign donasi yang aktif */
export async function searchActiveCampaignsAction(
  slug: string,
  q: string
): Promise<ActionResult<ActiveCampaignResult[]>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };

  const { db, schema } = createTenantDb(slug);
  const term = `%${q}%`;

  const rows = await db
    .select({
      id:    schema.campaigns.id,
      title: schema.campaigns.title,
      slug:  schema.campaigns.slug,
    })
    .from(schema.campaigns)
    .where(
      and(
        eq(schema.campaigns.status, "active"),
        q.trim() ? ilike(schema.campaigns.title, term) : undefined
      )
    )
    .orderBy(schema.campaigns.title)
    .limit(20);

  return { success: true, data: rows };
}

/** Cari registrasi event yang belum ada payment paid */
export async function searchUnpaidRegistrationsAction(
  slug: string,
  q: string
): Promise<ActionResult<UnpaidRegistrationResult[]>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };

  const { db, schema } = createTenantDb(slug);

  const paidRegIds = db
    .select({ sourceId: schema.payments.sourceId })
    .from(schema.payments)
    .where(
      and(
        eq(schema.payments.sourceType, "event_registration"),
        eq(schema.payments.status, "paid")
      )
    );

  const term = `%${q}%`;
  const rows = await db
    .select({
      id:                 schema.eventRegistrations.id,
      registrationNumber: schema.eventRegistrations.registrationNumber,
      attendeeName:       schema.eventRegistrations.attendeeName,
      eventName:          schema.events.title,
      ticketName:         schema.eventTickets.name,
      ticketPrice:        schema.eventTickets.price,
    })
    .from(schema.eventRegistrations)
    .innerJoin(schema.eventTickets, eq(schema.eventRegistrations.ticketId, schema.eventTickets.id))
    .innerJoin(schema.events, eq(schema.eventRegistrations.eventId, schema.events.id))
    .where(
      and(
        eq(schema.eventRegistrations.status, "confirmed"),
        or(
          ilike(schema.eventRegistrations.registrationNumber, term),
          ilike(schema.eventRegistrations.attendeeName, term),
          ilike(schema.events.title, term)
        ),
        sql`${schema.eventRegistrations.id} NOT IN (${paidRegIds})`
      )
    )
    .orderBy(desc(schema.eventRegistrations.createdAt))
    .limit(20);

  return {
    success: true,
    data: rows.map((r) => ({
      id:                 r.id,
      registrationNumber: r.registrationNumber,
      attendeeName:       r.attendeeName ?? "",
      eventName:          r.eventName,
      ticketName:         r.ticketName,
      ticketPrice:        parseFloat(String(r.ticketPrice)),
    })),
  };
}

export type LinkedPaymentData = {
  sourceType: "manual" | "order" | "donation" | "event_registration";
  sourceId?: string;
  // Manual
  amount?: number;
  payerName?: string;
  // Donasi — data donatur
  donorName?: string;
  donorPhone?: string;
  donorEmail?: string;
  campaignId?: string;
  donationAmount?: number;
  // Common
  method: "cash" | "transfer" | "qris";
  payerBank?: string;
  transferDate?: string;
  notes?: string;
};

/** Buat payment yang terhubung ke sumber tertentu (order/donation/event/manual) */
export async function createLinkedPaymentAction(
  slug: string,
  data: LinkedPaymentData
): Promise<ActionResult<{ paymentId: string }>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "keuangan"))
    return { success: false as const, error: "Akses ditolak." };

  const tenantDb = createTenantDb(slug);
  const { db, schema } = tenantDb;

  try {
    let sourceId   = data.sourceId ?? null;
    let amount     = 0;
    let payerName  = "";

    if (data.sourceType === "manual") {
      if (!data.amount || data.amount <= 0)
        return { success: false, error: "Jumlah harus lebih dari 0." };
      if (!data.payerName?.trim())
        return { success: false, error: "Nama pembayar wajib diisi." };
      amount    = data.amount;
      payerName = data.payerName.trim();

    } else if (data.sourceType === "order") {
      if (!data.sourceId)
        return { success: false, error: "Pesanan harus dipilih." };
      const [order] = await db
        .select({ total: schema.orders.total, customerName: schema.orders.customerName })
        .from(schema.orders)
        .where(eq(schema.orders.id, data.sourceId))
        .limit(1);
      if (!order) return { success: false, error: "Pesanan tidak ditemukan." };
      amount    = parseFloat(String(order.total));
      payerName = order.customerName ?? "Pelanggan";

    } else if (data.sourceType === "donation") {
      if (!data.campaignId)
        return { success: false, error: "Campaign harus dipilih." };
      if (!data.donorName?.trim())
        return { success: false, error: "Nama donatur wajib diisi." };
      if (!data.donationAmount || data.donationAmount <= 0)
        return { success: false, error: "Jumlah donasi harus lebih dari 0." };

      // Buat record donasi
      const donNum = await generateFinancialNumber(tenantDb, "payment");
      const [donation] = await db
        .insert(schema.donations)
        .values({
          donationNumber: donNum.replace("PAY", "DON"),
          campaignId:     data.campaignId,
          memberId:       null,
          donorName:      data.donorName.trim(),
          donorPhone:     data.donorPhone?.trim() ?? null,
          donorEmail:     data.donorEmail?.trim() ?? null,
          donorMessage:   data.notes?.trim() ?? null,
        })
        .returning({ id: schema.donations.id });

      sourceId  = donation.id;
      amount    = data.donationAmount;
      payerName = data.donorName.trim();

    } else if (data.sourceType === "event_registration") {
      if (!data.sourceId)
        return { success: false, error: "Registrasi harus dipilih." };
      const [reg] = await db
        .select({
          attendeeName: schema.eventRegistrations.attendeeName,
          ticketId:     schema.eventRegistrations.ticketId,
        })
        .from(schema.eventRegistrations)
        .where(eq(schema.eventRegistrations.id, data.sourceId))
        .limit(1);
      if (!reg) return { success: false, error: "Registrasi tidak ditemukan." };

      const [ticket] = await db
        .select({ price: schema.eventTickets.price })
        .from(schema.eventTickets)
        .where(eq(schema.eventTickets.id, reg.ticketId))
        .limit(1);

      amount    = parseFloat(String(ticket?.price ?? 0));
      payerName = reg.attendeeName ?? "Peserta";
    }

    const number = await generateFinancialNumber(tenantDb, "payment");

    const [payment] = await db
      .insert(schema.payments)
      .values({
        number,
        sourceType:     data.sourceType,
        sourceId,
        amount:         amount.toFixed(2),
        uniqueCode:     0,
        method:         data.method,
        bankAccountRef: null,
        status:         "submitted",
        transferDate:   data.transferDate ?? null,
        payerName,
        payerBank:      data.payerBank?.trim() ?? null,
        payerNote:      data.notes?.trim() ?? null,
        submittedAt:    new Date(),
      })
      .returning({ id: schema.payments.id });

    revalidateFinance(slug);
    return { success: true, data: { paymentId: payment.id } };
  } catch (err) {
    console.error("[createLinkedPaymentAction]", err);
    return { success: false, error: "Gagal mencatat pemasukan." };
  }
}

// ─── PENGELUARAN (Disbursements) ─────────────────────────────────────────────

export type DisbursementData = {
  purposeType: "expense" | "grant" | "transfer" | "manual";
  amount: number;
  method: "cash" | "transfer";
  recipientName: string;
  recipientBank?: string;
  recipientAccount?: string;
  note?: string;
};

export async function createDisbursementAction(
  slug: string,
  data: DisbursementData
): Promise<ActionResult<{ disbursementId: string }>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "keuangan")) return { success: false as const, error: "Akses ditolak." };

  if (!data.amount || data.amount <= 0)
    return { success: false, error: "Jumlah harus lebih dari 0." };
  if (!data.recipientName?.trim())
    return { success: false, error: "Nama penerima wajib diisi." };

  const tenantDb = createTenantDb(slug);
  const { db, schema } = tenantDb;

  try {
    const number = await generateFinancialNumber(tenantDb, "disbursement");

    const [dis] = await db
      .insert(schema.disbursements)
      .values({
        number,
        purposeType:      data.purposeType,
        purposeId:        null,
        amount:           data.amount.toFixed(2),
        method:           data.method,
        recipientName:    data.recipientName.trim(),
        recipientBank:    data.recipientBank?.trim() ?? null,
        recipientAccount: data.recipientAccount?.trim() ?? null,
        note:             data.note?.trim() ?? null,
        status:           "draft",
        requestedBy:      access.userId,
      })
      .returning({ id: schema.disbursements.id });

    revalidateFinance(slug);
    return { success: true, data: { disbursementId: dis.id } };
  } catch (err) {
    console.error("[createDisbursementAction]", err);
    return { success: false, error: "Gagal membuat pengeluaran." };
  }
}

export async function approveDisbursementAction(
  slug: string,
  disbursementId: string
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "keuangan")) return { success: false as const, error: "Akses ditolak." };

  const { db, schema } = createTenantDb(slug);

  const [dis] = await db
    .select({ id: schema.disbursements.id, status: schema.disbursements.status })
    .from(schema.disbursements)
    .where(eq(schema.disbursements.id, disbursementId))
    .limit(1);

  if (!dis) return { success: false, error: "Pengeluaran tidak ditemukan." };
  if (dis.status !== "draft")
    return { success: false, error: "Hanya pengeluaran berstatus Draft yang bisa disetujui." };

  await db
    .update(schema.disbursements)
    .set({
      status:     "approved",
      approvedBy: access.userId,
      approvedAt: new Date(),
      updatedAt:  new Date(),
    })
    .where(eq(schema.disbursements.id, disbursementId));

  revalidateFinance(slug);
  return { success: true, data: undefined };
}

export async function markDisbursementPaidAction(
  slug: string,
  disbursementId: string,
  proofUrl?: string
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "keuangan")) return { success: false as const, error: "Akses ditolak." };

  const tenantDb = createTenantDb(slug);
  const { db, schema } = tenantDb;

  const [dis] = await db
    .select()
    .from(schema.disbursements)
    .where(eq(schema.disbursements.id, disbursementId))
    .limit(1);

  if (!dis) return { success: false, error: "Pengeluaran tidak ditemukan." };
  if (dis.status !== "approved")
    return { success: false, error: "Pengeluaran harus disetujui terlebih dahulu." };

  try {
    const mappings = await resolveAccountMappings(tenantDb);
    const cashAccountId    = pickCashAccount(dis.method, mappings);
    const expenseAccountId = mappings.expense_default;

    if (!cashAccountId || !expenseAccountId) {
      return {
        success: false,
        error: "Konfigurasi mapping akun belum lengkap. Atur di menu Akun → Pengaturan Mapping.",
      };
    }

    const amount = parseFloat(String(dis.amount));
    const txNumber = await generateFinancialNumber(tenantDb, "journal");

    const transaction = await recordExpense(tenantDb, {
      date:            new Date().toISOString().slice(0, 10),
      description:     `Pengeluaran ${dis.number} — ${dis.recipientName}`,
      referenceNumber: txNumber,
      createdBy:       access.userId,
      amount,
      expenseAccountId,
      cashAccountId,
    });

    await db
      .update(schema.disbursements)
      .set({
        status:        "paid",
        paidAt:        new Date(),
        proofUrl:      proofUrl ?? null,
        transactionId: transaction.id,
        updatedAt:     new Date(),
      })
      .where(eq(schema.disbursements.id, disbursementId));

    revalidateFinance(slug);
    return { success: true, data: undefined };
  } catch (err) {
    console.error("[markDisbursementPaidAction]", err);
    return { success: false, error: "Gagal menandai pengeluaran sebagai dibayar." };
  }
}

export async function cancelDisbursementAction(
  slug: string,
  disbursementId: string
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "keuangan")) return { success: false as const, error: "Akses ditolak." };

  const { db, schema } = createTenantDb(slug);

  const [dis] = await db
    .select({ id: schema.disbursements.id, status: schema.disbursements.status })
    .from(schema.disbursements)
    .where(eq(schema.disbursements.id, disbursementId))
    .limit(1);

  if (!dis) return { success: false, error: "Pengeluaran tidak ditemukan." };
  if (!["draft", "approved"].includes(dis.status))
    return { success: false, error: "Pengeluaran tidak bisa dibatalkan pada status ini." };

  await db
    .update(schema.disbursements)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(schema.disbursements.id, disbursementId));

  revalidateFinance(slug);
  return { success: true, data: undefined };
}

// ─── JURNAL MANUAL ───────────────────────────────────────────────────────────

export type JournalEntryInput = {
  accountId: string;
  type: "debit" | "credit";
  amount: number;
  note?: string;
};

export type JournalData = {
  date: string;        // YYYY-MM-DD
  description: string;
  entries: JournalEntryInput[];
};

export async function createJournalAction(
  slug: string,
  data: JournalData
): Promise<ActionResult<{ transactionId: string }>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "keuangan")) return { success: false as const, error: "Akses ditolak." };

  if (!data.description?.trim())
    return { success: false, error: "Keterangan jurnal wajib diisi." };
  if (!data.date)
    return { success: false, error: "Tanggal jurnal wajib diisi." };
  if (!data.entries || data.entries.length < 2)
    return { success: false, error: "Jurnal minimal 2 baris entri." };

  // Validasi balance
  const totalDebit  = data.entries.filter(e => e.type === "debit").reduce((s, e) => s + e.amount, 0);
  const totalCredit = data.entries.filter(e => e.type === "credit").reduce((s, e) => s + e.amount, 0);
  if (Math.abs(totalDebit - totalCredit) > 0.01)
    return { success: false, error: `Jurnal tidak balance: Debit ${totalDebit} ≠ Kredit ${totalCredit}.` };

  const tenantDb = createTenantDb(slug);

  try {
    const number = await generateFinancialNumber(tenantDb, "journal");

    const transaction = await recordJournal(tenantDb, {
      date:            data.date,
      description:     data.description.trim(),
      referenceNumber: number,
      createdBy:       access.userId,
      entries:         data.entries.map(e => ({
        accountId: e.accountId,
        type:      e.type,
        amount:    e.amount,
        note:      e.note,
      })),
    });

    revalidateFinance(slug);
    return { success: true, data: { transactionId: transaction.id } };
  } catch (err) {
    console.error("[createJournalAction]", err);
    return { success: false, error: "Gagal menyimpan jurnal." };
  }
}

// ─── AKUN (Chart of Accounts) ─────────────────────────────────────────────────

export type AccountData = {
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "income" | "expense";
  parentId?: string | null;
};

export async function createAccountAction(
  slug: string,
  data: AccountData
): Promise<ActionResult<{ accountId: string }>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "keuangan")) return { success: false as const, error: "Akses ditolak." };

  if (!data.code?.trim()) return { success: false, error: "Kode akun wajib diisi." };
  if (!data.name?.trim()) return { success: false, error: "Nama akun wajib diisi." };

  const { db, schema } = createTenantDb(slug);

  const [dup] = await db
    .select({ id: schema.accounts.id })
    .from(schema.accounts)
    .where(eq(schema.accounts.code, data.code.trim()))
    .limit(1);

  if (dup) return { success: false, error: "Kode akun sudah digunakan." };

  try {
    const [account] = await db
      .insert(schema.accounts)
      .values({
        code:     data.code.trim(),
        name:     data.name.trim(),
        type:     data.type,
        parentId: data.parentId ?? null,
      })
      .returning({ id: schema.accounts.id });

    revalidateFinance(slug);
    return { success: true, data: { accountId: account.id } };
  } catch (err) {
    console.error("[createAccountAction]", err);
    return { success: false, error: "Gagal membuat akun." };
  }
}

export async function updateAccountAction(
  slug: string,
  accountId: string,
  data: Partial<AccountData>
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "keuangan")) return { success: false as const, error: "Akses ditolak." };

  const { db, schema } = createTenantDb(slug);

  // Cek kode duplikat jika kode berubah
  if (data.code) {
    const [dup] = await db
      .select({ id: schema.accounts.id })
      .from(schema.accounts)
      .where(and(eq(schema.accounts.code, data.code.trim()), sql`${schema.accounts.id} != ${accountId}`))
      .limit(1);
    if (dup) return { success: false, error: "Kode akun sudah digunakan." };
  }

  await db
    .update(schema.accounts)
    .set({
      ...(data.code  ? { code: data.code.trim() }   : {}),
      ...(data.name  ? { name: data.name.trim() }   : {}),
      ...(data.type  ? { type: data.type }           : {}),
      ...(data.parentId !== undefined ? { parentId: data.parentId } : {}),
      updatedAt: new Date(),
    })
    .where(eq(schema.accounts.id, accountId));

  revalidateFinance(slug);
  return { success: true, data: undefined };
}

export async function toggleAccountActiveAction(
  slug: string,
  accountId: string
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "keuangan")) return { success: false as const, error: "Akses ditolak." };

  const { db, schema } = createTenantDb(slug);

  const [account] = await db
    .select({ id: schema.accounts.id, isActive: schema.accounts.isActive })
    .from(schema.accounts)
    .where(eq(schema.accounts.id, accountId))
    .limit(1);

  if (!account) return { success: false, error: "Akun tidak ditemukan." };

  // Cek apakah ada entries (jika aktif → nonaktif, tidak boleh jika ada entries)
  if (account.isActive) {
    const [entry] = await db
      .select({ id: schema.transactionEntries.id })
      .from(schema.transactionEntries)
      .where(eq(schema.transactionEntries.accountId, accountId))
      .limit(1);
    if (entry) return { success: false, error: "Akun tidak bisa dinonaktifkan karena sudah ada transaksi." };
  }

  await db
    .update(schema.accounts)
    .set({ isActive: !account.isActive, updatedAt: new Date() })
    .where(eq(schema.accounts.id, accountId));

  revalidateFinance(slug);
  return { success: true, data: undefined };
}

// ─── ACCOUNT MAPPINGS ────────────────────────────────────────────────────────

export async function saveAccountMappingsAction(
  slug: string,
  mappings: Partial<AccountMappings>
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "keuangan")) return { success: false as const, error: "Akses ditolak." };

  const { db, schema } = createTenantDb(slug);

  await db
    .insert(schema.settings)
    .values({
      key:   "account_mappings",
      group: "keuangan",
      value: mappings,
    })
    .onConflictDoUpdate({
      target: [schema.settings.key, schema.settings.group],
      set: { value: mappings, updatedAt: new Date() },
    });

  revalidateFinance(slug);
  return { success: true, data: undefined };
}

// ─── LAPORAN KEUANGAN ────────────────────────────────────────────────────────

export type NeracaSaldoRow = {
  code:        string;
  name:        string;
  type:        string;
  totalDebit:  number;
  totalCredit: number;
  balance:     number; // debit - credit
};

export type LabaRugiRow = {
  code:   string;
  name:   string;
  type:   "income" | "expense";
  amount: number;
};

export type LabaRugiData = {
  rows:         LabaRugiRow[];
  totalIncome:  number;
  totalExpense: number;
  netProfit:    number;
};

export type ArusKasRow = {
  label:  string;
  amount: number;
};

export type ArusKasData = {
  pemasukan:        ArusKasRow[];
  pengeluaran:      ArusKasRow[];
  totalPemasukan:   number;
  totalPengeluaran: number;
  saldo:            number;
};

export type BukuBesarRow = {
  date:            string;
  referenceNumber: string;
  description:     string;
  note:            string | null;
  debit:           number;
  credit:          number;
  balance:         number;
};

/** Neraca Saldo: saldo debit/kredit per akun dalam periode */
export async function getLaporanNeracaSaldoAction(
  slug: string,
  start: string,
  end: string
): Promise<ActionResult<NeracaSaldoRow[]>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };

  const { db, schema } = createTenantDb(slug);

  const rows = await db
    .select({
      code:        schema.accounts.code,
      name:        schema.accounts.name,
      type:        schema.accounts.type,
      totalDebit:  sql<string>`COALESCE(SUM(CASE WHEN ${schema.transactionEntries.type} = 'debit' AND ${schema.transactions.date} BETWEEN ${start}::date AND ${end}::date THEN ${schema.transactionEntries.amount}::numeric ELSE 0 END), 0)`,
      totalCredit: sql<string>`COALESCE(SUM(CASE WHEN ${schema.transactionEntries.type} = 'credit' AND ${schema.transactions.date} BETWEEN ${start}::date AND ${end}::date THEN ${schema.transactionEntries.amount}::numeric ELSE 0 END), 0)`,
    })
    .from(schema.accounts)
    .leftJoin(schema.transactionEntries, eq(schema.transactionEntries.accountId, schema.accounts.id))
    .leftJoin(schema.transactions, eq(schema.transactions.id, schema.transactionEntries.transactionId))
    .where(eq(schema.accounts.isActive, true))
    .groupBy(schema.accounts.id, schema.accounts.code, schema.accounts.name, schema.accounts.type)
    .orderBy(schema.accounts.code);

  return {
    success: true,
    data: rows.map((r) => {
      const d = parseFloat(String(r.totalDebit));
      const c = parseFloat(String(r.totalCredit));
      return { code: r.code, name: r.name, type: r.type, totalDebit: d, totalCredit: c, balance: d - c };
    }),
  };
}

/** Laporan Laba Rugi: pendapatan vs beban dalam periode */
export async function getLaporanLabaRugiAction(
  slug: string,
  start: string,
  end: string
): Promise<ActionResult<LabaRugiData>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };

  const { db, schema } = createTenantDb(slug);

  const rows = await db
    .select({
      code:        schema.accounts.code,
      name:        schema.accounts.name,
      type:        schema.accounts.type,
      totalDebit:  sql<string>`COALESCE(SUM(CASE WHEN ${schema.transactionEntries.type} = 'debit' THEN ${schema.transactionEntries.amount}::numeric ELSE 0 END), 0)`,
      totalCredit: sql<string>`COALESCE(SUM(CASE WHEN ${schema.transactionEntries.type} = 'credit' THEN ${schema.transactionEntries.amount}::numeric ELSE 0 END), 0)`,
    })
    .from(schema.accounts)
    .innerJoin(schema.transactionEntries, eq(schema.transactionEntries.accountId, schema.accounts.id))
    .innerJoin(schema.transactions, and(
      eq(schema.transactions.id, schema.transactionEntries.transactionId),
      gte(schema.transactions.date, start),
      lte(schema.transactions.date, end)
    ))
    .where(sql`${schema.accounts.type} IN ('income', 'expense') AND ${schema.accounts.isActive} = true`)
    .groupBy(schema.accounts.id, schema.accounts.code, schema.accounts.name, schema.accounts.type)
    .orderBy(schema.accounts.code);

  const result: LabaRugiRow[] = rows.map((r) => {
    const d = parseFloat(String(r.totalDebit));
    const c = parseFloat(String(r.totalCredit));
    // Income: saldo normal kredit → amount = credit - debit
    // Expense: saldo normal debit → amount = debit - credit
    const amount = r.type === "income" ? (c - d) : (d - c);
    return { code: r.code, name: r.name, type: r.type as "income" | "expense", amount };
  });

  const totalIncome  = result.filter(r => r.type === "income").reduce((s, r) => s + r.amount, 0);
  const totalExpense = result.filter(r => r.type === "expense").reduce((s, r) => s + r.amount, 0);

  return { success: true, data: { rows: result, totalIncome, totalExpense, netProfit: totalIncome - totalExpense } };
}

const SOURCE_TYPE_LABELS: Record<string, string> = {
  order:              "Penjualan Toko",
  donation:           "Donasi / Infaq",
  event_registration: "Pendaftaran Event",
  invoice:            "Tagihan",
  manual:             "Pemasukan Manual",
};

const PURPOSE_TYPE_LABELS: Record<string, string> = {
  refund:          "Pengembalian Dana",
  expense:         "Biaya Operasional",
  grant:           "Bantuan / Hibah",
  transfer:        "Transfer Internal",
  donation_payout: "Penyaluran Donasi",
  manual:          "Pengeluaran Manual",
};

/** Laporan Arus Kas: ringkasan pemasukan & pengeluaran dalam periode */
export async function getLaporanArusKasAction(
  slug: string,
  start: string,
  end: string
): Promise<ActionResult<ArusKasData>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };

  const { db, schema } = createTenantDb(slug);

  const pemasukanRows = await db
    .select({
      sourceType: schema.payments.sourceType,
      total:      sql<string>`COALESCE(SUM(${schema.payments.amount}::numeric), 0)`,
    })
    .from(schema.payments)
    .where(and(
      eq(schema.payments.status, "paid"),
      gte(schema.payments.confirmedAt, new Date(start)),
      lte(schema.payments.confirmedAt, new Date(end + "T23:59:59"))
    ))
    .groupBy(schema.payments.sourceType);

  const pengeluaranRows = await db
    .select({
      purposeType: schema.disbursements.purposeType,
      total:       sql<string>`COALESCE(SUM(${schema.disbursements.amount}::numeric), 0)`,
    })
    .from(schema.disbursements)
    .where(and(
      eq(schema.disbursements.status, "paid"),
      gte(schema.disbursements.paidAt, new Date(start)),
      lte(schema.disbursements.paidAt, new Date(end + "T23:59:59"))
    ))
    .groupBy(schema.disbursements.purposeType);

  const pemasukan: ArusKasRow[]   = pemasukanRows.map((r) => ({
    label:  SOURCE_TYPE_LABELS[r.sourceType] ?? r.sourceType,
    amount: parseFloat(String(r.total)),
  }));
  const pengeluaran: ArusKasRow[] = pengeluaranRows.map((r) => ({
    label:  PURPOSE_TYPE_LABELS[r.purposeType] ?? r.purposeType,
    amount: parseFloat(String(r.total)),
  }));

  const totalPemasukan   = pemasukan.reduce((s, r) => s + r.amount, 0);
  const totalPengeluaran = pengeluaran.reduce((s, r) => s + r.amount, 0);

  return { success: true, data: { pemasukan, pengeluaran, totalPemasukan, totalPengeluaran, saldo: totalPemasukan - totalPengeluaran } };
}

/** Buku Besar: riwayat semua transaksi per akun dalam periode */
export async function getLaporanBukuBesarAction(
  slug: string,
  accountId: string,
  start: string,
  end: string
): Promise<ActionResult<BukuBesarRow[]>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!accountId) return { success: false, error: "Pilih akun terlebih dahulu." };

  const { db, schema } = createTenantDb(slug);

  const entries = await db
    .select({
      date:            schema.transactions.date,
      referenceNumber: schema.transactions.referenceNumber,
      description:     schema.transactions.description,
      note:            schema.transactionEntries.note,
      type:            schema.transactionEntries.type,
      amount:          schema.transactionEntries.amount,
    })
    .from(schema.transactionEntries)
    .innerJoin(schema.transactions, and(
      eq(schema.transactions.id, schema.transactionEntries.transactionId),
      gte(schema.transactions.date, start),
      lte(schema.transactions.date, end)
    ))
    .where(eq(schema.transactionEntries.accountId, accountId))
    .orderBy(schema.transactions.date, schema.transactions.createdAt);

  let runningBalance = 0;
  const rows: BukuBesarRow[] = entries.map((e) => {
    const amount = parseFloat(String(e.amount));
    const debit  = e.type === "debit"  ? amount : 0;
    const credit = e.type === "credit" ? amount : 0;
    runningBalance += debit - credit;
    return {
      date:            e.date,
      referenceNumber: e.referenceNumber ?? "—",
      description:     e.description,
      note:            e.note,
      debit,
      credit,
      balance:         runningBalance,
    };
  });

  return { success: true, data: rows };
}
