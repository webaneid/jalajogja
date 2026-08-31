"use server";

import { eq, and, desc, sql, count, inArray, ilike, or } from "drizzle-orm";
import type { InvoiceStatus } from "@jalajogja/db";
import { revalidatePath } from "next/cache";
import { createTenantDb, generateFinancialNumber, settleInstallmentSchedules } from "@jalajogja/db";
import { db as publicDb, tenants, tenantMemberships, getSetting } from "@jalajogja/db";
import {
  findVoucherByCode,
  countCustomerRedemptions,
  computeVoucherDiscount,
  type ResolvedCartItemForVoucher,
  type VoucherApplicationResult,
} from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { hasFullAccess, hasReadAccess } from "@/lib/permissions";
import { recordIncomeSplit } from "@jalajogja/db";
import { normalizePhone } from "@/lib/phone";
import { notifyWa, waAppUrl, waRupiah } from "@/lib/wa-notify";
import {
  createEventRegistrationsFromInvoiceTickets,
  type EventTicketBackfillResult,
  type TenantTx,
} from "@/lib/event-registration-sync.server";
import { getTenantTimezone, formatInTz, tzLabel, anchorTodayUtc, todayInTz, localDatetimeToUtcIso } from "@/lib/tenant-timezone.server";
import { checkMemberEligibility } from "@/lib/member-eligibility";
import { getEnabledEkosistemModules } from "@/lib/ekosistem-modules.server";
import { enabledModuleList } from "@/lib/ekosistem-modules";
import { generateForumMembershipNumber } from "@/lib/forum-membership-number.server";
import { isRequirementSatisfied } from "@/lib/membership-config";
import type { MembershipConfigData as MembershipConfig } from "../../settings/actions";

// ─── Types ────────────────────────────────────────────────────────────────────

type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

// createEventRegistrationsFromInvoiceTickets() + EventTicketBackfillResult sekarang hidup di
// lib/event-registration-sync.server.ts (diimpor di atas) — SATU-SATUNYA implementasi, dipakai
// bersama oleh cart/actions.ts (checkout instan lunas) dan file ini (confirmInvoicePaymentAction,
// verifySubmittedPaymentAction, backfillEventRegistrationsAction di bawah). Re-export tipe ini
// murni untuk kompatibilitas — tidak ada consumer yang mengimpor by-name dari sini saat ini.
export type { EventTicketBackfillResult };

// Sama dengan formatEventDateWib di event/actions.ts — di-duplikasi agar billing
// tidak bergantung ke modul event (pola sama dengan generateEventRegNumber di atas).
// timezone dinamis dari getTenantTimezone (bukan hardcode) — lihat lib/tenant-timezone.ts.
function formatEventDateWib(date: Date | null, timezone: string): string {
  if (!date) return "-";
  return `${formatInTz(date, timezone, {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })} ${tzLabel(timezone)}`;
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
  voucherCode?:  string;
  dueDate?:      string; // YYYY-MM-DD
  notes?:        string;
};

export type ConfirmInvoicePaymentData = {
  amount:       number;
  method:       "cash" | "transfer" | "qris";
  payerBank?:   string;
  transferDate?: string;
  notes?:       string;
  proofUrl?:    string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function revalidateBilling(slug: string) {
  revalidatePath(`/app/${slug}/finance/billing`);
  revalidatePath(`/app/${slug}/finance`);
}

function calcSubtotal(items: InvoiceItemInput[]): number {
  return items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
}

// ─── applyInvoiceZeroTotalSettlement ────────────────────────────────────────
// Efek samping "invoice langsung lunas dengan total Rp 0" — voucher 100% (atau kombinasi
// diskon) yang menghabiskan seluruh tagihan. Dipakai BAIK saat invoice BARU dibuat
// (createInvoiceAction) MAUPUN saat voucher diterapkan ke invoice yang SUDAH ADA sehingga
// totalnya turun jadi 0 (applyVoucherToInvoiceAction). TIDAK ADA jurnal di sini — nominal 0,
// tidak ada uang masuk untuk dicatat. Pola sama persis checkoutAction (cart/actions.ts) —
// lihat docs/arsitektur-voucher.md § "Checkout Rp 0 (voucher 100%) — auto lunas, tanpa
// langkah bayar". Duplikasi guard sourceType="event_registration" dari confirmInvoicePaymentAction
// di file yang sama (pola sudah established, bukan logic baru).
async function applyInvoiceZeroTotalSettlement(
  tx: TenantTx,
  tenantDb: ReturnType<typeof createTenantDb>,
  invoiceId: string,
  invoiceSourceType: string,
  invoiceSourceId: string | null,
  invoiceMemberId: string | null,
  invoiceProfileId: string | null,
): Promise<{ newEventRegs: EventTicketBackfillResult["created"] }> {
  const { schema } = tenantDb;

  // Sync collected_amount kampanye donasi — dari invoice_items yang sudah ter-insert.
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
    await tx.update(schema.campaigns)
      .set({ collectedAmount: sql`collected_amount + ${String(amt)}` })
      .where(eq(schema.campaigns.id, cId));
  }

  // Alur lama (registerForEventAction): invoice terhubung langsung ke SATU event_registrations
  // via sourceId — cukup tandai confirmed. JANGAN panggil createEventRegistrationsFromInvoiceTickets
  // di bawah untuk kasus ini — item tiketnya tidak punya JSON attendee, akan bikin baris
  // duplikat dengan nama salah (nama tiket, bukan nama peserta).
  if (invoiceSourceType === "event_registration" && invoiceSourceId) {
    await tx.update(schema.eventRegistrations)
      .set({ status: "confirmed", updatedAt: new Date() })
      .where(eq(schema.eventRegistrations.id, invoiceSourceId));
    return { newEventRegs: [] };
  }

  // Alur cart/manual — auto-create dari item tiket. SATU-SATUNYA implementasi, lihat
  // lib/event-registration-sync.server.ts.
  const ticketResult = await createEventRegistrationsFromInvoiceTickets(
    tx, tenantDb, invoiceId, invoiceMemberId, invoiceProfileId,
  );
  return { newEventRegs: ticketResult.created };
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
    // Item produk/tiket/donasi WAJIB punya itemId (dipilih dari hasil pencarian katalog di
    // client) — tanpa ini, voucher target-spesifik selalu gagal cocok tanpa penjelasan yang
    // jelas ("Voucher tidak berlaku untuk item di keranjang Anda"), karena computeVoucherDiscount
    // tidak bisa membandingkan itemId terhadap voucher.targetItemIds. Client sudah menggate ini,
    // guard di sini murni defense-in-depth (server action bisa dipanggil langsung).
    if (item.itemType !== "custom" && !item.itemId) {
      return {
        success: false,
        error: `Item "${item.name.trim()}" belum dipilih dari hasil pencarian katalog — klik salah satu hasil pencarian, atau ubah tipenya jadi "Lainnya".`,
      };
    }
  }

  const tenantDb = createTenantDb(slug);
  const { db, schema } = tenantDb;

  try {
    const tenantTimezone = await getTenantTimezone(tenantDb);

    // Kode Unik Otomatis (Rp 100–999) — jika unique_code_enabled di settings payment
    const { getSettings, generateUniqueCode } = await import("@jalajogja/db");
    const paymentSettings   = await getSettings(tenantDb, "payment");
    const uniqueCodeEnabled = paymentSettings["unique_code_enabled"] === true;

    // Default due date: 3 hari dari sekarang, anchor ke kalender timezone tenant
    const dueDate = data.dueDate ?? (() => {
      const d = anchorTodayUtc(tenantTimezone);
      d.setUTCDate(d.getUTCDate() + 3);
      return d.toISOString().slice(0, 10);
    })();

    const normalizedCustomerPhone = normalizePhone(data.customerPhone);
    const customerEmailTrim       = data.customerEmail?.trim() ?? null;

    // Seluruh insert dibungkus transaction — voucher WAJIB dikunci (FOR UPDATE) + divalidasi
    // ulang DI DALAM tx yang sama (cegah dua admin apply kode yang sama bersamaan lolos
    // usageLimit), sekalian menutup celah atomicity lama (invoice+items sebelumnya 2 insert
    // terpisah tanpa transaction sama sekali). generateFinancialNumber/generateUniqueCode aman
    // dipanggil dari dalam sini — pola sama persis checkoutAction (cart/actions.ts), keduanya
    // pakai tenantDb (bukan tx) dan membuka transaction bersarangnya sendiri (postgres.js
    // savepoint), sudah terbukti aman di production.
    const result = await db.transaction(async (tx) => {
      let voucherApplication: VoucherApplicationResult | null = null;
      if (data.voucherCode?.trim()) {
        const voucherRow = await findVoucherByCode(tx, schema, data.voucherCode, true);
        if (!voucherRow) throw new Error("Kode voucher tidak ditemukan.");

        const existingRedemptions = await countCustomerRedemptions(tx, schema, voucherRow.id, {
          phone: normalizedCustomerPhone, email: customerEmailTrim,
        });

        // KOREKSI (2026-08-31): klaim lama "searchBillingProductsAction tidak pernah
        // mengembalikan produk mitra" TIDAK BENAR — query itu tidak filter mitraId sama sekali
        // (beda dari getVoucherTargetOptionsAction yang eksplisit `mitraId IS NULL`, dipakai
        // saat admin MEMILIH target voucher). mitraId di-hardcode null di bawah untuk konsistensi
        // dengan checkoutAction (yang resolveProductCartItem() dulu untuk dapat mitraId asli),
        // TAPI di sini itu KELIRU secara diam-diam: kalau admin menambahkan produk mitra sebagai
        // item invoice, voucher "berlaku untuk semua produk" (targetItemIds kosong) akan ikut
        // mendiskon produk mitra itu, padahal kebijakan Fase 1 (docs/arsitektur-voucher.md § 1)
        // sengaja HANYA menyasar produk milik tenant sendiri. Belum diperbaiki — di luar scope
        // fix voucher-rejected-karena-itemId-kosong yang baru dilakukan; catat sebagai gap
        // terpisah kalau nanti dilaporkan.
        const voucherResolvedItems: ResolvedCartItemForVoucher[] = data.items.map((it) => ({
          itemType: it.itemType,
          itemId:   it.itemId ?? null,
          unitPrice: it.unitPrice,
          quantity:  it.quantity,
          mitraId:   null,
        }));

        const voucherResult = computeVoucherDiscount(
          voucherRow,
          { phone: normalizedCustomerPhone, email: customerEmailTrim },
          existingRedemptions,
          voucherResolvedItems,
        );
        if ("error" in voucherResult) throw new Error(voucherResult.error);
        voucherApplication = voucherResult;
      }

      const invoiceNumber = await generateFinancialNumber(tenantDb, "invoice");

      const subtotalGross        = calcSubtotal(data.items);
      const voucherDiscountTotal = voucherApplication?.totalDiscount ?? 0;
      const subtotalNet          = subtotalGross - voucherDiscountTotal;
      const manualDiscount       = data.discount ?? 0;
      const total                = Math.max(0, subtotalNet - manualDiscount);
      // Voucher 100% (atau kombinasi diskon) yang menghabiskan seluruh tagihan → invoice
      // langsung lunas. Prinsip yang sama dengan checkoutAction (cart publik), sebelumnya
      // cuma dipakai di sana — sekarang berlaku juga untuk invoice manual admin.
      const isFullyPaid = total <= 0;

      // Kode unik TIDAK PERNAH digenerate untuk tagihan Rp 0 — tidak ada apa pun yang perlu
      // ditransfer, jadi tidak ada gunanya kode identifikasi transfer.
      const uniqueCode = (uniqueCodeEnabled && !isFullyPaid) ? await generateUniqueCode(tenantDb) : 0;

      const [invoice] = await tx
        .insert(schema.invoices)
        .values({
          invoiceNumber,
          sourceType:    "manual",
          sourceId:      null,
          customerName:  data.customerName.trim(),
          customerPhone: normalizedCustomerPhone,
          customerEmail: customerEmailTrim,
          memberId:      data.memberId ?? null,
          subtotal:      subtotalNet.toFixed(2),
          discount:      manualDiscount.toFixed(2),
          total:         total.toFixed(2),
          uniqueCode,
          paidAmount:    isFullyPaid ? total.toFixed(2) : "0",
          status:        isFullyPaid ? "paid" : "pending",
          dueDate,
          notes:         data.notes?.trim() ?? null,
          createdBy:     access.tenantUser.id,
          voucherId:            voucherApplication?.voucher.id ?? null,
          voucherCode:          voucherApplication?.voucher.code ?? null,
          voucherDiscountTotal: voucherDiscountTotal.toFixed(2),
        })
        .returning({
          id:            schema.invoices.id,
          customerName:  schema.invoices.customerName,
          customerPhone: schema.invoices.customerPhone,
        });

      // Insert items (dengan diskon per baris kalau voucher diterapkan)
      await tx.insert(schema.invoiceItems).values(
        data.items.map((item, i) => {
          const discountAmount = voucherApplication?.perItemDiscount.get(i) ?? 0;
          const lineTotal      = Math.max(0, item.unitPrice * item.quantity - discountAmount);
          return {
            invoiceId:      invoice.id,
            itemType:       item.itemType,
            itemId:         item.itemId ?? null,
            name:           item.name.trim(),
            description:    item.description?.trim() ?? null,
            unitPrice:      item.unitPrice.toFixed(2),
            quantity:       item.quantity,
            total:          lineTotal.toFixed(2),
            sortOrder:      i,
            discountAmount: discountAmount.toFixed(2),
            voucherId:      discountAmount > 0 ? (voucherApplication?.voucher.id ?? null) : null,
          };
        })
      );

      // Catat pemakaian voucher — lock yang sama dari resolusi di atas mencegah race dua
      // pembuatan invoice bersamaan sama-sama lolos cek usageLimit voucher yang sama.
      if (voucherApplication) {
        await tx
          .update(schema.vouchers)
          .set({ usedCount: sql`${schema.vouchers.usedCount} + 1`, updatedAt: new Date() })
          .where(eq(schema.vouchers.id, voucherApplication.voucher.id));

        await tx.insert(schema.voucherRedemptions).values({
          voucherId:     voucherApplication.voucher.id,
          invoiceId:     invoice.id,
          customerPhone: normalizedCustomerPhone,
          customerEmail: customerEmailTrim,
          discountTotal: voucherDiscountTotal.toFixed(2),
        });
      }

      // Invoice Rp 0 → efek samping "langsung lunas" (sync campaign + auto-create tiket
      // event) — TANPA jurnal, tidak ada uang yang masuk untuk dicatat.
      let newEventRegs: EventTicketBackfillResult["created"] = [];
      if (isFullyPaid) {
        const settlement = await applyInvoiceZeroTotalSettlement(
          tx, tenantDb, invoice.id, "manual", null, data.memberId ?? null, null,
        );
        newEventRegs = settlement.newEventRegs;
      }

      return {
        invoiceId: invoice.id, invoiceNumber, customerName: invoice.customerName,
        customerPhone: invoice.customerPhone, total, uniqueCode, isFullyPaid, newEventRegs,
      };
    });

    // Kirim notifikasi WA jika nomor HP customer tersedia
    if (result.customerPhone) {
      if (result.isFullyPaid) {
        // Voucher 100% — invoice sudah langsung lunas, TIDAK ada apa pun yang perlu dibayar.
        // Notifikasi STANDAR (payment_confirmed), bukan invoice_created — pola sama
        // checkoutAction (cart/actions.ts).
        void notifyWa({
          slug, tenantDb, event: "payment_confirmed",
          phone: result.customerPhone,
          vars: {
            name:          result.customerName,
            invoiceNumber: result.invoiceNumber,
            amount:        waRupiah(0),
          },
        });

        for (const reg of result.newEventRegs) {
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
      } else {
        const invoiceUrl = await waAppUrl(slug, `/invoice/${result.invoiceId}`);
        const amountDue  = result.total + result.uniqueCode;
        void notifyWa({
          slug,
          tenantDb,
          event: "invoice_created",
          phone: result.customerPhone,
          vars: {
            name:          result.customerName,
            invoiceNumber: result.invoiceNumber,
            amount:        waRupiah(amountDue),
            dueDate:       dueDate,
            invoiceUrl,
          },
        });
      }
    }

    revalidateBilling(slug);
    return { success: true, data: { invoiceId: result.invoiceId } };
  } catch (err) {
    if (err instanceof Error && err.message.toLowerCase().includes("voucher"))
      return { success: false, error: err.message };
    console.error("[createInvoiceAction]", err);
    return { success: false, error: "Gagal membuat invoice." };
  }
}

