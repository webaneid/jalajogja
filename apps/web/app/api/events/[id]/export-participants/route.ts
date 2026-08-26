export const dynamic = "force-dynamic";
// GET /api/events/[id]/export-participants?tenant={slug}&all=1
// Export peserta event ke Excel. Kolom sesuai urutan: No. Registrasi, Status Pendaftaran,
// Nomor Stambuk, Nama Lengkap, Nomor Telepon, Nomor WhatsApp, Alamat, Kabupaten, Kode Pos,
// Profesi/Pekerjaan, Angkatan, Jenis Kelamin, custom field event (dinamis per event),
// Status Pembayaran, Total Dibayarkan, Kode Voucher, Tanggal Transfer, Cara Transfer.
//
// Filter peserta — DUA MODE:
//   - Default (tanpa ?all=1): HANYA status IN ('confirmed', 'attended') — konsisten dengan
//     `isPaid` di event-registration-list.tsx.
//   - `?all=1`: SEMUA registrasi tanpa filter status (termasuk 'pending' dan 'cancelled') —
//     kolom "Status Pendaftaran" membedakan baris mana yang mana.
//
// Dua jalur invoice per registrasi (lihat acara/[id]/page.tsx untuk pola query yang sama):
//   1. Alur lama (registerForEventAction): invoices.sourceType='event_registration',
//      sourceId=registration.id.
//   2. Alur cart (addEventTicketToCartAction, auto-create saat invoice lunas): invoice TIDAK
//      direferensikan langsung dari registrasi — disimpan di
//      registration.customFields.sourceInvoiceId (lihat billing/actions.ts).
//
// "Status Pembayaran" (Lunas/Sebagian/Belum Bayar) dan "Total Dibayarkan" diturunkan LANGSUNG
// dari invoices.status + invoices.paidAmount (running total otentik, di-update atomik tiap
// konfirmasi) — BUKAN dijumlah manual dari baris payments, karena sebagian payment lama bisa
// saja metadatanya (tanggal/metode) kosong dari alur konfirmasi yang belum rapi dulu. Untuk
// "Belum Bayar", Total Dibayarkan sengaja DIKOSONGKAN (bukan 0) supaya mudah di-SUM/filter.
// "Kode Voucher" dari invoices.voucherCode — kosong berarti bayar mandiri tanpa voucher.
// "Tanggal Transfer"/"Cara Transfer" tetap diambil dari payment PALING BARU (by confirmedAt,
// status='paid') sebagai representasi tunggal per baris — boleh kosong jika tidak ada data.

import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { eq, and, inArray, sql } from "drizzle-orm";
import { getTenantAccess } from "@/lib/tenant";
import { hasReadAccess } from "@/lib/permissions";
import {
  createTenantDb, db as publicDb, members, contacts, addresses, refRegencies, refProfessions,
} from "@jalajogja/db";
import { displayPhone } from "@/lib/phone";
import { formatFieldValue, type CustomFormField } from "@/lib/event-custom-form";

const GENDER_LABEL: Record<string, string> = { male: "Laki-laki", female: "Perempuan" };

const REG_STATUS_LABEL: Record<string, string> = {
  pending: "Menunggu", confirmed: "Dikonfirmasi", cancelled: "Dibatalkan", attended: "Hadir",
};

const METHOD_LABEL: Record<string, string> = {
  cash: "Tunai", transfer: "Transfer Bank", qris: "QRIS",
  midtrans: "Midtrans", xendit: "Xendit", ipaymu: "iPaymu",
};

