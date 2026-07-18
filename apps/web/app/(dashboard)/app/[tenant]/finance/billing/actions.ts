"use server";

import { eq, and, desc, sql, count, inArray } from "drizzle-orm";
import type { InvoiceStatus } from "@jalajogja/db";
import { revalidatePath } from "next/cache";
import { createTenantDb, generateFinancialNumber } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { hasFullAccess } from "@/lib/permissions";
import { recordIncome } from "@jalajogja/db";
import { notifyWa, waAppUrl, waRupiah } from "@/lib/wa-notify";

// ─── Types ────────────────────────────────────────────────────────────────────

type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

// ─── generateEventRegNumber ───────────────────────────────────────────────────
// Sama dengan generateRegistrationNumber di event/actions.ts.
// Di-duplikasi di sini agar billing tidak bergantung ke modul event.

async function generateEventRegNumber(
  tenantDb: ReturnType<typeof createTenantDb>,
): Promise<string> {
  const { db, schema } = tenantDb;
  const now    = new Date();
  const year   = now.getFullYear();
  const month  = now.getMonth() + 1;
  const yyyymm = `${year}${String(month).padStart(2, "0")}`;

  const nextNumber = await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(schema.eventRegistrationSequences)
      .where(
        sql`${schema.eventRegistrationSequences.year}  = ${year}
        AND ${schema.eventRegistrationSequences.month} = ${month}
        FOR UPDATE`
      );

    if (rows.length === 0) {
      await tx.insert(schema.eventRegistrationSequences).values({ year, month, counter: 1 });
      return 1;
    }
    const next = rows[0].counter + 1;
    await tx
      .update(schema.eventRegistrationSequences)
      .set({ counter: next })
      .where(eq(schema.eventRegistrationSequences.id, rows[0].id));
    return next;
  });

  return `EVT-${yyyymm}-${String(nextNumber).padStart(5, "0")}`;
}

