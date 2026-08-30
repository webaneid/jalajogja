import "server-only";

import { eq, and, inArray, sql, type ExtractTablesWithRelations } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import { createTenantDb } from "@jalajogja/db";
import { normalizePhone } from "@/lib/phone";

// Satu-satunya tempat yang boleh membuat baris tenant.event_registrations dari item tiket di
// sebuah invoice — dipanggil dari SEMUA jalur pelunasan invoice yang bisa membuat registrasi
// tiket: checkout cart yang lunas instan (Rp 0 / voucher 100%), konfirmasi pembayaran manual
// admin, verifikasi bukti transfer customer, DAN backfill manual untuk invoice lama.
//
// Sebelum diekstrak ke sini, logic yang sama ditulis ULANG secara independen di cart/actions.ts
// (checkoutAction) — divergen dari implementasi asli di finance/billing/actions.ts (tidak
// idempotent, parsing sumber data beda field, tanpa normalizePhone). Kombinasi ini, ditambah
// updateRegistrationDataAction yang menimpa `customFields` secara utuh (bukan merge), adalah
// akar bug "invoice sudah lunas tapi peserta tetap tampil Belum Bayar" — sourceInvoiceId hilang
// begitu admin mengedit data peserta. Jangan pernah menulis ulang logic create-registrasi-dari-
// tiket ini di tempat lain — selalu import fungsi ini.

// Tipe transaction callback param dari TenantDb["db"].transaction(async (tx) => ...) — `tx`
// (PgTransaction) tidak structurally assignable ke TenantDb["db"] penuh, jadi helper yang
// menerima `tx` dari transaction existing wajib pakai tipe ini (duplikasi lokal, pola sama
// packages/db/src/helpers/billing.ts:TenantTx — tidak diekspor lintas package).
export type TenantTx = PgTransaction<
  PostgresJsQueryResultHKT,
  Record<string, unknown>,
  ExtractTablesWithRelations<Record<string, unknown>>
>;

// Sama dengan generateRegistrationNumber di event/actions.ts — di-duplikasi di sini (bukan
// diimpor dari event/actions.ts) supaya helper ini independen dari action file modul Event
// maupun modul Billing; keduanya sama-sama mengimpor helper create-registrasi DARI SINI.
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

// Parsing nama/HP/email/custom-field peserta dari invoice_items.description (JSON yang disimpan
// addEventTicketToCartAction, lihat lib/event-custom-form.ts) — dipakai baik saat membuat
// registrasi sungguhan (di bawah) MAUPUN saat menampilkan preview "checkout belum lunas" yang
// belum punya baris registrasi sama sekali (getPendingTicketCheckouts). Satu tempat, dua
// pemanggil — jangan tulis ulang parsing ini di file lain.
export function parseAttendeeFromInvoiceItem(item: { name: string; description: string | null }): {
  attendeeName: string;
  attendeePhone: string | null;
  attendeeEmail: string | null;
  extraFields: Record<string, unknown> | null;
} {
  let attendeeName  = item.name || "Peserta";
  let attendeePhone: string | null = null;
  let attendeeEmail: string | null = null;
  let extraFields:   Record<string, unknown> | null = null;
  try {
    const p = JSON.parse(item.description ?? "{}") as Record<string, unknown>;
    attendeeName  = String(p.attendeeName ?? item.name ?? "Peserta").trim();
    attendeePhone = normalizePhone(p.attendeePhone ? String(p.attendeePhone) : null);
    attendeeEmail = p.attendeeEmail ? String(p.attendeeEmail) : null;
    extraFields   = p.customFieldAnswers ? (p.customFieldAnswers as Record<string, unknown>) : null;
  } catch { /* gunakan default */ }
  return { attendeeName, attendeePhone, attendeeEmail, extraFields };
}

type CreatedEventReg = {
  eventId: string; eventTitle: string; eventSlug: string;
  regNumber: string; attendeeName: string; attendeePhone: string | null;
};

type ExistingEventReg = {
  id: string; eventId: string; eventTitle: string; eventSlug: string;
  regNumber: string; attendeeName: string; status: string;
};