// ─── previewInvoiceVoucherAction ────────────────────────────────────────────
// Preview murni untuk form buat invoice baru — TIDAK mengunci voucher row, TIDAK menaikkan
// usedCount, TIDAK mutasi apa pun. createInvoiceAction SELALU re-validasi dari nol di dalam
// transaction-nya sendiri (pola sama previewVoucherAction di cart/actions.ts).

export type InvoiceVoucherPreview = {
  valid:            boolean;
  error?:           string;
  voucherName?:     string;
  perItemDiscount?: Record<number, number>; // index di items -> nominal potongan
  totalDiscount?:   number;
};

export async function previewInvoiceVoucherAction(
  slug: string,
  code: string,
  items: InvoiceItemInput[],
  customerPhone?: string,
  customerEmail?: string,
): Promise<ActionResult<InvoiceVoucherPreview>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "keuangan"))
    return { success: false as const, error: "Akses ditolak." };

  if (!code?.trim() || !items.length)
    return { success: true, data: { valid: false, error: "Kode voucher kosong." } };

  // Sama seperti createInvoiceAction — item produk/tiket/donasi tanpa itemId (belum dipilih
  // dari katalog) tidak pernah bisa cocok dengan voucher target-spesifik. Tangkap di sini supaya
  // pesannya jelas soal ITEM-nya, bukan pesan generik "voucher tidak berlaku".
  const unlinkedItem = items.find((it) => it.itemType !== "custom" && !it.itemId);
  if (unlinkedItem) {
    return {
      success: true,
      data: {
        valid: false,
        error: `Item "${unlinkedItem.name}" belum dipilih dari hasil pencarian katalog — voucher tidak bisa dicocokkan sampai item ini dipilih dari daftar.`,
      },
    };
  }

  const { db, schema } = createTenantDb(slug);

  try {
    const voucherRow = await findVoucherByCode(db, schema, code, false);
    if (!voucherRow) return { success: true, data: { valid: false, error: "Kode voucher tidak ditemukan." } };

    const normalizedPhone = customerPhone ? normalizePhone(customerPhone) : null;
    const emailTrim       = customerEmail?.trim() || null;

    const existingRedemptions = await countCustomerRedemptions(db, schema, voucherRow.id, {
      phone: normalizedPhone, email: emailTrim,
    });

    const voucherResolvedItems: ResolvedCartItemForVoucher[] = items.map((it) => ({
      itemType: it.itemType, itemId: it.itemId ?? null, unitPrice: it.unitPrice,
      quantity: it.quantity, mitraId: null,
    }));

    const result = computeVoucherDiscount(
      voucherRow, { phone: normalizedPhone, email: emailTrim }, existingRedemptions, voucherResolvedItems,
    );
    if ("error" in result) return { success: true, data: { valid: false, error: result.error } };

    const perItemDiscount: Record<number, number> = {};
    result.perItemDiscount.forEach((discount, index) => { perItemDiscount[index] = discount; });

    return {
      success: true,
      data: { valid: true, voucherName: result.voucher.name, perItemDiscount, totalDiscount: result.totalDiscount },
    };
  } catch (err) {
    console.error("[previewInvoiceVoucherAction]", err);
    return { success: false, error: "Gagal memeriksa voucher." };
  }
}

// ─── applyVoucherToInvoiceAction ────────────────────────────────────────────
// Terapkan voucher ke invoice yang SUDAH ADA (bukan saat pembuatan). Dipakai admin di halaman
// detail invoice supaya tidak perlu batalkan/buat ulang invoice hanya karena customer baru minta
// kode voucher belakangan. Scope sengaja sempit: HANYA invoice yang belum ada pembayaran sama
// sekali (paidAmount = 0) dan belum pernah pakai voucher lain — menghindari kompleksitas
// menghitung ulang status/paidAmount/jurnal untuk invoice yang sudah sebagian dibayar.