// Sama dengan formatEventDateWib di event/actions.ts — di-duplikasi agar billing
// tidak bergantung ke modul event (pola sama dengan generateEventRegNumber di atas).
function formatEventDateWib(date: Date | null): string {
  if (!date) return "-";
  return `${date.toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })} WIB`;
}

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
  revalidatePath(`/app/${slug}/finance/billing`);
  revalidatePath(`/app/${slug}/finance`);
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
        createdBy:     access.tenantUser.id,
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
  if (inv.status === "waiting_verification")
    return { success: false, error: "Ada bukti pembayaran yang sedang menunggu verifikasi — verifikasi atau tolak dulu sebelum membatalkan invoice." };
  if (parseFloat(String(inv.paidAmount)) > 0)
    return { success: false, error: "Invoice yang sudah ada pembayaran tidak bisa dibatalkan langsung. Refund dulu pembayarannya." };

  try {
    await db.transaction(async (tx) => {
      // Lock + re-cek status DI DALAM transaction — cegah race dengan customer yang submit
      // bukti pembayaran (submitPaymentProofAction) tepat di antara SELECT dan UPDATE di atas
      // (pola sama dengan lock invoice di confirmInvoicePaymentAction/verifySubmittedPaymentAction).
      const [lockedInv] = await tx
        .select({ status: schema.invoices.status, paidAmount: schema.invoices.paidAmount })
        .from(schema.invoices)
        .where(sql`${schema.invoices.id} = ${invoiceId} FOR UPDATE`)
        .limit(1);
      if (!lockedInv) throw new Error("Invoice tidak ditemukan.");
      if (lockedInv.status === "paid") throw new Error("Invoice yang sudah lunas tidak bisa dibatalkan.");
      if (lockedInv.status === "waiting_verification")
        throw new Error("Ada bukti pembayaran yang sedang menunggu verifikasi — verifikasi atau tolak dulu sebelum membatalkan invoice.");
      if (parseFloat(String(lockedInv.paidAmount)) > 0)
        throw new Error("Invoice yang sudah ada pembayaran tidak bisa dibatalkan langsung. Refund dulu pembayarannya.");

      await tx
        .update(schema.invoices)
        .set({
          status:    "cancelled",
          notes:     reason.trim() || null,
          updatedAt: new Date(),
        })
        .where(eq(schema.invoices.id, invoiceId));
    });

    revalidateBilling(slug);
    return { success: true, data: undefined };
  } catch (err) {
    if (err instanceof Error && (err.message.includes("lunas") || err.message.includes("menunggu verifikasi") || err.message.includes("Refund")))
      return { success: false, error: err.message };
    console.error("[cancelInvoiceAction]", err);
    return { success: false, error: "Gagal membatalkan invoice." };
  }
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

  try {
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

    // Kumpulkan registrasi tiket baru (dari auto-create block di bawah) untuk
    // dikirimi notifikasi WA setelah transaction selesai (side-effect di luar tx).
    const newEventRegs: Array<{
      eventId: string; regNumber: string; attendeeName: string; attendeePhone: string | null;
    }> = [];

    // Jalankan atomik dalam transaction
    const paymentId = await db.transaction(async (tx) => {
      // Lock baris invoice — cegah race condition klik ganda / retry menghasilkan
      // dua payment untuk satu konfirmasi (pattern sama dengan lock kuota tiket event)
      const [lockedInv] = await tx
        .select()
        .from(schema.invoices)
        .where(sql`${schema.invoices.id} = ${invoiceId} FOR UPDATE`)
        .limit(1);

      if (!lockedInv) throw new Error("Invoice tidak ditemukan.");
      if (lockedInv.status === "paid")      throw new Error("Invoice sudah lunas.");
      if (lockedInv.status === "cancelled") throw new Error("Invoice dibatalkan.");

      const total      = parseFloat(String(lockedInv.total));
      const uniqueCode = lockedInv.uniqueCode ?? 0;
      const amountDue  = total + uniqueCode;
      const paidSoFar  = parseFloat(String(lockedInv.paidAmount));
      const remaining  = amountDue - paidSoFar;

      if (data.amount > remaining)
        throw new Error(`Jumlah melebihi sisa tagihan (Rp ${remaining.toLocaleString("id-ID")}).`);

      const newPaidAmount = paidSoFar + data.amount;
      const newStatus     = newPaidAmount >= amountDue ? "paid" : "partial";

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
          confirmedBy:  access.tenantUser.id,
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
          createdBy:       access.tenantUser.id,
          amount:          total,
          cashAccountId,
          incomeAccountId,
        });

        // Sync collected_amount kampanye donasi dari cart
        const donationItems = await tx
          .select({ itemId: schema.invoiceItems.itemId, total: schema.invoiceItems.total })
          .from(schema.invoiceItems)
          .where(and(
            eq(schema.invoiceItems.invoiceId, invoiceId),
            eq(schema.invoiceItems.itemType, "donation"),
          ));
        const campaignAmounts: Record<string, number> = {};
        for (const it of donationItems) {
          if (it.itemId) campaignAmounts[it.itemId] = (campaignAmounts[it.itemId] ?? 0) + parseFloat(String(it.total));
        }
        for (const [cId, amt] of Object.entries(campaignAmounts)) {
          await tx.update(schema.campaigns).set({ collectedAmount: sql`collected_amount + ${String(amt)}` }).where(eq(schema.campaigns.id, cId));
        }

        // Konfirmasi pendaftaran event jika invoice terhubung ke event_registration (alur lama)
        if (inv.sourceType === "event_registration" && inv.sourceId) {
          await tx
            .update(schema.eventRegistrations)
            .set({ status: "confirmed", updatedAt: new Date() })
            .where(eq(schema.eventRegistrations.id, inv.sourceId));
        }

        // Auto-create event_registrations dari tiket yang dibeli via cart.
        // WAJIB skip untuk sourceType="event_registration" — alur lama (registerForEventAction)
        // sudah insert eventRegistrations langsung sebelum invoice dibuat dan statusnya
        // di-update di blok di atas. Tanpa guard ini, invoice yang sama juga punya
        // invoiceItem itemType="ticket" → loop ini insert DUPLIKAT dengan nama = nama tiket
        // (bukan nama peserta asli), karena description item itu tidak diisi JSON attendee.
        const ticketItems = inv.sourceType === "cart" ? await tx
          .select({
            itemId:      schema.invoiceItems.itemId,
            name:        schema.invoiceItems.name,
            description: schema.invoiceItems.description,
          })
          .from(schema.invoiceItems)
          .where(and(
            eq(schema.invoiceItems.invoiceId, invoiceId),
            eq(schema.invoiceItems.itemType, "ticket"),
          )) : [];

        for (const item of ticketItems) {
          if (!item.itemId) continue;

          const [existing] = await tx
            .select({ id: schema.eventRegistrations.id })
            .from(schema.eventRegistrations)
            .where(and(
              eq(schema.eventRegistrations.ticketId, item.itemId),
              sql`${schema.eventRegistrations.customFields}->>'sourceInvoiceId' = ${invoiceId}`,
            ))
            .limit(1);
          if (existing) continue;

          let attendeeName  = item.name ?? "Peserta";
          let attendeePhone: string | null = null;
          let attendeeEmail: string | null = null;
          let extraFields:   Record<string, unknown> | null = null;
          try {
            const p = JSON.parse(item.description ?? "{}") as Record<string, unknown>;
            attendeeName  = String(p.attendeeName ?? item.name ?? "Peserta").trim();
            attendeePhone = p.attendeePhone ? String(p.attendeePhone) : null;
            attendeeEmail = p.attendeeEmail ? String(p.attendeeEmail) : null;
            extraFields   = p.customFieldAnswers ? (p.customFieldAnswers as Record<string, unknown>) : null;
          } catch { /* gunakan default */ }

          const [ticket] = await tx
            .select({ eventId: schema.eventTickets.eventId })
            .from(schema.eventTickets)
            .where(eq(schema.eventTickets.id, item.itemId))
            .limit(1);
          if (!ticket?.eventId) continue;

          const regNumber = await generateEventRegNumber(tenantDb);

          await tx.insert(schema.eventRegistrations).values({
            eventId:            ticket.eventId,
            ticketId:           item.itemId,
            memberId:           inv.memberId ?? null,
            profileId:          inv.profileId ?? null,
            attendeeName,
            attendeePhone,
            attendeeEmail,
            registrationNumber: regNumber,
            status:             "confirmed",
            customFields:       { sourceInvoiceId: invoiceId, ...(extraFields ?? {}) },
          });

          newEventRegs.push({ eventId: ticket.eventId, regNumber, attendeeName, attendeePhone });
        }
      }

      return payment.id;
    });

    void notifyWa({
      slug, tenantDb, event: "payment_confirmed",
      phone: inv.customerPhone,
      vars: {
        name:          inv.customerName,
        invoiceNumber: inv.invoiceNumber,
        amount:        waRupiah(data.amount),
      },
    });

    // Notifikasi tiket event baru yang ter-auto-create dari cart — titik pertama
    // customer dapat nomor registrasi. Lookup detail event per registrasi (biasanya 1).
    for (const reg of newEventRegs) {
      const [eventDetail] = await db
        .select({
          title:    schema.events.title,
          slug:     schema.events.slug,
          startsAt: schema.events.startsAt,
          location: schema.events.location,
        })
        .from(schema.events)
        .where(eq(schema.events.id, reg.eventId))
        .limit(1);
      if (!eventDetail) continue;

      const eventUrl = await waAppUrl(slug, `/agenda/${eventDetail.slug}`);
      void notifyWa({
        slug, tenantDb, event: "event_registered",
        phone: reg.attendeePhone,
        vars: {
          name:      reg.attendeeName,
          eventName: eventDetail.title,
          eventDate: formatEventDateWib(eventDetail.startsAt),
          location:  eventDetail.location ?? "-",
          regNumber: reg.regNumber,
          eventUrl,
        },
      });
    }

    revalidateBilling(slug);
    return { success: true, data: { paymentId } };
  } catch (err) {
    if (err instanceof Error && (err.message.includes("lunas") || err.message.includes("dibatalkan") || err.message.includes("melebihi sisa tagihan")))
      return { success: false, error: err.message };
    console.error("[confirmInvoicePaymentAction]", err);
    return { success: false, error: "Gagal mencatat pembayaran." };
  }
}