function formatDateSimple(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: eventId } = await params;
  const slug = req.nextUrl.searchParams.get("tenant") ?? req.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "Parameter tenant wajib diisi." }, { status: 400 });
  const includeAll = req.nextUrl.searchParams.get("all") === "1";

  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasReadAccess(access.tenantUser, "event")) {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  const tenantClient = createTenantDb(slug);
  const { db, schema } = tenantClient;

  const [event] = await db
    .select({ title: schema.events.title, customFormFields: schema.events.customFormFields })
    .from(schema.events)
    .where(eq(schema.events.id, eventId))
    .limit(1);
  if (!event) return NextResponse.json({ error: "Event tidak ditemukan." }, { status: 404 });

  const customFields = (event.customFormFields as CustomFormField[] | null) ?? [];

  const tickets = await db
    .select({ id: schema.eventTickets.id, price: schema.eventTickets.price })
    .from(schema.eventTickets)
    .where(eq(schema.eventTickets.eventId, eventId));
  const ticketMap = new Map(tickets.map((t) => [t.id, t]));

  const regs = await db
    .select({
      id:                 schema.eventRegistrations.id,
      registrationNumber: schema.eventRegistrations.registrationNumber,
      status:             schema.eventRegistrations.status,
      ticketId:           schema.eventRegistrations.ticketId,
      memberId:           schema.eventRegistrations.memberId,
      attendeeName:       schema.eventRegistrations.attendeeName,
      attendeePhone:      schema.eventRegistrations.attendeePhone,
      customFieldsData:   schema.eventRegistrations.customFields,
    })
    .from(schema.eventRegistrations)
    .where(
      includeAll
        ? eq(schema.eventRegistrations.eventId, eventId)
        : and(
            eq(schema.eventRegistrations.eventId, eventId),
            inArray(schema.eventRegistrations.status, ["confirmed", "attended"]),
          )
    )
    .orderBy(schema.eventRegistrations.createdAt);

  if (regs.length === 0) {
    return NextResponse.json({
      error: includeAll
        ? "Belum ada peserta yang mendaftar untuk event ini."
        : "Belum ada peserta yang sudah bayar/dikonfirmasi untuk event ini.",
    }, { status: 400 });
  }

  // ── Resolve invoice per registrasi (2 jalur, lihat komentar file) ──────────────
  const regIds = regs.map((r) => r.id);
  const legacyInvoices = await db
    .select({ id: schema.invoices.id, sourceId: schema.invoices.sourceId })
    .from(schema.invoices)
    .where(and(
      sql`${schema.invoices.sourceType} = 'event_registration'`,
      inArray(schema.invoices.sourceId, regIds),
    ));
  const legacyInvoiceByReg = new Map(legacyInvoices.map((i) => [i.sourceId, i.id]));

  const invoiceIdByReg = new Map<string, string>();
  for (const r of regs) {
    const legacyId = legacyInvoiceByReg.get(r.id);
    if (legacyId) { invoiceIdByReg.set(r.id, legacyId); continue; }
    const cf = r.customFieldsData as Record<string, unknown> | null;
    const cartInvoiceId = cf?.sourceInvoiceId;
    if (typeof cartInvoiceId === "string") invoiceIdByReg.set(r.id, cartInvoiceId);
  }
  const invoiceIds = [...new Set(invoiceIdByReg.values())];

  const paymentRows = invoiceIds.length > 0
    ? await db
        .select({
          sourceId:     schema.payments.sourceId,
          amount:       schema.payments.amount,
          method:       schema.payments.method,
          transferDate: schema.payments.transferDate,
          confirmedAt:  schema.payments.confirmedAt,
        })
        .from(schema.payments)
        .where(and(
          sql`${schema.payments.sourceType} = 'invoice'`,
          inArray(schema.payments.sourceId, invoiceIds),
          eq(schema.payments.status, "paid"),
        ))
    : [];
  const paymentsByInvoice = new Map<string, typeof paymentRows>();
  for (const p of paymentRows) {
    if (!p.sourceId) continue;
    const arr = paymentsByInvoice.get(p.sourceId) ?? [];
    arr.push(p);
    paymentsByInvoice.set(p.sourceId, arr);
  }

  // Status pembayaran otentik + kode voucher — langsung dari invoices, bukan dijumlah
  // manual dari payments (lihat komentar file di atas).
  const invoiceRows = invoiceIds.length > 0
    ? await db
        .select({
          id:          schema.invoices.id,
          status:      schema.invoices.status,
          paidAmount:  schema.invoices.paidAmount,
          voucherCode: schema.invoices.voucherCode,
        })
        .from(schema.invoices)
        .where(inArray(schema.invoices.id, invoiceIds))
    : [];
  const invoiceMap = new Map(invoiceRows.map((i) => [i.id, i]));

  // ── Batch fetch data anggota (public schema) ───────────────────────────────────
  const memberIds = [...new Set(regs.map((r) => r.memberId).filter((x): x is string => !!x))];
  const memberRows = memberIds.length > 0
    ? await publicDb
        .select({
          id: members.id, stambukNumber: members.stambukNumber, gender: members.gender,
          graduationYear: members.graduationYear, graduationPeriod: members.graduationPeriod,
          professionId: members.professionId, homeAddressId: members.homeAddressId,
          contactId: members.contactId,
        })
        .from(members)
        .where(inArray(members.id, memberIds))
    : [];
  const memberMap = new Map(memberRows.map((m) => [m.id, m]));

  const contactIds = [...new Set(memberRows.map((m) => m.contactId).filter((x): x is string => !!x))];
  const contactRows = contactIds.length > 0
    ? await publicDb
        .select({ id: contacts.id, phone: contacts.phone, whatsapp: contacts.whatsapp })
        .from(contacts)
        .where(inArray(contacts.id, contactIds))
    : [];
  const contactMap = new Map(contactRows.map((c) => [c.id, c]));

  const addressIds = [...new Set(memberRows.map((m) => m.homeAddressId).filter((x): x is string => !!x))];
  const addressRows = addressIds.length > 0
    ? await publicDb
        .select({ id: addresses.id, detail: addresses.detail, regencyId: addresses.regencyId, postalCode: addresses.postalCode })
        .from(addresses)
        .where(inArray(addresses.id, addressIds))
    : [];
  const addressMap = new Map(addressRows.map((a) => [a.id, a]));

  const regencyIds = [...new Set(addressRows.map((a) => a.regencyId).filter((x): x is number => x != null))];
  const regencyRows = regencyIds.length > 0
    ? await publicDb.select({ id: refRegencies.id, name: refRegencies.name }).from(refRegencies).where(inArray(refRegencies.id, regencyIds))
    : [];
  const regencyMap = new Map(regencyRows.map((r) => [r.id, r.name]));

  const professionIds = [...new Set(memberRows.map((m) => m.professionId).filter((x): x is number => x != null))];
  const professionRows = professionIds.length > 0
    ? await publicDb.select({ id: refProfessions.id, name: refProfessions.name }).from(refProfessions).where(inArray(refProfessions.id, professionIds))
    : [];
  const professionMap = new Map(professionRows.map((p) => [p.id, p.name]));

  // ── Susun baris Excel ────────────────────────────────────────────────────────
  const headers = [
    "No. Registrasi", "Status Pendaftaran", "Nomor Stambuk", "Nama Lengkap", "Nomor Telepon",
    "Nomor WhatsApp", "Alamat", "Kabupaten", "Kode Pos", "Profesi/Pekerjaan", "Angkatan",
    "Jenis Kelamin",
    ...customFields.map((f) => f.label),
    "Status Pembayaran", "Total Dibayarkan", "Kode Voucher", "Tanggal Transfer", "Cara Transfer",
  ];

  const dataRows = regs.map((r) => {
    const ticket = ticketMap.get(r.ticketId);
    const isFree = !ticket || parseFloat(String(ticket.price)) <= 0;

    const member       = r.memberId ? memberMap.get(r.memberId) : undefined;
    const contact      = member?.contactId ? contactMap.get(member.contactId) : undefined;
    const address      = member?.homeAddressId ? addressMap.get(member.homeAddressId) : undefined;
    const regencyName  = address?.regencyId != null ? regencyMap.get(address.regencyId) : undefined;
    const professionNm = member?.professionId != null ? professionMap.get(member.professionId) : undefined;

    let angkatan = "";
    if (member?.graduationYear) {
      angkatan = String(member.graduationYear);
      if (member.graduationYear === 1999 && member.graduationPeriod) {
        angkatan += ` (${member.graduationPeriod === "awal" ? "Awal" : "Akhir"})`;
      }
    }

    const invoiceId = invoiceIdByReg.get(r.id);
    const invoice   = invoiceId ? invoiceMap.get(invoiceId) : undefined;
    const payments  = invoiceId ? (paymentsByInvoice.get(invoiceId) ?? []) : [];
    const latestPayment = payments.length > 0
      ? payments.reduce((a, b) =>
          new Date(b.confirmedAt ?? 0).getTime() > new Date(a.confirmedAt ?? 0).getTime() ? b : a)
      : null;

    // Status Pembayaran + Total Dibayarkan — dari invoices.status/paidAmount langsung
    // (lihat komentar file). "Belum Bayar" → total DIKOSONGKAN (bukan 0), sesuai permintaan.
    let paymentStatusLabel: string;
    let totalDibayarkan: number | string;
    if (isFree) {
      paymentStatusLabel = "Lunas";
      totalDibayarkan    = 0;
    } else if (invoice?.status === "paid") {
      paymentStatusLabel = "Lunas";
      totalDibayarkan    = parseFloat(String(invoice.paidAmount));
    } else if (invoice?.status === "partial") {
      paymentStatusLabel = "Sebagian";
      totalDibayarkan    = parseFloat(String(invoice.paidAmount));
    } else {
      paymentStatusLabel = "Belum Bayar";
      totalDibayarkan    = "";
    }

    const customFieldsData = r.customFieldsData as Record<string, unknown> | null;
    const customFieldValues = customFields.map((f) => {
      const val = customFieldsData?.[f.key];
      return val == null || val === "" ? "" : formatFieldValue(val);
    });

    return [
      r.registrationNumber,
      REG_STATUS_LABEL[r.status] ?? r.status,
      member?.stambukNumber ?? "",
      r.attendeeName,
      contact?.phone ? displayPhone(contact.phone) : (r.attendeePhone ? displayPhone(r.attendeePhone) : ""),
      contact?.whatsapp ? displayPhone(contact.whatsapp) : "",
      address?.detail ?? "",
      regencyName ?? "",
      address?.postalCode ?? "",
      professionNm ?? "",
      angkatan,
      member?.gender ? (GENDER_LABEL[member.gender] ?? "") : "",
      ...customFieldValues,
      paymentStatusLabel,
      totalDibayarkan,
      invoice?.voucherCode ?? "",
      isFree ? "—" : formatDateSimple(latestPayment?.transferDate ?? null),
      isFree ? "Gratis" : (latestPayment ? (METHOD_LABEL[latestPayment.method] ?? latestPayment.method) : ""),
    ];
  });

  const wb = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
  XLSX.utils.book_append_sheet(wb, sheet, "Peserta");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  const safeName = event.title.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
  const fileSuffix = includeAll ? "-semua" : "";

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="peserta-${safeName}${fileSuffix}.xlsx"`,
    },
  });
}