export async function applyVoucherToInvoiceAction(
  slug: string,
  invoiceId: string,
  code: string,
): Promise<ActionResult<{ total: number }>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "keuangan"))
    return { success: false as const, error: "Akses ditolak." };

  if (!code?.trim()) return { success: false, error: "Kode voucher wajib diisi." };

  const tenantDb = createTenantDb(slug);
  const { db, schema } = tenantDb;

  try {
    // Dipakai untuk format tanggal event kalau invoice ini jadi lunas Rp 0 dan punya item
    // tiket yang perlu registrasi — dihitung sekali di luar transaction (read-only).
    const tenantTimezone = await getTenantTimezone(tenantDb);

    const result = await db.transaction(async (tx) => {
      const [lockedInv] = await tx
        .select()
        .from(schema.invoices)
        .where(eq(schema.invoices.id, invoiceId))
        .for("update");
      if (!lockedInv) throw new Error("Invoice tidak ditemukan.");
      if (["paid", "cancelled"].includes(lockedInv.status))
        throw new Error(
          lockedInv.status === "paid"
            ? "Invoice sudah lunas, voucher tidak dapat diterapkan lagi."
            : "Invoice sudah dibatalkan."
        );
      if (parseFloat(String(lockedInv.paidAmount)) > 0)
        throw new Error("Voucher hanya bisa diterapkan sebelum ada pembayaran masuk. Batalkan pembayaran yang sudah tercatat terlebih dahulu.");
      if (lockedInv.voucherId)
        throw new Error("Invoice ini sudah menggunakan voucher lain.");

      const items = await tx
        .select()
        .from(schema.invoiceItems)
        .where(eq(schema.invoiceItems.invoiceId, invoiceId))
        .orderBy(schema.invoiceItems.sortOrder);
      if (!items.length) throw new Error("Invoice tidak memiliki item.");

      const voucherRow = await findVoucherByCode(tx, schema, code, true);
      if (!voucherRow) throw new Error("Kode voucher tidak ditemukan.");

      const existingRedemptions = await countCustomerRedemptions(tx, schema, voucherRow.id, {
        phone: lockedInv.customerPhone, email: lockedInv.customerEmail,
      });

      const voucherResolvedItems: ResolvedCartItemForVoucher[] = items.map((it) => ({
        itemType: it.itemType as ResolvedCartItemForVoucher["itemType"],
        itemId:   it.itemId,
        unitPrice: parseFloat(String(it.unitPrice)),
        quantity:  it.quantity,
        mitraId:   null, // invoice manual admin selalu milik tenant sendiri
      }));

      const voucherResult = computeVoucherDiscount(
        voucherRow,
        { phone: lockedInv.customerPhone, email: lockedInv.customerEmail },
        existingRedemptions,
        voucherResolvedItems,
      );
      if ("error" in voucherResult) throw new Error(voucherResult.error);

      const voucherDiscountTotal = voucherResult.totalDiscount;
      const manualDiscount       = parseFloat(String(lockedInv.discount ?? "0"));
      const subtotalGross        = items.reduce((sum, it) => sum + parseFloat(String(it.unitPrice)) * it.quantity, 0);
      const subtotalNet          = subtotalGross - voucherDiscountTotal;
      const total                = Math.max(0, subtotalNet - manualDiscount);
      // Voucher yang menghabiskan seluruh sisa tagihan → invoice langsung lunas. Kode unik
      // yang sudah ter-generate saat invoice dibuat (kalau ada) WAJIB dinolkan di sini —
      // tanpa ini, amountDue (= total + uniqueCode) tetap > 0 walau total tampil Rp 0, dan
      // invoice tidak pernah keluar dari status "belum dibayar". Lihat docs/arsitektur-voucher.md
      // § "Checkout Rp 0".
      const isFullyPaid = total <= 0;

      // Update tiap item dengan diskon barunya
      for (let i = 0; i < items.length; i++) {
        const discountAmount = voucherResult.perItemDiscount.get(i) ?? 0;
        const lineTotal      = Math.max(0, parseFloat(String(items[i].unitPrice)) * items[i].quantity - discountAmount);
        await tx
          .update(schema.invoiceItems)
          .set({
            discountAmount: discountAmount.toFixed(2),
            voucherId:      discountAmount > 0 ? voucherRow.id : null,
            total:          lineTotal.toFixed(2),
          })
          .where(eq(schema.invoiceItems.id, items[i].id));
      }

      await tx
        .update(schema.invoices)
        .set({
          subtotal:             subtotalNet.toFixed(2),
          total:                total.toFixed(2),
          voucherId:            voucherRow.id,
          voucherCode:          voucherRow.code,
          voucherDiscountTotal: voucherDiscountTotal.toFixed(2),
          // Kode unik selalu dinolkan begitu invoice Rp 0 — lihat komentar di atas. Kalau
          // belum Rp 0, uniqueCode yang sudah ada (kalau ada) TIDAK disentuh/diregenerasi.
          ...(isFullyPaid
            ? { uniqueCode: 0, status: "paid" as const, paidAmount: total.toFixed(2) }
            : {}),
          updatedAt:            new Date(),
        })
        .where(eq(schema.invoices.id, invoiceId));

      await tx
        .update(schema.vouchers)
        .set({ usedCount: sql`${schema.vouchers.usedCount} + 1`, updatedAt: new Date() })
        .where(eq(schema.vouchers.id, voucherRow.id));

      await tx.insert(schema.voucherRedemptions).values({
        voucherId:     voucherRow.id,
        invoiceId,
        customerPhone: lockedInv.customerPhone,
        customerEmail: lockedInv.customerEmail,
        discountTotal: voucherDiscountTotal.toFixed(2),
      });

      // Invoice Rp 0 → efek samping "langsung lunas" (sync campaign + auto-create tiket
      // event) — TANPA jurnal, tidak ada uang yang masuk untuk dicatat.
      let newEventRegs: EventTicketBackfillResult["created"] = [];
      if (isFullyPaid) {
        const settlement = await applyInvoiceZeroTotalSettlement(
          tx, tenantDb, invoiceId, lockedInv.sourceType, lockedInv.sourceId,
          lockedInv.memberId, lockedInv.profileId,
        );
        newEventRegs = settlement.newEventRegs;
      }

      return {
        total, isFullyPaid, newEventRegs,
        customerPhone: lockedInv.customerPhone, customerName: lockedInv.customerName,
        invoiceNumber: lockedInv.invoiceNumber,
      };
    });

    if (result.isFullyPaid && result.customerPhone) {
      // Voucher menghabiskan seluruh sisa tagihan — notifikasi STANDAR (payment_confirmed),
      // bukan invoice_created — pola sama checkoutAction (cart/actions.ts).
      void notifyWa({
        slug, tenantDb, event: "payment_confirmed",
        phone: result.customerPhone,
        vars: {
          name:          result.customerName,
          invoiceNumber: result.invoiceNumber,
          amount:        waRupiah(0),
        },
      });

      for (const reg of result.newEventRegs) {
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

    revalidateBilling(slug);
    revalidatePath(`/app/${slug}/finance/billing/invoice/${invoiceId}`);
    return { success: true, data: { total: result.total } };
  } catch (err) {
    if (err instanceof Error && (err.message.toLowerCase().includes("voucher") || err.message.includes("Invoice")))
      return { success: false, error: err.message };
    console.error("[applyVoucherToInvoiceAction]", err);
    return { success: false, error: "Gagal menerapkan voucher." };
  }
}

// ─── searchBillingProductsAction ─────────────────────────────────────────────

export type BillingProductResult = {
  id:    string;
  name:  string;
  price: number;
  sku:   string | null;
};

export async function searchBillingProductsAction(
  slug: string,
  search?: string,
): Promise<ActionResult<BillingProductResult[]>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };

  const tenantDb = createTenantDb(slug);
  const { db, schema } = tenantDb;

  const term = search?.trim() ? `%${search.trim()}%` : null;

  try {
    const rows = await db
      .select({
        id:    schema.products.id,
        name:  schema.products.name,
        price: schema.products.price,
        sku:   schema.products.sku,
      })
      .from(schema.products)
      .where(
        and(
          eq(schema.products.status, "active"),
          term ? ilike(schema.products.name, term) : undefined,
        )
      )
      .limit(20);

    return {
      success: true,
      data: rows.map((r) => ({
        id:    r.id,
        name:  r.name,
        price: parseFloat(String(r.price)),
        sku:   r.sku ?? null,
      })),
    };
  } catch (err) {
    console.error("[searchBillingProductsAction]", err);
    return { success: false, error: "Gagal mencari produk." };
  }
}

// ─── searchBillingPaidTicketsAction ──────────────────────────────────────────

export type BillingTicketResult = {
  id:                string;
  name:              string;
  eventTitle:        string;
  price:             number;
  // Data peserta (Nama/HP/Email + custom form) HARUS diisi admin saat item ini dipilih —
  // tanpa ini, event_registrations hasil konfirmasi invoice akan salah (attendeeName jatuh
  // ke nama tiket, bukan nama orangnya). Lihat lib/event-custom-form.ts.
  enableCustomForm:  boolean;
  customFormFields:  import("@/lib/event-custom-form").CustomFormField[];
};

export async function searchBillingPaidTicketsAction(
  slug: string,
  search?: string,
): Promise<ActionResult<BillingTicketResult[]>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };

  const tenantDb = createTenantDb(slug);
  const { db, schema } = tenantDb;

  const term = search?.trim() ? `%${search.trim()}%` : null;

  try {
    const rows = await db
      .select({
        id:               schema.eventTickets.id,
        name:             schema.eventTickets.name,
        eventTitle:       schema.events.title,
        price:            schema.eventTickets.price,
        enableCustomForm: schema.events.enableCustomForm,
        customFormFields: schema.events.customFormFields,
      })
      .from(schema.eventTickets)
      .innerJoin(schema.events, eq(schema.eventTickets.eventId, schema.events.id))
      .where(
        and(
          eq(schema.events.status, "published"),
          eq(schema.eventTickets.isActive, true),
          sql`CAST(${schema.eventTickets.price} AS NUMERIC) > 0`,
          term
            ? or(
                ilike(schema.events.title, term),
                ilike(schema.eventTickets.name, term)
              )
            : undefined,
        )
      )
      .limit(20);

    return {
      success: true,
      data: rows.map((r) => ({
        id:         r.id,
        enableCustomForm: r.enableCustomForm,
        customFormFields: (r.customFormFields as import("@/lib/event-custom-form").CustomFormField[] | null) ?? [],
        name:       `${r.eventTitle} - ${r.name}`,
        eventTitle: r.eventTitle,
        price:      parseFloat(String(r.price)),
      })),
    };
  } catch (err) {
    console.error("[searchBillingPaidTicketsAction]", err);
    return { success: false, error: "Gagal mencari tiket event." };
  }
}

// ─── searchBillingCampaignsAction ──────────────────────────────────────────

export type BillingCampaignResult = {
  id:    string;
  name:  string;
  price: number;
};