// ─── rejectPaymentAction ──────────────────────────────────────────────────────
// Admin tolak bukti pembayaran yang di-submit customer → status rejected, invoice kembali ke pending

export async function rejectPaymentAction(
  slug:      string,
  paymentId: string,
  reason:    string,
): Promise<ActionResult<void>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "keuangan"))
    return { success: false, error: "Akses ditolak." };

  if (!reason?.trim())
    return { success: false, error: "Alasan penolakan wajib diisi." };

  const tenantDb = createTenantDb(slug);
  const { db, schema } = tenantDb;

  const [payment] = await db
    .select({ id: schema.payments.id, status: schema.payments.status })
    .from(schema.payments)
    .where(eq(schema.payments.id, paymentId))
    .limit(1);

  if (!payment)                       return { success: false, error: "Pembayaran tidak ditemukan." };
  if (payment.status === "paid")      return { success: false, error: "Pembayaran sudah dikonfirmasi, tidak bisa ditolak." };
  if (payment.status === "rejected")  return { success: false, error: "Pembayaran sudah ditolak sebelumnya." };
  if (payment.status !== "submitted") return { success: false, error: "Hanya bisa menolak bukti yang sudah di-submit customer." };

  // Cari invoice terkait via invoice_payments (join langsung untuk dapat data notifikasi)
  const [invLink] = await db
    .select({
      invoiceId:     schema.invoicePayments.invoiceId,
      customerName:  schema.invoices.customerName,
      customerPhone: schema.invoices.customerPhone,
      invoiceNumber: schema.invoices.invoiceNumber,
      paidAmount:    schema.invoices.paidAmount,
    })
    .from(schema.invoicePayments)
    .innerJoin(schema.invoices, eq(schema.invoices.id, schema.invoicePayments.invoiceId))
    .where(eq(schema.invoicePayments.paymentId, paymentId))
    .limit(1);

  try {
    await db.transaction(async (tx) => {
      // Lock payment DULU — cegah race dengan verifySubmittedPaymentAction (atau tolak ganda)
      // pada payment yang sama (klik ganda, dua admin/tab berbeda).
      const [lockedPayment] = await tx
        .select({ status: schema.payments.status })
        .from(schema.payments)
        .where(sql`${schema.payments.id} = ${paymentId} FOR UPDATE`)
        .limit(1);
      if (!lockedPayment || lockedPayment.status !== "submitted")
        throw new Error("Pembayaran sudah diproses sebelumnya (mungkin baru saja diverifikasi/ditolak admin lain).");

      // Tolak payment
      await tx
        .update(schema.payments)
        .set({
          status:        "rejected",
          rejectedBy:    access.tenantUser.id,
          rejectedAt:    new Date(),
          rejectionNote: reason.trim(),
          updatedAt:     new Date(),
        })
        .where(eq(schema.payments.id, paymentId));

      // Kembalikan invoice ke status semula agar customer bisa upload ulang — "partial" kalau
      // sudah ada pembayaran terkonfirmasi sebelumnya (paidAmount > 0), "pending" kalau belum
      // sama sekali. Jangan selalu "pending" — invoice yang sudah punya history partial payment
      // tidak boleh kehilangan status itu hanya karena SATU submission tambahan ditolak.
      if (invLink?.invoiceId) {
        const [otherSubmitted] = await tx
          .select({ id: schema.payments.id })
          .from(schema.invoicePayments)
          .innerJoin(schema.payments, eq(schema.invoicePayments.paymentId, schema.payments.id))
          .where(and(
            eq(schema.invoicePayments.invoiceId, invLink.invoiceId),
            eq(schema.payments.status, "submitted"),
          ))
          .limit(1);

        if (!otherSubmitted) {
          // Baca ulang paidAmount DI DALAM tx (bukan pakai invLink.paidAmount yang direkam
          // sebelum transaction) — hindari status revert salah kalau ada confirmInvoicePaymentAction
          // lain yang mengubah paidAmount konkuren dengan reject ini.
          const [freshInv] = await tx
            .select({ paidAmount: schema.invoices.paidAmount })
            .from(schema.invoices)
            .where(eq(schema.invoices.id, invLink.invoiceId))
            .limit(1);
          const revertStatus = parseFloat(String(freshInv?.paidAmount ?? 0)) > 0 ? "partial" : "pending";
          await tx
            .update(schema.invoices)
            .set({ status: revertStatus, updatedAt: new Date() })
            .where(eq(schema.invoices.id, invLink.invoiceId));
        }
      }
    });

    if (invLink) {
      void notifyWa({
        slug, tenantDb, event: "payment_rejected",
        phone: invLink.customerPhone,
        vars: {
          name:          invLink.customerName,
          invoiceNumber: invLink.invoiceNumber,
          reason:        reason.trim(),
        },
      });
    }

    revalidateBilling(slug);
    return { success: true, data: undefined };
  } catch (err) {
    if (err instanceof Error && err.message.includes("sudah diproses"))
      return { success: false, error: err.message };
    console.error("[rejectPaymentAction]", err);
    return { success: false, error: "Gagal menolak bukti pembayaran." };
  }
}

