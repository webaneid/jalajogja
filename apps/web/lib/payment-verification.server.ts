import "server-only";
import { eq, and, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  createTenantDb, generateFinancialNumber, settleInstallmentSchedules, recordIncomeSplit,
  decrementStockForInvoiceItems, getProductInvoiceItems,
} from "@jalajogja/db";
import { notifyWa, waAppUrl, waRupiah } from "@/lib/wa-notify";
import { createEventRegistrationsFromInvoiceTickets } from "@/lib/event-registration-sync.server";
import { getTenantTimezone, formatInTz, tzLabel, todayInTz } from "@/lib/tenant-timezone.server";
import { activateForumMembership } from "@/lib/forum-activation.server";

// SATU-SATUNYA implementasi "verifikasi pembayaran yang di-submit customer" (status submitted → paid,
// jurnal, cicilan, stok, tiket event, aktivasi forum, notifikasi pelanggan). Dipakai:
//   1. verifySubmittedPaymentAction (dashboard, aktor = user login), dan
//   2. halaman verifikasi PJ via tautan (/{slug}/verifikasi/{token}, aktor = tenant user milik PJ
//      atau owner sebagai pemegang jurnal — lihat docs/arsitektur-notifikasi-pengurus.md § 8).
//
// !! TIDAK ADA pengecekan otorisasi di sini — PEMANGGIL WAJIB sudah mengotorisasi aktor (sesi
// dashboard + hasFullAccess keuangan, atau tautan bertoken + kata sandi PJ). File ini sengaja BUKAN
// "use server": fungsi yang diekspor dari file "use server" menjadi endpoint yang bisa dipanggil dari
// browser. Jangan ubah jadi "use server" dan jangan diimpor dari komponen client.

type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

function revalidateBilling(slug: string) {
  revalidatePath(`/app/${slug}/finance/billing`);
  revalidatePath(`/app/${slug}/finance`);
}

// Sama dengan formatEventDateWib di finance/billing/actions.ts (diduplikasi, pola yang sudah ada di
// project agar billing tidak bergantung ke modul event).
function formatEventDateWib(date: Date | null, timezone: string): string {
  if (!date) return "-";
  return `${formatInTz(date, timezone, {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })} ${tzLabel(timezone)}`;
}