export async function searchBillingCampaignsAction(
  slug: string,
  search?: string,
): Promise<ActionResult<BillingCampaignResult[]>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };

  const tenantDb = createTenantDb(slug);
  const { db, schema } = tenantDb;

  const term = search?.trim() ? `%${search.trim()}%` : null;

  try {
    const rows = await db
      .select({
        id:            schema.campaigns.id,
        title:         schema.campaigns.title,
        defaultAmount: schema.campaigns.defaultAmount,
      })
      .from(schema.campaigns)
      .where(
        and(
          eq(schema.campaigns.status, "active"),
          term ? ilike(schema.campaigns.title, term) : undefined,
        )
      )
      .orderBy(schema.campaigns.title)
      .limit(20);

    return {
      success: true,
      data: rows.map((r) => ({
        id:    r.id,
        name:  `Donasi: ${r.title}`,
        price: r.defaultAmount ? parseFloat(String(r.defaultAmount)) : 0,
      })),
    };
  } catch (err) {
    console.error("[searchBillingCampaignsAction]", err);
    return { success: false, error: "Gagal mencari campaign donasi." };
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
        .select({
          status:     schema.invoices.status,
          paidAmount: schema.invoices.paidAmount,
          voucherId:  schema.invoices.voucherId,
        })
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

      // Voucher dipakai invoice ini → kembalikan kuotanya. usedCount di-decrement (tidak
      // pernah minus via GREATEST), redemption ditandai cancelledAt (bukan dihapus — audit
      // trail tetap utuh, cuma tidak dihitung lagi ke usageLimit/usageLimitPerCustomer).
      if (lockedInv.voucherId) {
        await tx
          .update(schema.vouchers)
          .set({ usedCount: sql`GREATEST(${schema.vouchers.usedCount} - 1, 0)`, updatedAt: new Date() })
          .where(eq(schema.vouchers.id, lockedInv.voucherId));
        await tx
          .update(schema.voucherRedemptions)
          .set({ cancelledAt: new Date() })
          .where(and(
            eq(schema.voucherRedemptions.voucherId, lockedInv.voucherId),
            eq(schema.voucherRedemptions.invoiceId, invoiceId),
            sql`${schema.voucherRedemptions.cancelledAt} IS NULL`,
          ));
      }
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

// ─── activateForumMembershipIfApplicable ──────────────────────────────────────
// Setelah invoice benar-benar lunas (bukan partial): cek apakah tenant ini forum DAN
// sudah mengonfigurasi produk/campaign sebagai syarat iuran (`membership_config`, key
// tunggal group "forum", diisi via /app/{slug}/settings/keanggotaan — Fase D) DAN item
// invoice yang baru lunas cocok dengan konfigurasi itu → aktifkan tenant_memberships
// forum untuk pembelinya. Keputusan produk (2026-07-24): pembayaran saja TIDAK CUKUP —
// member tetap harus checkMemberEligibility() sebelum diaktifkan, supaya pembayaran dari
// jalur mana pun (bukan cuma lewat /gabung — bisa donasi biasa ke campaign yang sama)
// tidak membuat orang yang datanya belum lengkap otomatis jadi anggota forum.
//
// Dipanggil SETELAH tx tenant-schema commit (bukan di dalam tx) — tenant_memberships ada
// di PUBLIC schema, koneksi terpisah dari `tx` (tenant schema). Caller WAJIB bungkus
// pemanggilan ini dengan try/catch sendiri — gagal di sini tidak boleh menggagalkan
// pencatatan pembayaran yang sudah sah (uang sudah masuk, itu fakta terpisah dari
// aktivasi keanggotaan forum).
//
// Lihat docs/arsitektur-backbone-ikpm.md § "Alur Pendaftaran Forum v2".

async function activateForumMembershipIfApplicable(
  slug:      string,
  tenantDb:  ReturnType<typeof createTenantDb>,
  invoiceId: string,
  memberId:  string | null,
): Promise<void> {
  if (!memberId) return;

  const [tenantRow] = await publicDb
    .select({ id: tenants.id, tenantType: tenants.tenantType })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);
  if (!tenantRow || tenantRow.tenantType !== "forum") return;

  const config = await getSetting<MembershipConfig>(tenantDb, "membership_config", "forum");
  if (!config) return;
  // Nol produk & campaign dikonfigurasi sama sekali → tidak ada apa pun untuk dicocokkan.
  if (!config.requiredProductId && !config.requiredCampaignId) return;

  const { db, schema } = tenantDb;

  // Produk BERVARIASI: itemId di invoice_items adalah variation id (product_variations.id),
  // bukan requiredProductId (products.id) langsung — kumpulkan seluruh variationId milik
  // requiredProductId dulu supaya match tetap benar untuk produk variable. Bug laten
  // ditemukan+ditutup 2026-08-06, lihat docs/arsitektur-gabung-forum.md § "Redesain /gabung".
  const productRelevantIds = new Set<string>();
  if (config?.requiredProductId) {
    productRelevantIds.add(config.requiredProductId);
    const variationRows = await db
      .select({ id: schema.productVariations.id })
      .from(schema.productVariations)
      .where(eq(schema.productVariations.productId, config.requiredProductId));
    for (const v of variationRows) productRelevantIds.add(v.id);
  }

  const items = await db
    .select({
      itemType: schema.invoiceItems.itemType,
      itemId:   schema.invoiceItems.itemId,
      // Wajib true — donasi/pembelian ORGANIK (lewat halaman produk/campaign biasa, bukan dari
      // link ?forGabung=1 di /gabung) TIDAK PERNAH boleh mengaktifkan keanggotaan forum meski
      // itemId-nya kebetulan cocok syarat iuran. Lihat docs/arsitektur-backbone-ikpm.md
      // § "Pemisahan Donasi vs Registrasi Forum".
      forGabungRegistration: schema.invoiceItems.forGabungRegistration,
    })
    .from(schema.invoiceItems)
    .where(eq(schema.invoiceItems.invoiceId, invoiceId));

  const hasProduct  = items.some((it) => it.itemType === "product"  && it.forGabungRegistration && it.itemId && productRelevantIds.has(it.itemId));
  const hasCampaign = items.some((it) => it.itemType === "donation" && it.forGabungRegistration && it.itemId === config?.requiredCampaignId);

  // Precondition WAJIB, terpisah dari isRequirementSatisfied di bawah: invoice ini harus
  // GENUINELY mengandung minimal satu item forGabung yang cocok konfigurasi. Tanpa gate
  // ini, invoice organik (donasi/beli produk biasa TANPA lewat /gabung sama sekali) bisa
  // lolos vacuous-true di isRequirementSatisfied() kalau slot yang bersangkutan kebetulan
  // TIDAK admin-wajibkan (productRequired/campaignRequired=false) — persis kelas bug yang
  // sudah dikunci di "Pemisahan Donasi vs Registrasi Forum" (arsitektur-gabung-forum.md),
  // JANGAN dihilangkan lagi. Setelah lolos gate ini, isRequirementSatisfied menentukan
  // apakah komitmen yang ADA sudah cukup LENGKAP (menghormati flag wajib/opsional per-item
  // admin — bukan berarti "ada gabung item apa saja langsung aktif").
  if (!hasProduct && !hasCampaign) return;

  if (!isRequirementSatisfied(config, { product: hasProduct, campaign: hasCampaign })) return;

  const enabledModulesConfig = await getEnabledEkosistemModules(tenantDb);
  const eligibility = await checkMemberEligibility(memberId, enabledModuleList(enabledModulesConfig));
  if (!eligibility.eligible) return;

  const [existing] = await publicDb
    .select({
      id:               tenantMemberships.id,
      forumStatus:      tenantMemberships.forumStatus,
      membershipNumber: tenantMemberships.membershipNumber,
    })
    .from(tenantMemberships)
    .where(and(
      eq(tenantMemberships.tenantId, tenantRow.id),
      eq(tenantMemberships.memberId, memberId),
    ))
    .limit(1);
  if (existing?.forumStatus === "active") return;

  const now = new Date();

  // Nomor keanggotaan lokal forum (opsional) — generate SEKALI saja, pertahankan yang lama
  // kalau sudah ada (mis. member sempat suspended lalu aktif lagi lewat pembayaran).
  let membershipNumber = existing?.membershipNumber ?? null;
  if (!membershipNumber && config.membershipNumberFormat) {
    membershipNumber = await generateForumMembershipNumber({
      tenantId: tenantRow.id,
      memberId,
      format:   config.membershipNumberFormat,
      joinDate: now,
    });
  }

  if (existing) {
    await publicDb.update(tenantMemberships)
      .set({
        status: "active", membershipType: "forum", forumStatus: "active",
        approvedAt: now, forumInvoiceId: invoiceId, membershipNumber, updatedAt: now,
      })
      .where(eq(tenantMemberships.id, existing.id));
  } else {
    await publicDb.insert(tenantMemberships).values({
      tenantId:       tenantRow.id,
      memberId,
      status:         "active",
      membershipType: "forum",
      forumStatus:    "active",
      joinedAt:       now.toISOString().split("T")[0],
      approvedAt:     now,
      forumInvoiceId: invoiceId,
      registeredVia:  "self",
      membershipNumber,
    });
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
  // Guard duplikat konfirmasi — ada bukti transfer customer yang masih menunggu verifikasi.
  // Admin harus Verifikasi/Tolak bukti itu dulu, bukan menambah pembayaran manual terpisah
  // untuk transfer yang sama (root cause bug 2026-08-01: dua payment dikonfirmasi untuk satu
  // transfer, salah satunya ditolak, status invoice salah turun ke "partial").
  if (inv.status === "waiting_verification")
    return { success: false, error: "Ada bukti pembayaran yang sedang menunggu verifikasi. Verifikasi atau tolak dulu bukti tersebut sebelum menambah pembayaran manual baru." };

  try {
    // Resolve akun untuk jurnal — pre-check cepat (jaminan korektnes yang sebenarnya via
    // resolve ULANG di dalam transaction, lihat komentar sebelum recordIncomeSplit di bawah).
    const { resolveIncomeSplitForBilling } = await import("../actions");
    const preCheckSplit = await resolveIncomeSplitForBilling(tenantDb, data.method, invoiceId, data.amount);

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

    // Diisi di dalam transaction jika invoice ini adalah cicilan — dipakai SETELAH commit
    // untuk kirim notifikasi progres termin (pola sama dengan newEventRegs di atas).
    // Object holder (bukan `let` union) — mutasi property, hindari TS narrowing-quirk pada
    // `let` yang di-reassign hanya di dalam closure async.
    const installmentInfo: { installmentPlanId: string | null; newPaidAmount: number; newStatus: string } =
      { installmentPlanId: null, newPaidAmount: 0, newStatus: "" };

    // Object holder — dipakai untuk cek "apakah invoice ini SUDAH lunas (bukan partial)"
    // setelah tx commit, supaya activateForumMembershipIfApplicable hanya dipanggil saat
    // benar-benar lunas (sama seperti sync collected_amount/event registration di atas).
    const paymentStatusInfo: { newStatus: string } = { newStatus: "" };

    // Tanggal jurnal WAJIB kalender timezone tenant, bukan UTC mentah — fetch sekali di
    // luar transaction (read-only, tidak perlu ikut terkunci).
    const tenantTimezone = await getTenantTimezone(tenantDb);

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
      if (lockedInv.status === "waiting_verification")
        throw new Error("Ada bukti pembayaran yang sedang menunggu verifikasi. Verifikasi atau tolak dulu bukti tersebut sebelum menambah pembayaran manual baru.");

      const total      = parseFloat(String(lockedInv.total));
      const uniqueCode = lockedInv.uniqueCode ?? 0;
      const amountDue  = total + uniqueCode;
      const paidSoFar  = parseFloat(String(lockedInv.paidAmount));

      // Overpayment DIIZINKAN — keputusan produk (2026-07-19): kelebihan nominal di luar
      // tanggung jawab platform, klien sudah diberi peringatan non-blocking di UI sebelum
      // submit (lihat payExpected/verifyExpected di invoice-detail-client.tsx). Journal tetap
      // hanya membukukan `total` (bukan newPaidAmount) — kelebihan tercatat di payments.amount
      // sebagai jejak audit, tapi tidak diakui sebagai pendapatan melebihi nilai invoice.

      const newPaidAmount = paidSoFar + data.amount;
      const newStatus     = newPaidAmount >= amountDue ? "paid" : "partial";
      paymentStatusInfo.newStatus = newStatus;

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
          proofUrl:     data.proofUrl?.trim() ?? null,
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

      // Settlement cicilan — waterfall FIFO, lihat docs/arsitektur-billing.md § "Program Cicilan"
      if (lockedInv.installmentPlanId) {
        await settleInstallmentSchedules(tx, schema, invoiceId, newPaidAmount, payment.id);
        installmentInfo.installmentPlanId = lockedInv.installmentPlanId;
        installmentInfo.newPaidAmount     = newPaidAmount;
        installmentInfo.newStatus         = newStatus;
      }

      // Jurnal double-entry (hanya jika lunas — partial tidak jurnal dulu)
      if (newStatus === "paid") {
        const txNum = await generateFinancialNumber(tenantDb, "journal");
        // Bukukan nominal SESUNGGUHNYA yang diterima (termasuk kelebihan bayar, jika ada) —
        // dikurangi uniqueCode invoice-level saja (identifier sistem, bukan pendapatan; TIDAK
        // dikurangi lagi untuk cicilan karena uniqueCode invoice sudah 0 sejak konversi).
        // Keputusan produk (2026-07-19): "kelebihan nominal harus muncul di laporan keuangan
        // formal juga, supaya rekening bank dan laporan sama persis" — lihat
        // docs/arsitektur-billing.md § "Overpayment Juga Dijurnal".
        const journalAmount = Math.max(0, newPaidAmount - uniqueCode);
        // Resolve ULANG di sini (bukan pakai preCheckSplit dari luar tx) — jaminan korektnes
        // sebenarnya, sama seperti pola lock+recheck lain di project ini. Pecah jadi beberapa
        // baris kredit sesuai domain item (produk→Toko, tiket→Event, donasi→Dana Titipan,
        // custom→Manual) — lihat docs/arsitektur-keuangan.md § 14.4 (Opsi B).
        const split = await resolveIncomeSplitForBilling(tenantDb, data.method, invoiceId, journalAmount);
        if (!split) throw new Error("Konfigurasi mapping akun belum lengkap. Atur di menu Akun → Pengaturan Mapping.");
        await recordIncomeSplit(tenantDb, {
          date:            todayInTz(tenantTimezone),
          description:     `Pelunasan invoice ${inv.invoiceNumber}`,
          referenceNumber: txNum,
          createdBy:       access.tenantUser.id,
          cashAccountId:   split.cashAccountId,
          lines:           split.lines,
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

        // Auto-create event_registrations dari item tiket di invoice — berlaku untuk cart
        // (checkout publik) MAUPUN manual (invoice dibuat admin dengan tiket + "Data Peserta").
        // WAJIB skip HANYA untuk sourceType="event_registration" — alur lama
        // (registerForEventAction) sudah insert eventRegistrations langsung sebelum invoice
        // dibuat dan statusnya di-update di blok di atas. Tanpa guard ini, invoice yang sama
        // juga punya invoiceItem itemType="ticket" → loop ini insert DUPLIKAT dengan nama =
        // nama tiket (bukan nama peserta asli), karena description item itu tidak diisi JSON
        // attendee.
        if (inv.sourceType !== "event_registration") {
          const ticketResult = await createEventRegistrationsFromInvoiceTickets(
            tx, tenantDb, invoiceId, inv.memberId ?? null, inv.profileId ?? null,
          );
          newEventRegs.push(...ticketResult.created);
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

    // Tambahan khusus cicilan — TIDAK menggantikan payment_confirmed di atas, dan HANYA
    // dikirim jika masih ada termin tersisa (pelunasan penuh cukup notifikasi standar).
    if (installmentInfo.installmentPlanId && installmentInfo.newStatus !== "paid") {
      const schedules = await db
        .select()
        .from(schema.installmentSchedules)
        .where(eq(schema.installmentSchedules.invoiceId, invoiceId))
        .orderBy(schema.installmentSchedules.termNumber);
      const termsPaid = schedules.filter((s) => s.status === "paid").length;
      const nextTerm  = schedules.find((s) => s.status !== "paid");
      if (nextTerm) {
        const invoiceUrl = await waAppUrl(slug, `/invoice/${invoiceId}`);
        void notifyWa({
          slug, tenantDb, event: "installment_payment_confirmed",
          phone: inv.customerPhone,
          vars: {
            name:             inv.customerName,
            invoiceNumber:    inv.invoiceNumber,
            termsPaid:        String(termsPaid),
            installmentCount: String(schedules.length),
            remaining:        waRupiah(parseFloat(String(inv.total)) - installmentInfo.newPaidAmount),
            nextDueDate:      nextTerm.dueDate,
            nextAmount:       waRupiah(parseFloat(String(nextTerm.amount)) + (nextTerm.uniqueCode ?? 0)),
            invoiceUrl,
          },
        });
      }
    }

    // Notifikasi tiket event baru yang ter-auto-create dari cart — titik pertama
    // customer dapat nomor registrasi. Lookup detail event per registrasi (biasanya 1).
    // tenantTimezone reuse dari fetch di awal function (sebelum transaction).
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

    if (paymentStatusInfo.newStatus === "paid") {
      try {
        await activateForumMembershipIfApplicable(slug, tenantDb, invoiceId, inv.memberId);
      } catch (err) {
        console.error("[confirmInvoicePaymentAction] aktivasi forum gagal (non-fatal):", err);
      }
    }

    revalidateBilling(slug);
    return { success: true, data: { paymentId } };
  } catch (err) {
    if (err instanceof Error && (err.message.includes("lunas") || err.message.includes("dibatalkan") || err.message.includes("menunggu verifikasi")))
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

      // Kembalikan invoice ke status semula agar customer bisa upload ulang — "paid" kalau
      // pembayaran YANG MASIH VALID (di luar yang barusan ditolak) sudah cukup melunasi
      // (paidAmount >= amountDue), "partial" kalau sudah ada pembayaran terkonfirmasi tapi
      // belum cukup, "pending" kalau belum ada sama sekali. Jangan selalu turunkan ke
      // "partial"/"pending" begitu ada satu submission ditolak — kalau ada pembayaran LAIN
      // yang sudah dikonfirmasi (mis. dari confirmInvoicePaymentAction manual) dan itu sendiri
      // sudah cukup, invoice TETAP "paid" (bukti yang ditolak cuma duplikat, uang yang valid
      // sudah masuk). Bug produksi 2026-08-01: admin double-konfirmasi 1 transfer (satu via
      // verifikasi bukti submit, satu via input manual) → keduanya kebetulan pas menutup
      // total → admin tolak salah satu (duplikat) → status SALAH turun ke "partial" padahal
      // pembayaran yang tersisa sudah cukup melunasi.
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
          // Baca ulang paidAmount+total+uniqueCode DI DALAM tx (bukan pakai invLink.paidAmount
          // yang direkam sebelum transaction) — hindari status revert salah kalau ada
          // confirmInvoicePaymentAction lain yang mengubah paidAmount konkuren dengan reject ini.
          const [freshInv] = await tx
            .select({
              paidAmount: schema.invoices.paidAmount,
              total:      schema.invoices.total,
              uniqueCode: schema.invoices.uniqueCode,
            })
            .from(schema.invoices)
            .where(eq(schema.invoices.id, invLink.invoiceId))
            .limit(1);
          const paidAmt   = parseFloat(String(freshInv?.paidAmount ?? 0));
          const amountDue = parseFloat(String(freshInv?.total ?? 0)) + (freshInv?.uniqueCode ?? 0);
          const revertStatus = paidAmt >= amountDue ? "paid" : paidAmt > 0 ? "partial" : "pending";
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

  // Resolve akun untuk jurnal — pre-check cepat (jaminan korektnes yang sebenarnya via resolve
  // ULANG di dalam transaction, lihat komentar sebelum recordIncomeSplit di bawah).
  const { resolveIncomeSplitForBilling } = await import("../actions");
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
  // activateForumMembershipIfApplicable supaya hanya jalan saat invoice benar-benar lunas.
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
          description:     `Pelunasan invoice ${inv.invoiceNumber}`,
          referenceNumber: txNum,
          createdBy:       access.tenantUser.id,
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
        await activateForumMembershipIfApplicable(slug, tenantDb, payment.sourceId, notifyMemberId);
      } catch (err) {
        console.error("[verifySubmittedPaymentAction] aktivasi forum gagal (non-fatal):", err);
      }
    }

    revalidateBilling(slug);
    return { success: true, data: undefined };
  } catch (err) {
    if (err instanceof Error && (err.message.includes("sudah diproses") || err.message.includes("lunas") || err.message.includes("dibatalkan")))
      return { success: false, error: err.message };
    console.error("[verifySubmittedPaymentAction]", err);
    return { success: false, error: "Gagal memverifikasi pembayaran." };
  }
}

// ─── backfillEventRegistrationsAction ──────────────────────────────────────────
// Perbaikan manual untuk invoice tiket event yang SUDAH lunas tapi tidak pernah menghasilkan
// event_registrations — bug lama (auto-create hanya jalan untuk sourceType="cart", sebelum
// admin bisa memilih tiket + isi "Data Peserta" langsung di invoice manual). Idempotent —
// aman dipanggil berkali-kali, baris yang sudah ada dilewati oleh
// createEventRegistrationsFromInvoiceTickets sendiri. Dipicu tombol "Sinkronkan Peserta Event"
// di halaman detail invoice, hanya tampil untuk invoice lunas berisi item tiket.

export async function backfillEventRegistrationsAction(
  slug: string,
  invoiceId: string,
): Promise<ActionResult<EventTicketBackfillResult>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "keuangan"))
    return { success: false, error: "Akses ditolak." };

  const tenantDb = createTenantDb(slug);
  const { db, schema } = tenantDb;

  const [inv] = await db
    .select({
      id:        schema.invoices.id,
      status:    schema.invoices.status,
      memberId:  schema.invoices.memberId,
      profileId: schema.invoices.profileId,
    })
    .from(schema.invoices)
    .where(eq(schema.invoices.id, invoiceId))
    .limit(1);

  if (!inv) return { success: false, error: "Invoice tidak ditemukan." };
  if (inv.status !== "paid")
    return { success: false, error: "Invoice belum lunas — tidak ada yang perlu disinkronkan." };

  try {
    const result = await db.transaction((tx) =>
      createEventRegistrationsFromInvoiceTickets(
        tx, tenantDb, invoiceId, inv.memberId ?? null, inv.profileId ?? null,
      )
    );

    revalidateBilling(slug);
    // Revalidate admin + halaman publik untuk baris BARU maupun yang SUDAH ADA — tombol ini
    // bisa diklik ulang tanpa menghasilkan baris baru (idempotent), tapi admin tetap perlu
    // cache-nya di-bust supaya halaman event yang dibuka SETELAH klik pasti fresh, bukan
    // mengandalkan client Router Cache/ISR yang mungkin masih menyimpan versi lama.
    for (const reg of [...result.created, ...result.existingRegistrations]) {
      revalidatePath(`/app/${slug}/event/acara/${reg.eventId}`);
      revalidatePath(`/${slug}/agenda/${reg.eventSlug}`);
    }

    return { success: true, data: result };
  } catch (err) {
    console.error("[backfillEventRegistrationsAction]", err);
    return { success: false, error: "Gagal menyinkronkan peserta." };
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
  voucherCode:   string | null;
};

export async function getInvoiceListAction(
  slug: string,
  opts: { status?: string; page?: number; search?: string } = {}
): Promise<ActionResult<{ rows: InvoiceListItem[]; total: number }>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasReadAccess(access.tenantUser, "keuangan"))
    return { success: false, error: "Akses ditolak." };

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
        voucherCode:   schema.invoices.voucherCode,
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
        voucherCode:   r.voucherCode ?? null,
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
  shippingTotal: number;
  discount:      number;
  voucherId:             string | null;
  voucherCode:           string | null;
  voucherDiscountTotal:  number;
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
    discountAmount: number;
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
    courier:        string | null;
    service:        string | null;
    etd:            string | null;
    cost:           number;
    trackingNumber: string | null;
    shippedAt:      string | null;
    status:         "pending" | "processing" | "packed" | "shipped" | "delivered";
    deliveryMethod: "courier" | "pickup";
    paymentMethod:  "prepaid" | "cod";
    pickupLocationName: string | null;
    pickupAddress:      string | null;
    pickupMapsUrl:      string | null;
    codConfirmedAt:     string | null;
  }[];
  installmentSchedules: {
    id:          string;
    termNumber:  number;
    dueDate:     string;
    amount:      number;
    status:      string;
    uniqueCode:  number | null;
  }[];
};