// ─── updatePaymentEvidenceAction ─────────────────────────────────────────────
// Admin edit bukti transfer + metadata payment yang SUDAH ADA — untuk kasus bukti
// gagal terlampir (mis. bug upload HEIC lama) atau data pengirim salah ketik.
//
// Nominal HANYA bisa diedit jika status payment BUKAN "paid". Payment yang sudah
// dikonfirmasi (paid) sudah tercatat di invoice.paidAmount DAN jurnal double-entry
// (recordIncome memakai invoice.total saat invoice lunas, bukan payment.amount per
// baris) — mengubah payment.amount setelah itu membuat data tidak sinkron dengan
// buku besar tanpa ada mekanisme koreksi jurnal. Lihat CLAUDE.md § "BUG KRITIS:
// signed_at DEFAULT NOW()" dan lesson double-entry lain — prinsip yang sama: field
// yang sudah jadi bagian dari catatan resmi (di sini: jurnal) tidak boleh diubah
// diam-diam dari jalur lain.
//
// Bukti transfer (proofUrl) dan metadata (nama/bank/tanggal/catatan) SELALU aman
// diedit di status manapun — murni evidentiary, tidak pernah dipakai untuk hitung
// apapun di ledger.

export type UpdatePaymentEvidenceData = {
  amount?:       number;
  proofUrl?:     string | null;
  payerName?:    string;
  payerBank?:    string;
  transferDate?: string;
  payerNote?:    string;
};

export async function updatePaymentEvidenceAction(
  slug:      string,
  paymentId: string,
  data:      UpdatePaymentEvidenceData,
): Promise<ActionResult<void>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "keuangan"))
    return { success: false, error: "Akses ditolak." };

  const tenantDb = createTenantDb(slug);
  const { db, schema } = tenantDb;

  const [payment] = await db
    .select({ id: schema.payments.id, status: schema.payments.status })
    .from(schema.payments)
    .where(eq(schema.payments.id, paymentId))
    .limit(1);

  if (!payment) return { success: false, error: "Pembayaran tidak ditemukan." };

  if (data.amount !== undefined) {
    if (!data.amount || data.amount <= 0)
      return { success: false, error: "Nominal harus lebih dari 0." };
    if (payment.status === "paid")
      return {
        success: false,
        error: "Nominal pembayaran yang sudah dikonfirmasi tidak bisa diubah — sudah tercatat di buku besar keuangan.",
      };
  }

  try {
    const updateSet: Record<string, unknown> = { updatedAt: new Date() };
    if (data.amount       !== undefined) updateSet.amount       = data.amount.toFixed(2);
    if (data.proofUrl     !== undefined) updateSet.proofUrl     = data.proofUrl;
    if (data.payerName    !== undefined) updateSet.payerName    = data.payerName.trim() || null;
    if (data.payerBank    !== undefined) updateSet.payerBank    = data.payerBank.trim() || null;
    if (data.transferDate !== undefined) updateSet.transferDate = data.transferDate || null;
    if (data.payerNote    !== undefined) updateSet.payerNote    = data.payerNote.trim() || null;

    await db.transaction(async (tx) => {
      // Re-cek status DI DALAM transaction (setelah lock) hanya kalau nominal ikut diedit —
      // guard di atas (sebelum tx) hanya early-exit UX, race window nyata: admin buka form Edit
      // saat status masih "submitted", lalu admin lain memverifikasi (→ "paid") sebelum form ini
      // disimpan. Field lain (proof/metadata) aman diedit di status manapun, tidak perlu lock.
      if (data.amount !== undefined) {
        const [lockedPayment] = await tx
          .select({ status: schema.payments.status })
          .from(schema.payments)
          .where(sql`${schema.payments.id} = ${paymentId} FOR UPDATE`)
          .limit(1);
        if (!lockedPayment) throw new Error("Pembayaran tidak ditemukan.");
        if (lockedPayment.status === "paid")
          throw new Error("Nominal pembayaran yang sudah dikonfirmasi tidak bisa diubah — sudah tercatat di buku besar keuangan.");
      }

      await tx.update(schema.payments).set(updateSet).where(eq(schema.payments.id, paymentId));

      // Sinkronkan invoice_payments.amount juga — cegah nilai basi tersisa di tabel
      // junction (pola sama dengan verifySubmittedPaymentAction saat admin koreksi
      // nominal di titik verifikasi).
      if (data.amount !== undefined) {
        await tx
          .update(schema.invoicePayments)
          .set({ amount: data.amount.toFixed(2) })
          .where(eq(schema.invoicePayments.paymentId, paymentId));
      }
    });

    revalidateBilling(slug);
    return { success: true, data: undefined };
  } catch (err) {
    if (err instanceof Error && (err.message.includes("tercatat di buku besar") || err.message.includes("tidak ditemukan")))
      return { success: false, error: err.message };
    console.error("[updatePaymentEvidenceAction]", err);
    return { success: false, error: "Gagal menyimpan perubahan." };
  }
}