export type EventTicketBackfillResult = {
  created:               CreatedEventReg[];
  existingRegistrations: ExistingEventReg[]; // detail baris yang SUDAH ada (kenapa alreadySynced)
  alreadySynced:         number; // sudah punya registrasi (idempotent skip) — normal, bukan masalah
  unlinkedItemId:        number; // itemType="ticket" tapi itemId kosong — item diketik manual/bebas,
                                  // tidak pernah dipilih dari daftar tiket saat invoice dibuat.
                                  // TIDAK BISA disinkronkan otomatis (tidak tahu event/tiket mana).
  ticketNotFound:        number; // itemId ada tapi tidak match event_tickets manapun (tiket sudah
                                  // dihapus/diganti sejak invoice dibuat).
  totalTicketItems:      number;
};

export async function createEventRegistrationsFromInvoiceTickets(
  tx: TenantTx,
  tenantDb: ReturnType<typeof createTenantDb>,
  invoiceId: string,
  invoiceMemberId: string | null,
  invoiceProfileId: string | null,
): Promise<EventTicketBackfillResult> {
  const { schema } = tenantDb;
  const result: EventTicketBackfillResult = {
    created: [], existingRegistrations: [], alreadySynced: 0,
    unlinkedItemId: 0, ticketNotFound: 0, totalTicketItems: 0,
  };

  const ticketItems = await tx
    .select({
      itemId:      schema.invoiceItems.itemId,
      name:        schema.invoiceItems.name,
      description: schema.invoiceItems.description,
    })
    .from(schema.invoiceItems)
    .where(and(
      eq(schema.invoiceItems.invoiceId, invoiceId),
      eq(schema.invoiceItems.itemType, "ticket"),
    ));

  result.totalTicketItems = ticketItems.length;

  for (const item of ticketItems) {
    if (!item.itemId) { result.unlinkedItemId++; continue; }

    // Resolve event+judul DULU (dipakai baik untuk baris baru maupun untuk laporan "sudah
    // ada" — supaya admin bisa lihat persis event mana yang dimaksud, bukan cuma pesan
    // generik "sudah tersinkron").
    const [ticket] = await tx
      .select({ eventId: schema.eventTickets.eventId, eventTitle: schema.events.title, eventSlug: schema.events.slug })
      .from(schema.eventTickets)
      .innerJoin(schema.events, eq(schema.eventTickets.eventId, schema.events.id))
      .where(eq(schema.eventTickets.id, item.itemId))
      .limit(1);
    if (!ticket?.eventId) { result.ticketNotFound++; continue; }

    const [existing] = await tx
      .select({
        id:           schema.eventRegistrations.id,
        attendeeName: schema.eventRegistrations.attendeeName,
        status:       schema.eventRegistrations.status,
        regNumber:    schema.eventRegistrations.registrationNumber,
      })
      .from(schema.eventRegistrations)
      .where(and(
        eq(schema.eventRegistrations.ticketId, item.itemId),
        sql`${schema.eventRegistrations.customFields}->>'sourceInvoiceId' = ${invoiceId}`,
      ))
      .limit(1);
    if (existing) {
      result.alreadySynced++;
      result.existingRegistrations.push({
        id:           existing.id,
        eventId:      ticket.eventId,
        eventTitle:   ticket.eventTitle,
        eventSlug:    ticket.eventSlug,
        regNumber:    existing.regNumber,
        attendeeName: existing.attendeeName,
        status:       existing.status,
      });
      continue;
    }

    const { attendeeName, attendeePhone, attendeeEmail, extraFields } =
      parseAttendeeFromInvoiceItem({ name: item.name ?? "Peserta", description: item.description });

    const regNumber = await generateEventRegNumber(tenantDb);

    await tx.insert(schema.eventRegistrations).values({
      eventId:             ticket.eventId,
      ticketId:            item.itemId,
      memberId:            invoiceMemberId,
      profileId:           invoiceProfileId,
      attendeeName,
      attendeePhone,
      attendeeEmail,
      registrationNumber:  regNumber,
      status:              "confirmed",
      customFields:        { sourceInvoiceId: invoiceId, ...(extraFields ?? {}) },
    });

    result.created.push({
      eventId: ticket.eventId, eventTitle: ticket.eventTitle, eventSlug: ticket.eventSlug,
      regNumber, attendeeName, attendeePhone,
    });
  }

  return result;
}

// ─── Checkout tiket yang belum lunas (belum punya baris registrasi) ───────────