export async function getInvoiceDetailAction(
  slug: string,
  invoiceId: string
): Promise<ActionResult<InvoiceDetail>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasReadAccess(access.tenantUser, "keuangan"))
    return { success: false, error: "Akses ditolak." };

  const { db, schema } = createTenantDb(slug);

  const [inv] = await db
    .select()
    .from(schema.invoices)
    .where(eq(schema.invoices.id, invoiceId))
    .limit(1);

  if (!inv) return { success: false, error: "Invoice tidak ditemukan." };

  const [items, paymentLinks, shippingRows, scheduleRows] = await Promise.all([
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

    inv.installmentPlanId
      ? db.select().from(schema.installmentSchedules)
          .where(eq(schema.installmentSchedules.invoiceId, invoiceId))
          .orderBy(schema.installmentSchedules.termNumber)
      : Promise.resolve([]),
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
      shippingTotal: parseFloat(String(inv.shippingTotal ?? "0")),
      discount:      parseFloat(String(inv.discount)),
      voucherId:             inv.voucherId ?? null,
      voucherCode:           inv.voucherCode ?? null,
      voucherDiscountTotal:  parseFloat(String(inv.voucherDiscountTotal ?? "0")),
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
        discountAmount: parseFloat(String(it.discountAmount ?? "0")),
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
        deliveryMethod: sl.deliveryMethod as "courier" | "pickup",
        paymentMethod:  sl.paymentMethod as "prepaid" | "cod",
        pickupLocationName: sl.pickupLocationName ?? null,
        pickupAddress:      sl.pickupAddress ?? null,
        pickupMapsUrl:      sl.pickupMapsUrl ?? null,
        codConfirmedAt:     sl.codConfirmedAt?.toISOString() ?? null,
      })),
      installmentSchedules: scheduleRows.map((s) => ({
        id:         s.id,
        termNumber: s.termNumber,
        dueDate:    s.dueDate,
        amount:     parseFloat(String(s.amount)),
        status:     s.status,
        uniqueCode: s.uniqueCode ?? null,
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
          courier:         (line.courier ?? "").toUpperCase(),
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

// ─── Installment Plans (Cicilan) ───────────────────────────────────────────────
// Program cicilan — scope Fase A/B: tiket event saja (sourceType='event', sourceId=
// event_tickets.id). Donasi/qurban menyusul terpisah nanti — lihat plan cicilan.
// Invoice hasil enroll TETAP sourceType='event_registration' seperti tiket biasa (bukan
// sourceType baru) — cukup installmentPlanId yang membedakan, jadi hook existing di
// confirmInvoicePaymentAction/verifySubmittedPaymentAction (confirm eventRegistrations saat
// lunas) otomatis berlaku tanpa disentuh.

export type EventTicketOption = {
  eventId:    string;
  eventTitle: string;
  ticketId:   string;
  ticketName: string;
  price:      number;
};

export async function getEventTicketOptionsAction(
  slug: string,
): Promise<ActionResult<EventTicketOption[]>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };

  const { db, schema } = createTenantDb(slug);
  const rows = await db
    .select({
      eventId:    schema.events.id,
      eventTitle: schema.events.title,
      ticketId:   schema.eventTickets.id,
      ticketName: schema.eventTickets.name,
      price:      schema.eventTickets.price,
    })
    .from(schema.eventTickets)
    .innerJoin(schema.events, eq(schema.events.id, schema.eventTickets.eventId))
    .where(and(eq(schema.eventTickets.isActive, true), eq(schema.events.status, "published")))
    .orderBy(desc(schema.events.startsAt));

  return {
    success: true,
    data: rows.map((r) => ({ ...r, price: parseFloat(String(r.price)) })),
  };
}

export type InstallmentPlanListItem = {
  id:               string;
  name:             string;
  eventTitle:       string | null;
  ticketName:       string | null;
  totalAmount:      number | null;
  installmentCount: number;
  intervalDays:     number;
  isActive:         boolean;
  isPublished:      boolean;
  enrolledCount:    number;
  createdAt:        string;
};

export async function getInstallmentPlanListAction(
  slug: string,
): Promise<ActionResult<InstallmentPlanListItem[]>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasReadAccess(access.tenantUser, "keuangan"))
    return { success: false, error: "Akses ditolak." };

  const { db, schema } = createTenantDb(slug);

  const rows = await db
    .select({
      id:               schema.installmentPlans.id,
      name:             schema.installmentPlans.name,
      sourceType:       schema.installmentPlans.sourceType,
      sourceId:         schema.installmentPlans.sourceId,
      totalAmount:      schema.installmentPlans.totalAmount,
      installmentCount: schema.installmentPlans.installmentCount,
      intervalDays:     schema.installmentPlans.intervalDays,
      isActive:         schema.installmentPlans.isActive,
      isPublished:      schema.installmentPlans.isPublished,
      createdAt:        schema.installmentPlans.createdAt,
    })
    .from(schema.installmentPlans)
    .orderBy(desc(schema.installmentPlans.createdAt));

  const ticketIds = [...new Set(rows.filter((r) => r.sourceType === "event" && r.sourceId).map((r) => r.sourceId as string))];
  const ticketMap = new Map<string, { ticketName: string; eventTitle: string }>();
  if (ticketIds.length > 0) {
    const tRows = await db
      .select({
        id:         schema.eventTickets.id,
        ticketName: schema.eventTickets.name,
        eventTitle: schema.events.title,
      })
      .from(schema.eventTickets)
      .innerJoin(schema.events, eq(schema.events.id, schema.eventTickets.eventId))
      .where(inArray(schema.eventTickets.id, ticketIds));
    tRows.forEach((t) => ticketMap.set(t.id, { ticketName: t.ticketName, eventTitle: t.eventTitle }));
  }

  const planIds = rows.map((r) => r.id);
  let enrolledMap: Record<string, number> = {};
  if (planIds.length > 0) {
    const counts = await db
      .select({ planId: schema.invoices.installmentPlanId, cnt: count() })
      .from(schema.invoices)
      .where(inArray(schema.invoices.installmentPlanId, planIds))
      .groupBy(schema.invoices.installmentPlanId);
    enrolledMap = Object.fromEntries(counts.map((c) => [c.planId as string, Number(c.cnt)]));
  }

  return {
    success: true,
    data: rows.map((r) => ({
      id:               r.id,
      name:             r.name,
      eventTitle:       r.sourceId ? (ticketMap.get(r.sourceId)?.eventTitle ?? null) : null,
      ticketName:       r.sourceId ? (ticketMap.get(r.sourceId)?.ticketName ?? null) : null,
      totalAmount:      r.totalAmount != null ? parseFloat(String(r.totalAmount)) : null,
      installmentCount: r.installmentCount,
      intervalDays:     r.intervalDays,
      isActive:         r.isActive,
      isPublished:      r.isPublished,
      enrolledCount:    enrolledMap[r.id] ?? 0,
      createdAt:        r.createdAt.toISOString(),
    })),
  };
}