// ─── verifySubmittedPaymentAction ────────────────────────────────────────────
// Admin verifikasi payment yang di-submit customer → status confirmed, update paid_amount invoice

export async function verifySubmittedPaymentAction(
  slug:           string,
  paymentId:      string,
  verifiedAmount: number,   // WAJIB — admin bisa koreksi dari nominal yang customer submit, lihat docs/arsitektur-billing.md § "Nominal Pembayaran Terlihat + Bisa Diedit"
): Promise<ActionResult<void>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "keuangan"))
    return { success: false, error: "Akses ditolak." };

  if (!verifiedAmount || verifiedAmount <= 0)
    return { success: false, error: "Nominal terverifikasi harus lebih dari 0." };

  const tenantDb = createTenantDb(slug);
  const { db, schema } = tenantDb;

  // Fetch payment + invoice — HANYA early-exit UX cepat + ambil payment.method untuk resolve
  // mapping akun. Jaminan korektnes sebenarnya ada di lock+recheck di dalam transaction di
  // bawah (pola sama dengan checkoutAction/confirmInvoicePaymentAction — lihat lesson CLAUDE.md
  // "guard sudah ada sebelumnya WAJIB diulang di dalam transaction setelah lock").
  const [payment] = await db
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.id, paymentId))
    .limit(1);

  if (!payment)                         return { success: false, error: "Pembayaran tidak ditemukan." };
  if (payment.status === "paid")        return { success: false, error: "Pembayaran sudah diverifikasi." };
  if (payment.status !== "submitted")   return { success: false, error: "Pembayaran belum di-submit customer." };
  if (payment.sourceType !== "invoice") return { success: false, error: "Bukan pembayaran invoice." };
  if (!payment.sourceId)                return { success: false, error: "Invoice tidak ditemukan." };

  const [invEarly] = await db
    .select({ id: schema.invoices.id, status: schema.invoices.status })
    .from(schema.invoices)
    .where(eq(schema.invoices.id, payment.sourceId))
    .limit(1);

  if (!invEarly)                       return { success: false, error: "Invoice tidak ditemukan." };
  if (invEarly.status === "paid")      return { success: false, error: "Invoice sudah lunas." };
  if (invEarly.status === "cancelled") return { success: false, error: "Invoice sudah dibatalkan." };

  // Resolve akun untuk jurnal
  const { resolveAccountMappingsForBilling } = await import("../actions");
  const { cashAccountId, incomeAccountId } = await resolveAccountMappingsForBilling(
    tenantDb, payment.method as "cash" | "transfer" | "qris", "manual",
  );

  if (!cashAccountId || !incomeAccountId) {
    return {
      success: false,
      error: "Konfigurasi mapping akun belum lengkap. Atur di menu Akun → Pengaturan Mapping.",
    };
  }

  // Kumpulkan registrasi tiket baru (dari auto-create block di bawah) untuk
  // dikirimi notifikasi WA setelah transaction selesai (side-effect di luar tx).
  const newEventRegs: Array<{
    eventId: string; regNumber: string; attendeeName: string; attendeePhone: string | null;
  }> = [];

  // Diisi dari dalam transaction (data invoice yang sudah dikunci) — dipakai untuk notifikasi
  // WA setelah commit, tanpa perlu baca ulang invoice di luar tx.
  let notifyCustomerName  = "";
  let notifyCustomerPhone: string | null = null;
  let notifyInvoiceNumber = "";

  try {
    await db.transaction(async (tx) => {
      // Lock payment DULU — cegah race dengan rejectPaymentAction (atau verify ganda) pada
      // payment yang sama (klik ganda, dua admin/tab berbeda memproses submission yang sama).
      const [lockedPayment] = await tx
        .select({ status: schema.payments.status })
        .from(schema.payments)
        .where(sql`${schema.payments.id} = ${paymentId} FOR UPDATE`)
        .limit(1);
      if (!lockedPayment || lockedPayment.status !== "submitted")
        throw new Error("Pembayaran sudah diproses sebelumnya (mungkin baru saja diverifikasi/ditolak admin lain).");

      // Lock invoice — cegah race pada invoice.paidAmount dengan confirmInvoicePaymentAction /
      // checkoutAction / payment lain di invoice yang sama (pola sama dengan lock invoice di
      // confirmInvoicePaymentAction).
      const [inv] = await tx
        .select()
        .from(schema.invoices)
        .where(sql`${schema.invoices.id} = ${payment.sourceId} FOR UPDATE`)
        .limit(1);
      if (!inv)                       throw new Error("Invoice tidak ditemukan.");
      if (inv.status === "paid")      throw new Error("Invoice sudah lunas.");
      if (inv.status === "cancelled") throw new Error("Invoice sudah dibatalkan.");

      notifyCustomerName  = inv.customerName;
      notifyCustomerPhone = inv.customerPhone;
      notifyInvoiceNumber = inv.invoiceNumber;

      const paidSoFar  = parseFloat(String(inv.paidAmount));
      const total      = parseFloat(String(inv.total));
      const uniqueCode = inv.uniqueCode ?? 0;
      const amountDue  = total + uniqueCode;
      const newPaid    = paidSoFar + verifiedAmount;
      const newStatus  = newPaid >= amountDue ? "paid" : "partial";

      // Konfirmasi payment — amount di-update ke nominal yang admin verifikasi (bisa beda
      // dari yang customer submit, lihat docs/arsitektur-billing.md § "Nominal Pembayaran
      // Terlihat + Bisa Diedit")
      await tx
        .update(schema.payments)
        .set({
          amount:      verifiedAmount.toFixed(2),
          status:      "paid",
          confirmedBy: access.tenantUser.id,
          confirmedAt: new Date(),
          updatedAt:   new Date(),
        })
        .where(eq(schema.payments.id, paymentId));

      // invoice_payments ikut disesuaikan supaya konsisten dengan payments.amount di atas
      await tx
        .update(schema.invoicePayments)
        .set({ amount: verifiedAmount.toFixed(2) })
        .where(and(
          eq(schema.invoicePayments.invoiceId, inv.id),
          eq(schema.invoicePayments.paymentId, paymentId),
        ));

      // Update invoice paid_amount + status
      await tx
        .update(schema.invoices)
        .set({
          paidAmount: newPaid.toFixed(2),
          status:     newStatus,
          updatedAt:  new Date(),
        })
        .where(eq(schema.invoices.id, inv.id));

      // Jurnal double-entry saat lunas
      if (newStatus === "paid") {
        const txNum = await generateFinancialNumber(tenantDb, "journal");
        await recordIncome(tenantDb, {
          date:            new Date().toISOString().slice(0, 10),
          description:     `Pelunasan invoice ${inv.invoiceNumber}`,
          referenceNumber: txNum,
          createdBy:       access.tenantUser.id,
          amount:          total,
          cashAccountId,
          incomeAccountId,
        });

        // Sync collected_amount kampanye donasi dari cart
        const donationItems = await tx
          .select({ itemId: schema.invoiceItems.itemId, total: schema.invoiceItems.total })
          .from(schema.invoiceItems)
          .where(and(
            eq(schema.invoiceItems.invoiceId, inv.id),
            eq(schema.invoiceItems.itemType, "donation"),
          ));
        const campaignAmounts: Record<string, number> = {};
        for (const it of donationItems) {
          if (it.itemId) campaignAmounts[it.itemId] = (campaignAmounts[it.itemId] ?? 0) + parseFloat(String(it.total));
        }
        for (const [cId, amt] of Object.entries(campaignAmounts)) {
          await tx.update(schema.campaigns).set({ collectedAmount: sql`collected_amount + ${String(amt)}` }).where(eq(schema.campaigns.id, cId));
        }

        // Konfirmasi pendaftaran event jika invoice terhubung ke event_registration (alur lama)
        if (inv.sourceType === "event_registration" && inv.sourceId) {
          await tx
            .update(schema.eventRegistrations)
            .set({ status: "confirmed", updatedAt: new Date() })
            .where(eq(schema.eventRegistrations.id, inv.sourceId));
        }

        // Auto-create event_registrations dari tiket yang dibeli via cart (E10 flow).
        // Skip untuk sourceType="event_registration" — sudah ditangani blok di atas.
        // Lihat komentar sama di confirmInvoicePaymentAction untuk alasan lengkap.
        const ticketItems = inv.sourceType === "cart" ? await tx
          .select({
            itemId:      schema.invoiceItems.itemId,
            name:        schema.invoiceItems.name,
            description: schema.invoiceItems.description,
          })
          .from(schema.invoiceItems)
          .where(and(
            eq(schema.invoiceItems.invoiceId, inv.id),
            eq(schema.invoiceItems.itemType, "ticket"),
          )) : [];

        for (const item of ticketItems) {
          if (!item.itemId) continue;

          const [existing] = await tx
            .select({ id: schema.eventRegistrations.id })
            .from(schema.eventRegistrations)
            .where(and(
              eq(schema.eventRegistrations.ticketId, item.itemId),
              sql`${schema.eventRegistrations.customFields}->>'sourceInvoiceId' = ${inv.id}`,
            ))
            .limit(1);
          if (existing) continue;

          let attendeeName  = item.name ?? "Peserta";
          let attendeePhone: string | null = null;
          let attendeeEmail: string | null = null;
          let extraFields:   Record<string, unknown> | null = null;
          try {
            const p = JSON.parse(item.description ?? "{}") as Record<string, unknown>;
            attendeeName  = String(p.attendeeName ?? item.name ?? "Peserta").trim();
            attendeePhone = p.attendeePhone ? String(p.attendeePhone) : null;
            attendeeEmail = p.attendeeEmail ? String(p.attendeeEmail) : null;
            extraFields   = p.customFieldAnswers ? (p.customFieldAnswers as Record<string, unknown>) : null;
          } catch { /* gunakan default */ }

          const [ticket] = await tx
            .select({ eventId: schema.eventTickets.eventId })
            .from(schema.eventTickets)
            .where(eq(schema.eventTickets.id, item.itemId))
            .limit(1);
          if (!ticket?.eventId) continue;

          const regNumber = await generateEventRegNumber(tenantDb);

          await tx.insert(schema.eventRegistrations).values({
            eventId:            ticket.eventId,
            ticketId:           item.itemId,
            memberId:           inv.memberId ?? null,
            profileId:          inv.profileId ?? null,
            attendeeName,
            attendeePhone,
            attendeeEmail,
            registrationNumber: regNumber,
            status:             "confirmed",
            customFields:       { sourceInvoiceId: inv.id, ...(extraFields ?? {}) },
          });

          newEventRegs.push({ eventId: ticket.eventId, regNumber, attendeeName, attendeePhone });
        }
      }
    });

    for (const reg of newEventRegs) {
      const [eventDetail] = await db
        .select({
          title:    schema.events.title,
          slug:     schema.events.slug,
          startsAt: schema.events.startsAt,
          location: schema.events.location,
        })
        .from(schema.events)
        .where(eq(schema.events.id, reg.eventId))
        .limit(1);
      if (!eventDetail) continue;

      const eventUrl = await waAppUrl(slug, `/agenda/${eventDetail.slug}`);
      void notifyWa({
        slug, tenantDb, event: "event_registered",
        phone: reg.attendeePhone,
        vars: {
          name:      reg.attendeeName,
          eventName: eventDetail.title,
          eventDate: formatEventDateWib(eventDetail.startsAt),
          location:  eventDetail.location ?? "-",
          regNumber: reg.regNumber,
          eventUrl,
        },
      });
    }

    void notifyWa({
      slug, tenantDb, event: "payment_confirmed",
      phone: notifyCustomerPhone,
      vars: {
        name:          notifyCustomerName,
        invoiceNumber: notifyInvoiceNumber,
        amount:        waRupiah(verifiedAmount),
      },
    });

    revalidateBilling(slug);
    return { success: true, data: undefined };
  } catch (err) {
    if (err instanceof Error && (err.message.includes("sudah diproses") || err.message.includes("lunas") || err.message.includes("dibatalkan")))
      return { success: false, error: err.message };
    console.error("[verifySubmittedPaymentAction]", err);
    return { success: false, error: "Gagal memverifikasi pembayaran." };
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
      .where(inArray(schema.invoiceItems.invoiceId, ids))
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
  uniqueCode:    number;
  amountDue:     number;
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
    id:            string;
    amount:        number;
    method:        string;
    status:        string;
    payerName:     string | null;
    payerBank:     string | null;
    payerNote:     string | null;
    transferDate:  string | null;
    proofUrl:      string | null;
    rejectionNote: string | null;
    createdAt:     string;
  }[];
  shippingLines: {
    id:             string;
    sellerType:     "tenant" | "mitra";
    sellerName:     string;
    courier:        string;
    service:        string;
    etd:            string | null;
    cost:           number;
    trackingNumber: string | null;
    shippedAt:      string | null;
    status:         "pending" | "processing" | "packed" | "shipped" | "delivered";
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

  const [items, paymentLinks, shippingRows] = await Promise.all([
    db
      .select()
      .from(schema.invoiceItems)
      .where(eq(schema.invoiceItems.invoiceId, invoiceId))
      .orderBy(schema.invoiceItems.sortOrder),

    db
      .select({
        id:            schema.payments.id,
        amount:        schema.invoicePayments.amount,
        method:        schema.payments.method,
        status:        schema.payments.status,
        payerName:     schema.payments.payerName,
        payerBank:     schema.payments.payerBank,
        payerNote:     schema.payments.payerNote,
        transferDate:  schema.payments.transferDate,
        proofUrl:      schema.payments.proofUrl,
        rejectionNote: schema.payments.rejectionNote,
        createdAt:     schema.payments.createdAt,
      })
      .from(schema.invoicePayments)
      .innerJoin(schema.payments, eq(schema.invoicePayments.paymentId, schema.payments.id))
      .where(eq(schema.invoicePayments.invoiceId, invoiceId))
      .orderBy(desc(schema.payments.createdAt)),

    db
      .select()
      .from(schema.invoiceShippingLines)
      .where(eq(schema.invoiceShippingLines.invoiceId, invoiceId)),
  ]);

  const total      = parseFloat(String(inv.total));
  const uniqueCode = inv.uniqueCode ?? 0;
  const amountDue  = total + uniqueCode;
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
      uniqueCode,
      amountDue,
      paidAmount,
      remaining:     Math.max(0, amountDue - paidAmount),
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
        id:            p.id,
        amount:        parseFloat(String(p.amount)),
        method:        p.method,
        status:        p.status,
        payerName:     p.payerName ?? null,
        payerBank:     p.payerBank ?? null,
        payerNote:     p.payerNote ?? null,
        transferDate:  p.transferDate ?? null,
        proofUrl:      p.proofUrl ?? null,
        rejectionNote: p.rejectionNote ?? null,
        createdAt:     p.createdAt.toISOString(),
      })),
      shippingLines: shippingRows.map((sl) => ({
        id:             sl.id,
        sellerType:     sl.sellerType as "tenant" | "mitra",
        sellerName:     sl.sellerName,
        courier:        sl.courier,
        service:        sl.service,
        etd:            sl.etd ?? null,
        cost:           parseFloat(String(sl.cost)),
        trackingNumber: sl.trackingNumber ?? null,
        shippedAt:      sl.shippedAt?.toISOString() ?? null,
        status:         sl.status as "pending" | "processing" | "packed" | "shipped" | "delivered",
      })),
    },
  };
}