export async function verifySubmittedPaymentCore(opts: {
  slug:           string;
  paymentId:      string;
  verifiedAmount: number;   // nominal yang benar-benar diterima (boleh beda dari yang customer submit)
  actorUserId:    string;   // tenant users.id — dicatat sebagai confirmedBy + createdBy jurnal
  journalNote?:   string;   // tambahan deskripsi jurnal (mis. "(diverifikasi via tautan oleh X)")
}): Promise<ActionResult<void>> {
  const { slug, paymentId, verifiedAmount, actorUserId, journalNote } = opts;

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

  // Resolve akun untuk jurnal — pre-check cepat (jaminan korektnes yang sebenarnya via resolve
  // ULANG di dalam transaction, lihat komentar sebelum recordIncomeSplit di bawah).
  const { resolveIncomeSplitForBilling } = await import("@/app/(dashboard)/app/[tenant]/finance/actions");
  const preCheckSplit = await resolveIncomeSplitForBilling(
    tenantDb, payment.method as "cash" | "transfer" | "qris", payment.sourceId, verifiedAmount,
  );

  if (!preCheckSplit) {
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
  let notifyMemberId: string | null = null;

  // Diisi di dalam transaction jika invoice ini adalah cicilan — object holder (bukan `let`
  // union) untuk hindari TS narrowing-quirk pada reassignment di dalam closure async.
  const installmentInfo: { installmentPlanId: string | null; newPaid: number; total: number; newStatus: string } =
    { installmentPlanId: null, newPaid: 0, total: 0, newStatus: "" };

  // Object holder — sama seperti di confirmInvoicePaymentAction, dipakai untuk gating
  // activateForumMembership supaya hanya jalan saat invoice benar-benar lunas.
  const paymentStatusInfo: { newStatus: string } = { newStatus: "" };

  // Tanggal jurnal WAJIB kalender timezone tenant, bukan UTC mentah — fetch sekali di luar
  // transaction (read-only, tidak perlu ikut terkunci).
  const tenantTimezone = await getTenantTimezone(tenantDb);

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
      notifyMemberId      = inv.memberId;

      const paidSoFar  = parseFloat(String(inv.paidAmount));
      const total      = parseFloat(String(inv.total));
      const uniqueCode = inv.uniqueCode ?? 0;
      const amountDue  = total + uniqueCode;
      const newPaid    = paidSoFar + verifiedAmount;
      const newStatus  = newPaid >= amountDue ? "paid" : "partial";
      paymentStatusInfo.newStatus = newStatus;

      // Konfirmasi payment — amount di-update ke nominal yang admin verifikasi (bisa beda
      // dari yang customer submit, lihat docs/arsitektur-billing.md § "Nominal Pembayaran
      // Terlihat + Bisa Diedit")
      await tx
        .update(schema.payments)
        .set({
          amount:      verifiedAmount.toFixed(2),
          status:      "paid",
          confirmedBy: actorUserId,
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

      // Settlement cicilan — waterfall FIFO, sama persis dengan confirmInvoicePaymentAction.
      if (inv.installmentPlanId) {
        await settleInstallmentSchedules(tx, schema, inv.id, newPaid, paymentId);
        installmentInfo.installmentPlanId = inv.installmentPlanId;
        installmentInfo.newPaid           = newPaid;
        installmentInfo.total             = total;
        installmentInfo.newStatus         = newStatus;
      }

      // Jurnal double-entry saat lunas
      if (newStatus === "paid") {
        const txNum = await generateFinancialNumber(tenantDb, "journal");
        // Bukukan nominal SESUNGGUHNYA yang diterima (termasuk kelebihan bayar) — dikurangi
        // uniqueCode invoice-level saja. Lihat komentar sama di confirmInvoicePaymentAction +
        // docs/arsitektur-billing.md § "Overpayment Juga Dijurnal".
        const journalAmount = Math.max(0, newPaid - uniqueCode);
        // Resolve ULANG di sini (bukan pakai preCheckSplit dari luar tx) — jaminan korektnes
        // sebenarnya, sama seperti pola lock+recheck lain di project ini. Pecah jadi beberapa
        // baris kredit sesuai domain item (produk→Toko, tiket→Event, donasi→Dana Titipan,
        // custom→Manual) — lihat docs/arsitektur-keuangan.md § 14.4 (Opsi B).
        const split = await resolveIncomeSplitForBilling(
          tenantDb, payment.method as "cash" | "transfer" | "qris", inv.id, journalAmount,
        );
        if (!split) throw new Error("Konfigurasi mapping akun belum lengkap. Atur di menu Akun → Pengaturan Mapping.");
        await recordIncomeSplit(tenantDb, {
          date:            todayInTz(tenantTimezone),
          description:     `Pelunasan invoice ${inv.invoiceNumber}${journalNote ? ` ${journalNote}` : ""}`,
          referenceNumber: txNum,
          createdBy:       actorUserId,
          cashAccountId:   split.cashAccountId,
          lines:           split.lines,
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

        // Auto-create event_registrations dari item tiket di invoice — cart (E10 flow) MAUPUN
        // manual (invoice dibuat admin dengan tiket + "Data Peserta"). Skip HANYA untuk
        // sourceType="event_registration" — sudah ditangani blok di atas. Lihat komentar sama
        // di confirmInvoicePaymentAction untuk alasan lengkap.
        if (inv.sourceType !== "event_registration") {
          const ticketResult = await createEventRegistrationsFromInvoiceTickets(
            tx, tenantDb, inv.id, inv.memberId ?? null, inv.profileId ?? null,
          );
          newEventRegs.push(...ticketResult.created);
        }

        // Kurangi stok fisik produk — invoice ini BARU SAJA jadi paid. Lihat docs/arsitektur-stok.md.
        const productItems = await getProductInvoiceItems(tx, schema, inv.id);
        if (productItems.length > 0) await decrementStockForInvoiceItems(tx, schema, productItems);
      }
    });

    if (newEventRegs.length > 0) {
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

        // Bust cache admin (dynamic tapi tetap perlu invalidate client Router Cache) DAN
        // halaman publik (ISR/Full Route Cache — tanpa ini tab "Peserta" bisa stale sampai
        // window ISR habis sendiri, meski data di DB sudah benar). Lihat lesson CLAUDE.md
        // "Bug: Sinkronisasi Peserta Event Tidak Terlihat".
        revalidatePath(`/app/${slug}/event/acara/${reg.eventId}`);
        revalidatePath(`/${slug}/agenda/${eventDetail.slug}`);

        const eventUrl = await waAppUrl(slug, `/agenda/${eventDetail.slug}`);
        void notifyWa({
          slug, tenantDb, event: "event_registered",
          phone: reg.attendeePhone,
          vars: {
            name:      reg.attendeeName,
            eventName: eventDetail.title,
            eventDate: formatEventDateWib(eventDetail.startsAt, tenantTimezone),
            location:  eventDetail.location ?? "-",
            regNumber: reg.regNumber,
            eventUrl,
          },
        });
      }
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

    // Tambahan khusus cicilan — TIDAK menggantikan payment_confirmed di atas, dan HANYA
    // dikirim jika masih ada termin tersisa (pelunasan penuh cukup notifikasi standar).
    if (installmentInfo.installmentPlanId && installmentInfo.newStatus !== "paid") {
      const schedules = await db
        .select()
        .from(schema.installmentSchedules)
        .where(eq(schema.installmentSchedules.invoiceId, payment.sourceId))
        .orderBy(schema.installmentSchedules.termNumber);
      const termsPaid = schedules.filter((s) => s.status === "paid").length;
      const nextTerm  = schedules.find((s) => s.status !== "paid");
      if (nextTerm) {
        const invoiceUrl = await waAppUrl(slug, `/invoice/${payment.sourceId}`);
        void notifyWa({
          slug, tenantDb, event: "installment_payment_confirmed",
          phone: notifyCustomerPhone,
          vars: {
            name:             notifyCustomerName,
            invoiceNumber:    notifyInvoiceNumber,
            termsPaid:        String(termsPaid),
            installmentCount: String(schedules.length),
            remaining:        waRupiah(installmentInfo.total - installmentInfo.newPaid),
            nextDueDate:      nextTerm.dueDate,
            nextAmount:       waRupiah(parseFloat(String(nextTerm.amount)) + (nextTerm.uniqueCode ?? 0)),
            invoiceUrl,
          },
        });
      }
    }

    if (paymentStatusInfo.newStatus === "paid") {
      try {
        await activateForumMembership({
          slug, tenantDb, memberId: notifyMemberId, mode: "invoice-paid", invoiceId: payment.sourceId,
        });
      } catch (err) {
        console.error("[verifySubmittedPaymentCore] aktivasi forum gagal (non-fatal):", err);
      }
    }

    revalidateBilling(slug);
    return { success: true, data: undefined };
  } catch (err) {
    if (err instanceof Error && (err.message.includes("sudah diproses") || err.message.includes("lunas") || err.message.includes("dibatalkan")))
      return { success: false, error: err.message };
    console.error("[verifySubmittedPaymentCore]", err);
    return { success: false, error: "Gagal memverifikasi pembayaran." };
  }
}