export type CreateInstallmentPlanData = {
  name:              string;
  description?:      string;
  ticketId:          string;   // event_tickets.id — jadi installment_plans.source_id
  totalAmount:       number;
  installmentCount:  number;
  intervalDays:      number;
};

function validateInstallmentPlanData(data: CreateInstallmentPlanData): string | null {
  if (!data.name.trim())                          return "Nama program wajib diisi.";
  if (!data.ticketId)                              return "Tiket wajib dipilih.";
  if (!data.totalAmount || data.totalAmount <= 0)  return "Total nominal harus lebih dari 0.";
  if (!data.installmentCount || data.installmentCount < 2) return "Jumlah termin minimal 2.";
  if (!data.intervalDays || data.intervalDays < 1) return "Interval hari minimal 1.";
  return null;
}

export async function createInstallmentPlanAction(
  slug: string,
  data: CreateInstallmentPlanData,
): Promise<ActionResult<{ id: string }>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "keuangan"))
    return { success: false, error: "Akses ditolak." };

  const validationError = validateInstallmentPlanData(data);
  if (validationError) return { success: false, error: validationError };

  const { db, schema } = createTenantDb(slug);

  const [ticket] = await db
    .select({ id: schema.eventTickets.id })
    .from(schema.eventTickets)
    .where(eq(schema.eventTickets.id, data.ticketId))
    .limit(1);
  if (!ticket) return { success: false, error: "Tiket tidak ditemukan." };

  const [plan] = await db
    .insert(schema.installmentPlans)
    .values({
      name:             data.name.trim(),
      description:      data.description?.trim() || null,
      sourceType:       "event",
      sourceId:         data.ticketId,
      totalAmount:      data.totalAmount.toFixed(2),
      installmentCount: data.installmentCount,
      intervalDays:     data.intervalDays,
      isActive:         false,
      isPublished:      false,
    })
    .returning({ id: schema.installmentPlans.id });

  revalidateBilling(slug);
  return { success: true, data: { id: plan.id } };
}

export async function updateInstallmentPlanAction(
  slug:   string,
  planId: string,
  data:   CreateInstallmentPlanData,
): Promise<ActionResult<void>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "keuangan"))
    return { success: false, error: "Akses ditolak." };

  const validationError = validateInstallmentPlanData(data);
  if (validationError) return { success: false, error: validationError };

  const { db, schema } = createTenantDb(slug);

  const [existing] = await db
    .select({ id: schema.installmentPlans.id })
    .from(schema.installmentPlans)
    .where(eq(schema.installmentPlans.id, planId))
    .limit(1);
  if (!existing) return { success: false, error: "Program tidak ditemukan." };

  await db
    .update(schema.installmentPlans)
    .set({
      name:             data.name.trim(),
      description:      data.description?.trim() || null,
      sourceId:         data.ticketId,
      totalAmount:      data.totalAmount.toFixed(2),
      installmentCount: data.installmentCount,
      intervalDays:     data.intervalDays,
      updatedAt:        new Date(),
    })
    .where(eq(schema.installmentPlans.id, planId));

  revalidateBilling(slug);
  return { success: true, data: undefined };
}

export async function toggleInstallmentPlanAction(
  slug:   string,
  planId: string,
  field:  "isActive" | "isPublished",
): Promise<ActionResult<{ value: boolean }>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "keuangan"))
    return { success: false, error: "Akses ditolak." };

  const { db, schema } = createTenantDb(slug);
  const [plan] = await db
    .select({ isActive: schema.installmentPlans.isActive, isPublished: schema.installmentPlans.isPublished })
    .from(schema.installmentPlans)
    .where(eq(schema.installmentPlans.id, planId))
    .limit(1);
  if (!plan) return { success: false, error: "Program tidak ditemukan." };

  const newValue = field === "isActive" ? !plan.isActive : !plan.isPublished;
  await db
    .update(schema.installmentPlans)
    .set(field === "isActive" ? { isActive: newValue } : { isPublished: newValue })
    .where(eq(schema.installmentPlans.id, planId));

  revalidateBilling(slug);
  return { success: true, data: { value: newValue } };
}

export type InstallmentPlanDetail = {
  id:               string;
  name:             string;
  description:      string | null;
  eventTitle:       string | null;
  ticketName:       string | null;
  ticketId:         string | null;
  totalAmount:      number | null;
  installmentCount: number;
  intervalDays:     number;
  isActive:         boolean;
  isPublished:      boolean;
  createdAt:        string;
  perTermAmount:    number | null;
  invoices: Array<{
    id:            string;
    invoiceNumber: string;
    customerName:  string;
    total:         number;
    paidAmount:    number;
    status:        string;
    paidTerms:     number;
    totalTerms:    number;
  }>;
};

export async function getInstallmentPlanDetailAction(
  slug:   string,
  planId: string,
): Promise<ActionResult<InstallmentPlanDetail>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasReadAccess(access.tenantUser, "keuangan"))
    return { success: false, error: "Akses ditolak." };

  const { db, schema } = createTenantDb(slug);

  const [plan] = await db
    .select()
    .from(schema.installmentPlans)
    .where(eq(schema.installmentPlans.id, planId))
    .limit(1);
  if (!plan) return { success: false, error: "Program tidak ditemukan." };

  let eventTitle: string | null = null;
  let ticketName: string | null = null;
  if (plan.sourceType === "event" && plan.sourceId) {
    const [t] = await db
      .select({ ticketName: schema.eventTickets.name, eventTitle: schema.events.title })
      .from(schema.eventTickets)
      .innerJoin(schema.events, eq(schema.events.id, schema.eventTickets.eventId))
      .where(eq(schema.eventTickets.id, plan.sourceId))
      .limit(1);
    if (t) { eventTitle = t.eventTitle; ticketName = t.ticketName; }
  }

  const invRows = await db
    .select({
      id:            schema.invoices.id,
      invoiceNumber: schema.invoices.invoiceNumber,
      customerName:  schema.invoices.customerName,
      total:         schema.invoices.total,
      paidAmount:    schema.invoices.paidAmount,
      status:        schema.invoices.status,
    })
    .from(schema.invoices)
    .where(eq(schema.invoices.installmentPlanId, planId))
    .orderBy(desc(schema.invoices.createdAt));

  const invIds = invRows.map((r) => r.id);
  let paidTermsMap: Record<string, number> = {};
  if (invIds.length > 0) {
    const paidCounts = await db
      .select({ invoiceId: schema.installmentSchedules.invoiceId, cnt: count() })
      .from(schema.installmentSchedules)
      .where(and(
        inArray(schema.installmentSchedules.invoiceId, invIds),
        eq(schema.installmentSchedules.status, "paid"),
      ))
      .groupBy(schema.installmentSchedules.invoiceId);
    paidTermsMap = Object.fromEntries(paidCounts.map((c) => [c.invoiceId, Number(c.cnt)]));
  }

  const totalAmount = plan.totalAmount != null ? parseFloat(String(plan.totalAmount)) : null;

  return {
    success: true,
    data: {
      id:               plan.id,
      name:             plan.name,
      description:      plan.description,
      eventTitle,
      ticketName,
      ticketId:         plan.sourceType === "event" ? plan.sourceId : null,
      totalAmount,
      installmentCount: plan.installmentCount,
      intervalDays:     plan.intervalDays,
      isActive:         plan.isActive,
      isPublished:      plan.isPublished,
      createdAt:        plan.createdAt.toISOString(),
      perTermAmount:    totalAmount != null ? Math.round(totalAmount / plan.installmentCount) : null,
      invoices: invRows.map((r) => ({
        id:            r.id,
        invoiceNumber: r.invoiceNumber,
        customerName:  r.customerName,
        total:         parseFloat(String(r.total)),
        paidAmount:    parseFloat(String(r.paidAmount)),
        status:        r.status,
        paidTerms:     paidTermsMap[r.id] ?? 0,
        totalTerms:    plan.installmentCount,
      })),
    },
  };
}