// ─── updateAdminShippingTrackingAction ────────────────────────────────────────
// Admin input resi untuk pengiriman tenant (seller_type='tenant').

export async function updateAdminShippingTrackingAction(
  slug:           string,
  shippingLineId: string,
  trackingNumber: string,
): Promise<ActionResult<void>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };

  const { db, schema } = createTenantDb(slug);

  const [line] = await db
    .select({ id: schema.invoiceShippingLines.id, sellerType: schema.invoiceShippingLines.sellerType })
    .from(schema.invoiceShippingLines)
    .where(eq(schema.invoiceShippingLines.id, shippingLineId))
    .limit(1);

  if (!line) return { success: false, error: "Data pengiriman tidak ditemukan." };
  if (line.sellerType !== "tenant") return { success: false, error: "Pengiriman mitra dikelola oleh mitra." };

  const resi = trackingNumber.trim();

  await db
    .update(schema.invoiceShippingLines)
    .set({
      trackingNumber: resi || null,
      shippedAt:      resi ? new Date() : null,
      status:         resi ? "shipped" : "pending",
      updatedAt:      new Date(),
    })
    .where(eq(schema.invoiceShippingLines.id, shippingLineId));

  revalidateBilling(slug);
  return { success: true, data: undefined };
}

// ─── updateFulfillmentStatusAction ───────────────────────────────────────────
// Majukan status pengiriman tenant sesuai alur: pending→processing→packed→shipped→delivered.
// Shipped wajib ada trackingNumber. Delivered: set deliveredAt.