export type PendingTicketCheckout = {
  invoiceId:      string;
  invoiceNumber:  string;
  invoiceStatus:  string;                     // "pending" | "waiting_verification" | "partial" | "overdue"
  paidAmount:     number;
  voucherCode:    string | null;
  ticketId:       string;
  ticketName:     string;
  ticketPrice:    number;
  attendeeName:   string;
  attendeePhone:  string | null;
  attendeeEmail:  string | null;
  extraFields:    Record<string, unknown> | null;
  memberId:       string | null;
  profileId:      string | null;
  createdAt:      Date;
};

// Orang yang sudah checkout tiket (invoice + invoice_items sudah ada) tapi invoicenya BELUM
// lunas dan BELUM dibatalkan — jalur cart (addEventTicketToCartAction) sengaja TIDAK pernah
// membuat baris event_registrations sampai invoice.status === "paid" (lihat
// createEventRegistrationsFromInvoiceTickets di atas), jadi orang-orang ini nol jejak di tabel
// registrasi. Fungsi ini murni BACA — tidak membuat/mengubah apa pun — dipakai untuk
// menampilkan mereka sebagai baris "Menunggu" tambahan di admin + export, TANPA mengubah kapan
// baris registrasi sungguhan dibuat.
//
// Invariant yang dipakai (bukan diverifikasi ulang di sini — enforced oleh satu-satunya fungsi
// pembuat registrasi di atas): invoice yang statusnya BUKAN 'paid' TIDAK PERNAH punya baris
// event_registrations untuk item tiketnya. Kalau invariant ini berubah, fungsi ini perlu direvisi.
export async function getPendingTicketCheckouts(
  tenantDb: ReturnType<typeof createTenantDb>,
  eventId: string,
): Promise<PendingTicketCheckout[]> {
  const { db, schema } = tenantDb;

  const ticketRows = await db
    .select({ id: schema.eventTickets.id, name: schema.eventTickets.name, price: schema.eventTickets.price })
    .from(schema.eventTickets)
    .where(eq(schema.eventTickets.eventId, eventId));
  if (ticketRows.length === 0) return [];
  const ticketIds = ticketRows.map((t) => t.id);
  const ticketMap = new Map(ticketRows.map((t) => [t.id, t]));

  const rows = await db
    .select({
      invoiceId:     schema.invoiceItems.invoiceId,
      itemId:        schema.invoiceItems.itemId,
      itemName:      schema.invoiceItems.name,
      description:   schema.invoiceItems.description,
      invoiceNumber: schema.invoices.invoiceNumber,
      invoiceStatus: schema.invoices.status,
      paidAmount:    schema.invoices.paidAmount,
      voucherCode:   schema.invoices.voucherCode,
      memberId:      schema.invoices.memberId,
      profileId:     schema.invoices.profileId,
      createdAt:     schema.invoices.createdAt,
    })
    .from(schema.invoiceItems)
    .innerJoin(schema.invoices, eq(schema.invoices.id, schema.invoiceItems.invoiceId))
    .where(and(
      eq(schema.invoiceItems.itemType, "ticket"),
      inArray(schema.invoiceItems.itemId, ticketIds),
      sql`${schema.invoices.status} NOT IN ('paid', 'cancelled')`,
    ))
    .orderBy(schema.invoices.createdAt);

  return rows
    .filter((r): r is typeof r & { itemId: string } => r.itemId != null)
    .map((r) => {
      const ticket = ticketMap.get(r.itemId)!;
      const { attendeeName, attendeePhone, attendeeEmail, extraFields } =
        parseAttendeeFromInvoiceItem({ name: r.itemName ?? "Peserta", description: r.description });
      return {
        invoiceId:     r.invoiceId,
        invoiceNumber: r.invoiceNumber,
        invoiceStatus: r.invoiceStatus,
        paidAmount:    parseFloat(String(r.paidAmount ?? 0)),
        voucherCode:   r.voucherCode,
        ticketId:      r.itemId,
        ticketName:    ticket.name,
        ticketPrice:   parseFloat(String(ticket.price)),
        attendeeName, attendeePhone, attendeeEmail, extraFields,
        memberId:      r.memberId,
        profileId:     r.profileId,
        createdAt:     r.createdAt!,
      };
    });
}