// ─── Voucher (Diskon & Voucher — Fase 1: berkode, target milik tenant) ─────────
// Lihat docs/arsitektur-voucher.md untuk arsitektur lengkap. Prinsip kunci: diskon memotong
// harga PER ITEM (invoice_items.total), tidak pernah invoice keseluruhan — resolusi & validasi
// sesungguhnya dilakukan di checkoutAction (cart/actions.ts), file ini murni CRUD admin.

export type VoucherTargetOption = {
  value: string;        // itemId — product.id / eventTickets.id / campaign.id / qurbanAnimal.id
  label: string;
  price: number | null;
};

export async function getVoucherTargetOptionsAction(
  slug:       string,
  targetType: "product" | "ticket" | "donation",
): Promise<ActionResult<VoucherTargetOption[]>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasReadAccess(access.tenantUser, "keuangan"))
    return { success: false, error: "Akses ditolak." };

  const { db, schema } = createTenantDb(slug);

  if (targetType === "product") {
    const rows = await db
      .select({ id: schema.products.id, name: schema.products.name, price: schema.products.price })
      .from(schema.products)
      .where(and(eq(schema.products.status, "active"), sql`${schema.products.mitraId} IS NULL`))
      .orderBy(desc(schema.products.createdAt));
    return {
      success: true,
      data: rows.map((r) => ({ value: r.id, label: r.name, price: parseFloat(String(r.price)) })),
    };
  }

  if (targetType === "ticket") {
    const rows = await db
      .select({
        id:         schema.eventTickets.id,
        ticketName: schema.eventTickets.name,
        eventTitle: schema.events.title,
        price:      schema.eventTickets.price,
      })
      .from(schema.eventTickets)
      .innerJoin(schema.events, eq(schema.events.id, schema.eventTickets.eventId))
      .where(and(eq(schema.eventTickets.isActive, true), eq(schema.events.status, "published")))
      .orderBy(desc(schema.events.startsAt));
    return {
      success: true,
      data: rows.map((r) => ({
        value: r.id, label: `${r.eventTitle} — ${r.ticketName}`, price: parseFloat(String(r.price)),
      })),
    };
  }

  // donation — campaign biasa (itemId = campaign.id) + varian qurban (itemId = qurban_animal.id),
  // sesuai semantik itemId yang benar-benar dipakai cart (lihat lib addToCartAction di public cart).
  const campaigns = await db
    .select({ id: schema.campaigns.id, title: schema.campaigns.title, campaignType: schema.campaigns.campaignType })
    .from(schema.campaigns)
    .where(eq(schema.campaigns.status, "active"))
    .orderBy(desc(schema.campaigns.createdAt));

  const regularOptions: VoucherTargetOption[] = campaigns
    .filter((c) => c.campaignType !== "qurban")
    .map((c) => ({ value: c.id, label: `Donasi: ${c.title}`, price: null }));

  const qurbanCampaignIds = campaigns.filter((c) => c.campaignType === "qurban").map((c) => c.id);
  let animalOptions: VoucherTargetOption[] = [];
  if (qurbanCampaignIds.length > 0) {
    const titleMap = new Map(campaigns.map((c) => [c.id, c.title]));
    const animals = await db
      .select({
        id: schema.qurbanAnimals.id, animalType: schema.qurbanAnimals.animalType,
        campaignId: schema.qurbanAnimals.campaignId, price: schema.qurbanAnimals.price,
      })
      .from(schema.qurbanAnimals)
      .where(and(
        inArray(schema.qurbanAnimals.campaignId, qurbanCampaignIds),
        eq(schema.qurbanAnimals.isActive, true),
      ));
    animalOptions = animals.map((a) => ({
      value: a.id,
      label: `Qurban: ${titleMap.get(a.campaignId) ?? "?"} — ${a.animalType}`,
      price: parseFloat(String(a.price)),
    }));
  }

  return { success: true, data: [...regularOptions, ...animalOptions] };
}

export type VoucherListItem = {
  id:                     string;
  code:                   string;
  name:                   string;
  discountType:           "percentage" | "fixed";
  discountValue:          number;
  targetType:             "product" | "ticket" | "donation";
  targetCount:            number; // 0 = berlaku untuk semua item tipe ini
  usageLimit:             number | null;
  usedCount:              number;
  isActive:               boolean;
  validFrom:              string | null;
  validUntil:             string | null;
  createdAt:              string;
};

export async function getVoucherListAction(
  slug: string,
): Promise<ActionResult<VoucherListItem[]>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasReadAccess(access.tenantUser, "keuangan"))
    return { success: false, error: "Akses ditolak." };

  const { db, schema } = createTenantDb(slug);
  const rows = await db
    .select()
    .from(schema.vouchers)
    .orderBy(desc(schema.vouchers.createdAt));

  return {
    success: true,
    data: rows.map((r) => ({
      id:            r.id,
      code:          r.code,
      name:          r.name,
      discountType:  r.discountType,
      discountValue: parseFloat(String(r.discountValue)),
      targetType:    r.targetType,
      targetCount:   ((r.targetItemIds as string[]) ?? []).length,
      usageLimit:    r.usageLimit,
      usedCount:     r.usedCount,
      isActive:      r.isActive,
      validFrom:     r.validFrom?.toISOString()  ?? null,
      validUntil:    r.validUntil?.toISOString() ?? null,
      createdAt:     r.createdAt.toISOString(),
    })),
  };
}

export type VoucherFormData = {
  code:                   string;
  name:                   string;
  description?:           string;
  discountType:           "percentage" | "fixed";
  discountValue:          number;
  targetType:             "product" | "ticket" | "donation";
  targetItemIds:          string[];
  usageLimit?:            number | null;
  usageLimitPerCustomer?: number | null;
  restrictPhone?:         string | null;
  restrictEmail?:         string | null;
  validFrom?:             string | null; // ISO date
  validUntil?:            string | null; // ISO date
};

function validateVoucherData(data: VoucherFormData): string | null {
  if (!data.code.trim())                          return "Kode voucher wajib diisi.";
  if (!/^[A-Z0-9_-]+$/i.test(data.code.trim()))    return "Kode voucher hanya boleh huruf, angka, - dan _.";
  if (!data.name.trim())                           return "Nama voucher wajib diisi.";
  if (!data.discountValue || data.discountValue <= 0) return "Nilai diskon harus lebih dari 0.";
  if (data.discountType === "percentage" && data.discountValue > 100)
    return "Diskon persentase tidak boleh lebih dari 100%.";
  if (data.usageLimit != null && (Number.isNaN(data.usageLimit) || data.usageLimit < 1))
    return "Batas pemakaian minimal 1.";
  if (data.usageLimitPerCustomer != null && (Number.isNaN(data.usageLimitPerCustomer) || data.usageLimitPerCustomer < 1))
    return "Batas pemakaian per orang minimal 1.";
  if (data.validFrom && data.validUntil && new Date(data.validFrom) > new Date(data.validUntil))
    return "Tanggal mulai tidak boleh setelah tanggal berakhir.";
  return null;
}

// Input <input type="date"> ("2026-07-19") WAJIB dianchor ke kalender timezone TENANT — bukan
// UTC mentah (`new Date("2026-07-19")` = tengah malam UTC = jam 07:00 WIB, voucher expire
// lebih awal dari yang dimaksud admin). Sama seperti aturan due_date/jadwal cicilan yang
// sudah dikunci — lihat lib/tenant-timezone.ts. validUntil dianchor ke 23:59 (bukan 00:00)
// supaya "berlaku sampai tanggal X" berarti bisa dipakai sepanjang tanggal X.
function resolveVoucherDateRange(
  data:            Pick<VoucherFormData, "validFrom" | "validUntil">,
  tenantTimezone:  string,
): { validFrom: Date | null; validUntil: Date | null } {
  return {
    validFrom:  data.validFrom  ? new Date(localDatetimeToUtcIso(`${data.validFrom}T00:00`,  tenantTimezone)) : null,
    validUntil: data.validUntil ? new Date(localDatetimeToUtcIso(`${data.validUntil}T23:59`, tenantTimezone)) : null,
  };
}

export async function createVoucherAction(
  slug: string,
  data: VoucherFormData,
): Promise<ActionResult<{ id: string }>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "keuangan"))
    return { success: false, error: "Akses ditolak." };

  const validationError = validateVoucherData(data);
  if (validationError) return { success: false, error: validationError };

  const tenantDb = createTenantDb(slug);
  const { db, schema } = tenantDb;

  try {
    const tenantTimezone = await getTenantTimezone(tenantDb);
    const { validFrom, validUntil } = resolveVoucherDateRange(data, tenantTimezone);

    const [voucher] = await db
      .insert(schema.vouchers)
      .values({
        code:                  data.code.trim().toUpperCase(),
        name:                  data.name.trim(),
        description:           data.description?.trim() || null,
        discountType:          data.discountType,
        discountValue:         data.discountValue.toFixed(2),
        targetType:            data.targetType,
        targetItemIds:         data.targetItemIds,
        usageLimit:            data.usageLimit ?? null,
        usageLimitPerCustomer: data.usageLimitPerCustomer ?? null,
        restrictPhone:         data.restrictPhone ? normalizePhone(data.restrictPhone) : null,
        restrictEmail:         data.restrictEmail?.trim().toLowerCase() || null,
        validFrom, validUntil,
        createdBy:             access.tenantUser.id,
      })
      .returning({ id: schema.vouchers.id });

    revalidateBilling(slug);
    revalidatePath(`/app/${slug}/finance/billing/voucher`);
    return { success: true, data: { id: voucher.id } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("vouchers_code") || msg.includes("duplicate key"))
      return { success: false, error: "Kode voucher sudah dipakai — gunakan kode lain." };
    console.error("[createVoucherAction]", err);
    return { success: false, error: "Gagal membuat voucher." };
  }
}

export async function updateVoucherAction(
  slug:      string,
  voucherId: string,
  data:      VoucherFormData,
): Promise<ActionResult<void>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "keuangan"))
    return { success: false, error: "Akses ditolak." };

  const validationError = validateVoucherData(data);
  if (validationError) return { success: false, error: validationError };

  const tenantDb = createTenantDb(slug);
  const { db, schema } = tenantDb;

  const [existing] = await db
    .select({ id: schema.vouchers.id })
    .from(schema.vouchers)
    .where(eq(schema.vouchers.id, voucherId))
    .limit(1);
  if (!existing) return { success: false, error: "Voucher tidak ditemukan." };

  try {
    const tenantTimezone = await getTenantTimezone(tenantDb);
    const { validFrom, validUntil } = resolveVoucherDateRange(data, tenantTimezone);

    await db
      .update(schema.vouchers)
      .set({
        code:                  data.code.trim().toUpperCase(),
        name:                  data.name.trim(),
        description:           data.description?.trim() || null,
        discountType:          data.discountType,
        discountValue:         data.discountValue.toFixed(2),
        targetType:            data.targetType,
        targetItemIds:         data.targetItemIds,
        usageLimit:            data.usageLimit ?? null,
        usageLimitPerCustomer: data.usageLimitPerCustomer ?? null,
        restrictPhone:         data.restrictPhone ? normalizePhone(data.restrictPhone) : null,
        restrictEmail:         data.restrictEmail?.trim().toLowerCase() || null,
        validFrom, validUntil,
        updatedAt:             new Date(),
      })
      .where(eq(schema.vouchers.id, voucherId));

    revalidateBilling(slug);
    revalidatePath(`/app/${slug}/finance/billing/voucher`);
    return { success: true, data: undefined };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("vouchers_code") || msg.includes("duplicate key"))
      return { success: false, error: "Kode voucher sudah dipakai — gunakan kode lain." };
    console.error("[updateVoucherAction]", err);
    return { success: false, error: "Gagal menyimpan voucher." };
  }
}