const FULFILLMENT_ORDER: Record<string, number> = {
  pending: 0, processing: 1, packed: 2, shipped: 3, delivered: 4,
};

export async function updateFulfillmentStatusAction(
  slug:           string,
  shippingLineId: string,
  newStatus:      "processing" | "packed" | "shipped" | "delivered",
  trackingNumber?: string,
): Promise<ActionResult<void>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };

  const tenantDb = createTenantDb(slug);
  const { db, schema } = tenantDb;

  const [line] = await db
    .select({
      id:             schema.invoiceShippingLines.id,
      invoiceId:      schema.invoiceShippingLines.invoiceId,
      sellerType:     schema.invoiceShippingLines.sellerType,
      status:         schema.invoiceShippingLines.status,
      trackingNumber: schema.invoiceShippingLines.trackingNumber,
      courier:        schema.invoiceShippingLines.courier,
    })
    .from(schema.invoiceShippingLines)
    .where(eq(schema.invoiceShippingLines.id, shippingLineId))
    .limit(1);

  if (!line) return { success: false, error: "Data pengiriman tidak ditemukan." };
  if (line.sellerType !== "tenant") return { success: false, error: "Pengiriman mitra dikelola oleh mitra." };

  // Cek invoice sudah lunas sebelum mulai proses
  const [inv] = await db
    .select({
      status:        schema.invoices.status,
      invoiceNumber: schema.invoices.invoiceNumber,
      customerName:  schema.invoices.customerName,
      customerPhone: schema.invoices.customerPhone,
    })
    .from(schema.invoices)
    .where(eq(schema.invoices.id, line.invoiceId))
    .limit(1);

  if (!inv) return { success: false, error: "Invoice tidak ditemukan." };
  if (inv.status !== "paid") return { success: false, error: "Pesanan hanya bisa diproses setelah pembayaran lunas." };

  // Validasi transisi — hanya boleh maju satu langkah
  const currentOrder = FULFILLMENT_ORDER[line.status] ?? 0;
  const newOrder     = FULFILLMENT_ORDER[newStatus]   ?? 0;
  if (newOrder !== currentOrder + 1) {
    return { success: false, error: "Urutan status tidak valid." };
  }

  let resolvedTrackingNumber = line.trackingNumber ?? "";

  if (newStatus === "shipped") {
    const resi = (trackingNumber ?? "").trim() || (line.trackingNumber ?? "");
    if (!resi) return { success: false, error: "Nomor resi wajib diisi sebelum mengubah status ke Dikirim." };
    resolvedTrackingNumber = resi;
    await db
      .update(schema.invoiceShippingLines)
      .set({ status: "shipped", trackingNumber: resi, shippedAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.invoiceShippingLines.id, shippingLineId));
  } else if (newStatus === "delivered") {
    await db
      .update(schema.invoiceShippingLines)
      .set({ status: "delivered", deliveredAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.invoiceShippingLines.id, shippingLineId));
  } else {
    await db
      .update(schema.invoiceShippingLines)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(schema.invoiceShippingLines.id, shippingLineId));
  }

  // Notifikasi WA — hanya untuk stage yang punya template (processing/shipped/delivered, bukan packed)
  const waEvent = newStatus === "processing" ? "order_processing"
                : newStatus === "shipped"    ? "order_shipped"
                : newStatus === "delivered"  ? "order_delivered"
                : null;

  if (waEvent) {
    void (async () => {
      const trackingUrl = await waAppUrl(slug, `/invoice/${line.invoiceId}`);
      void notifyWa({
        slug, tenantDb, event: waEvent,
        phone: inv.customerPhone,
        vars: {
          name:            inv.customerName,
          orderNumber:     inv.invoiceNumber,
          courier:         line.courier.toUpperCase(),
          trackingNumber:  resolvedTrackingNumber,
          trackingUrl,
        },
      });
    })();
  }

  revalidateBilling(slug);
  revalidatePath(`/app/${slug}/toko/pesanan`);
  return { success: true, data: undefined };
}