export async function toggleVoucherActiveAction(
  slug:      string,
  voucherId: string,
): Promise<ActionResult<{ value: boolean }>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "keuangan"))
    return { success: false, error: "Akses ditolak." };

  const { db, schema } = createTenantDb(slug);
  const [voucher] = await db
    .select({ isActive: schema.vouchers.isActive })
    .from(schema.vouchers)
    .where(eq(schema.vouchers.id, voucherId))
    .limit(1);
  if (!voucher) return { success: false, error: "Voucher tidak ditemukan." };

  const newValue = !voucher.isActive;
  await db
    .update(schema.vouchers)
    .set({ isActive: newValue, updatedAt: new Date() })
    .where(eq(schema.vouchers.id, voucherId));

  revalidateBilling(slug);
  revalidatePath(`/app/${slug}/finance/billing/voucher`);
  return { success: true, data: { value: newValue } };
}

export type VoucherDetail = {
  id:                     string;
  code:                   string;
  name:                   string;
  description:            string | null;
  discountType:           "percentage" | "fixed";
  discountValue:          number;
  targetType:             "product" | "ticket" | "donation";
  targetItemIds:          string[];
  usageLimit:             number | null;
  usageLimitPerCustomer:  number | null;
  usedCount:              number;
  restrictPhone:          string | null;
  restrictEmail:          string | null;
  validFrom:              string | null;
  validUntil:             string | null;
  isActive:               boolean;
  createdAt:              string;
  redemptions: Array<{
    id:            string;
    invoiceId:     string;
    invoiceNumber: string;
    customerName:  string;
    discountTotal: number;
    cancelledAt:   string | null;
    createdAt:     string;
  }>;
};

export async function getVoucherDetailAction(
  slug:      string,
  voucherId: string,
): Promise<ActionResult<VoucherDetail>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasReadAccess(access.tenantUser, "keuangan"))
    return { success: false, error: "Akses ditolak." };

  const { db, schema } = createTenantDb(slug);

  const [voucher] = await db
    .select()
    .from(schema.vouchers)
    .where(eq(schema.vouchers.id, voucherId))
    .limit(1);
  if (!voucher) return { success: false, error: "Voucher tidak ditemukan." };

  const redemptionRows = await db
    .select({
      id:            schema.voucherRedemptions.id,
      invoiceId:     schema.voucherRedemptions.invoiceId,
      discountTotal: schema.voucherRedemptions.discountTotal,
      cancelledAt:   schema.voucherRedemptions.cancelledAt,
      createdAt:     schema.voucherRedemptions.createdAt,
      invoiceNumber: schema.invoices.invoiceNumber,
      customerName:  schema.invoices.customerName,
    })
    .from(schema.voucherRedemptions)
    .innerJoin(schema.invoices, eq(schema.invoices.id, schema.voucherRedemptions.invoiceId))
    .where(eq(schema.voucherRedemptions.voucherId, voucherId))
    .orderBy(desc(schema.voucherRedemptions.createdAt));

  return {
    success: true,
    data: {
      id:                    voucher.id,
      code:                  voucher.code,
      name:                  voucher.name,
      description:           voucher.description,
      discountType:          voucher.discountType,
      discountValue:         parseFloat(String(voucher.discountValue)),
      targetType:            voucher.targetType,
      targetItemIds:         (voucher.targetItemIds as string[]) ?? [],
      usageLimit:            voucher.usageLimit,
      usageLimitPerCustomer: voucher.usageLimitPerCustomer,
      usedCount:             voucher.usedCount,
      restrictPhone:         voucher.restrictPhone,
      restrictEmail:         voucher.restrictEmail,
      validFrom:             voucher.validFrom?.toISOString()  ?? null,
      validUntil:            voucher.validUntil?.toISOString() ?? null,
      isActive:              voucher.isActive,
      createdAt:             voucher.createdAt.toISOString(),
      redemptions: redemptionRows.map((r) => ({
        id:            r.id,
        invoiceId:     r.invoiceId,
        invoiceNumber: r.invoiceNumber,
        customerName:  r.customerName,
        discountTotal: parseFloat(String(r.discountTotal)),
        cancelledAt:   r.cancelledAt?.toISOString() ?? null,
        createdAt:     r.createdAt.toISOString(),
      })),
    },
  };
}

// ─── COD (Bayar di Tempat) — konfirmasi per penjual, independen ──────────────
// Lihat docs/arsitektur-billing.md § COD & Ambil Sendiri. Admin HANYA boleh konfirmasi baris
// sellerType="tenant" — porsi mitra dikonfirmasi mitra sendiri (self-service, lihat
// akun/mitra/pesanan/actions.ts::confirmMitraCodReceivedAction, pola auth berbeda karena
// mitra bukan tenant.users). Setiap konfirmasi COD membukukan jurnal SENDIRI (porsi penjual
// itu saja) begitu dikonfirmasi — TIDAK menunggu invoice keseluruhan lunas, karena satu
// invoice campuran tenant+mitra bisa "sebagian COD terkonfirmasi, sisanya menunggu" (beda
// dari confirmInvoicePaymentAction yang jurnal-nya menunggu newStatus==="paid").
export async function confirmCodPaymentAction(
  slug: string,
  shippingLineId: string,
): Promise<ActionResult<{ paymentId: string }>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "keuangan"))
    return { success: false, error: "Akses ditolak." };

  const tenantDb = createTenantDb(slug);
  const { db, schema } = tenantDb;

  const [line] = await db
    .select()
    .from(schema.invoiceShippingLines)
    .where(eq(schema.invoiceShippingLines.id, shippingLineId))
    .limit(1);

  if (!line) return { success: false, error: "Data pengiriman tidak ditemukan." };
  if (line.sellerType !== "tenant")
    return { success: false, error: "Baris ini milik mitra — hanya mitra yang bisa konfirmasi." };
  if (line.paymentMethod !== "cod")
    return { success: false, error: "Baris ini bukan pembayaran COD." };
  if (line.codConfirmedAt)
    return { success: false, error: "COD untuk baris ini sudah dikonfirmasi sebelumnya." };

  try {
    const { resolveIncomeSplitForBilling } = await import("../actions");
    const tenantTimezone = await getTenantTimezone(tenantDb);

    const result = await db.transaction(async (tx) => {
      const [lockedInv] = await tx
        .select()
        .from(schema.invoices)
        .where(sql`${schema.invoices.id} = ${line.invoiceId} FOR UPDATE`)
        .limit(1);
      if (!lockedInv) throw new Error("Invoice tidak ditemukan.");
      if (lockedInv.status === "cancelled") throw new Error("Invoice dibatalkan.");

      const [lockedLine] = await tx
        .select()
        .from(schema.invoiceShippingLines)
        .where(sql`${schema.invoiceShippingLines.id} = ${shippingLineId} FOR UPDATE`)
        .limit(1);
      if (!lockedLine) throw new Error("Data pengiriman tidak ditemukan.");
      if (lockedLine.codConfirmedAt) throw new Error("COD untuk baris ini sudah dikonfirmasi sebelumnya.");

      // Porsi milik penjual tenant sendiri: subtotal item bertipe sellerType="tenant"
      // (sellerId selalu null untuk tenant) + ongkos baris shipping ini.
      // `invoice_items.total` SUDAH net dari discountAmount (lihat komentar schema di
      // billing.ts) — jangan kurangi discountAmount lagi di sini, itu double-subtraction.
      const [itemsAgg] = await tx
        .select({ subtotal: sql<string>`coalesce(sum(${schema.invoiceItems.total}), 0)` })
        .from(schema.invoiceItems)
        .where(and(
          eq(schema.invoiceItems.invoiceId, line.invoiceId),
          eq(schema.invoiceItems.sellerType, "tenant"),
        ));
      const amount = parseFloat(itemsAgg?.subtotal ?? "0") + parseFloat(String(lockedLine.cost));
      if (amount <= 0) throw new Error("Nominal COD tidak valid.");

      const total      = parseFloat(String(lockedInv.total));
      const uniqueCode = lockedInv.uniqueCode ?? 0;
      const amountDue  = total + uniqueCode;
      const paidSoFar  = parseFloat(String(lockedInv.paidAmount));
      const newPaidAmount = paidSoFar + amount;
      const newStatus     = newPaidAmount >= amountDue ? "paid" : "partial";

      const payNum = await generateFinancialNumber(tenantDb, "payment");
      const [payment] = await tx
        .insert(schema.payments)
        .values({
          number:      payNum,
          sourceType:  "invoice",
          sourceId:    line.invoiceId,
          amount:      amount.toFixed(2),
          uniqueCode:  0,
          method:      "cash",
          status:      "paid",
          payerName:   lockedInv.customerName,
          payerNote:   "COD dikonfirmasi oleh admin",
          confirmedBy: access.tenantUser.id,
          confirmedAt: new Date(),
          submittedAt: new Date(),
        })
        .returning({ id: schema.payments.id });

      await tx.insert(schema.invoicePayments).values({
        invoiceId: line.invoiceId,
        paymentId: payment.id,
        amount:    amount.toFixed(2),
      });

      await tx
        .update(schema.invoices)
        .set({ paidAmount: newPaidAmount.toFixed(2), status: newStatus, updatedAt: new Date() })
        .where(eq(schema.invoices.id, line.invoiceId));

      await tx
        .update(schema.invoiceShippingLines)
        .set({ codConfirmedAt: new Date(), codPaymentId: payment.id, updatedAt: new Date() })
        .where(eq(schema.invoiceShippingLines.id, shippingLineId));

      // Jurnal SEGERA untuk porsi ini — tidak menunggu invoice keseluruhan lunas (beda dari
      // confirmInvoicePaymentAction), karena porsi penjual lain (mis. mitra) bisa masih pending.
      // Pecah jadi beberapa baris kredit sesuai domain item milik tenant (produk→Toko,
      // tiket→Event, donasi→Dana Titipan, custom→Manual) — lihat
      // docs/arsitektur-keuangan.md § 14.4 (Opsi B).
      const txNum = await generateFinancialNumber(tenantDb, "journal");
      const split = await resolveIncomeSplitForBilling(
        tenantDb, "cash", line.invoiceId, amount, { sellerType: "tenant" },
      );
      if (!split) throw new Error("Konfigurasi mapping akun belum lengkap. Atur di menu Akun → Pengaturan Mapping.");
      await recordIncomeSplit(tenantDb, {
        date:            todayInTz(tenantTimezone),
        description:     `COD ${lockedInv.invoiceNumber} — porsi toko`,
        referenceNumber: txNum,
        createdBy:       access.tenantUser.id,
        cashAccountId:   split.cashAccountId,
        lines:           split.lines,
      });

      return { paymentId: payment.id };
    });

    revalidatePath(`/app/${slug}/finance/billing/invoice/${line.invoiceId}`);
    revalidatePath(`/${slug}/invoice/${line.invoiceId}`);
    return { success: true, data: result };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Gagal konfirmasi COD." };
  }
}
