import { redirect }     from "next/navigation";
import { headers }      from "next/headers";
import { eq, and, or, desc, inArray, sql } from "drizzle-orm";
import { auth }         from "@/lib/auth";
import { db, members, contacts, profiles, createTenantDb } from "@jalajogja/db";
import { generateQrDataUrl } from "@/lib/qr-code";
import { displayPhone }      from "@/lib/phone";
import { getAkunIdentity }   from "@/lib/akun-identity";
import { AkunEventList }     from "@/components/akun/akun-event-list";

type Params = Promise<{ tenant: string }>;

const STATUS_LABEL: Record<string, string> = {
  pending:   "Menunggu",
  confirmed: "Dikonfirmasi",
  attended:  "Sudah Hadir",
  cancelled: "Dibatalkan",
};

export default async function AkunEventPage({ params }: { params: Params }) {
  const { tenant: slug } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect(`/${slug}/login?redirect=/${slug}/akun/event`);

  const identity = await getAkunIdentity(session.user.id);
  if (!identity) redirect(`/${slug}/akun-error`);

  // Resolve identitas untuk query
  let resolvedMemberId:  string | null = null;
  let resolvedEmail:     string | null = null;
  let resolvedPhone:     string | null = null;

  if (identity.type === "member" && identity.memberId) {
    resolvedMemberId = identity.memberId;
    // Ambil email + phone dari contacts
    const [member] = await db
      .select({ contactId: members.contactId })
      .from(members).where(eq(members.id, identity.memberId)).limit(1);
    if (member?.contactId) {
      const [contact] = await db
        .select({ email: contacts.email, phone: contacts.phone, whatsapp: contacts.whatsapp })
        .from(contacts).where(eq(contacts.id, member.contactId)).limit(1);
      resolvedEmail = contact?.email ?? null;
      resolvedPhone = contact?.whatsapp ?? contact?.phone ?? null;
    }
  } else {
    // Akun publik
    const [profile] = await db
      .select({ email: profiles.email, phone: profiles.phone, whatsapp: profiles.whatsapp })
      .from(profiles).where(eq(profiles.betterAuthUserId, session.user.id)).limit(1);
    resolvedEmail = profile?.email ?? session.user.email ?? null;
    resolvedPhone = profile?.whatsapp ?? profile?.phone ?? null;
  }

  const { db: tenantDb, schema } = createTenantDb(slug);

  // Bangun kondisi: cari registrasi by memberId ATAU email
  const identityConditions = [];
  if (resolvedMemberId) identityConditions.push(eq(schema.eventRegistrations.memberId, resolvedMemberId));
  if (resolvedEmail)    identityConditions.push(eq(schema.eventRegistrations.attendeeEmail, resolvedEmail));

  if (identityConditions.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold">Riwayat Event</h1>
        <p className="text-sm text-muted-foreground">Belum ada data yang dapat ditampilkan.</p>
      </div>
    );
  }

  const regs = await tenantDb
    .select({
      id:                 schema.eventRegistrations.id,
      registrationNumber: schema.eventRegistrations.registrationNumber,
      status:             schema.eventRegistrations.status,
      attendeeName:       schema.eventRegistrations.attendeeName,
      attendeePhone:      schema.eventRegistrations.attendeePhone,
      attendeeEmail:      schema.eventRegistrations.attendeeEmail,
      ticketId:           schema.eventRegistrations.ticketId,
      eventId:            schema.eventRegistrations.eventId,
      createdAt:          schema.eventRegistrations.createdAt,
      eventTitle:         schema.events.title,
      eventSlug:          schema.events.slug,
      eventStartsAt:      schema.events.startsAt,
      ticketName:         schema.eventTickets.name,
    })
    .from(schema.eventRegistrations)
    .leftJoin(schema.events, eq(schema.events.id, schema.eventRegistrations.eventId))
    .leftJoin(schema.eventTickets, eq(schema.eventTickets.id, schema.eventRegistrations.ticketId))
    .where(and(
      or(...identityConditions),
      sql`${schema.eventRegistrations.status} != 'cancelled'`,
    ))
    .orderBy(desc(schema.eventRegistrations.createdAt))
    .limit(50);

  // Cari invoice yang terkait dengan registrasi ini (untuk link pembayaran + status)
  const regIds = regs.map(r => r.id);
  let invoiceMap: Record<string, { id: string; status: string }> = {};
  if (regIds.length > 0) {
    const invoiceRows = await tenantDb
      .select({ sourceId: schema.invoices.sourceId, id: schema.invoices.id, status: schema.invoices.status })
      .from(schema.invoices)
      .where(and(
        sql`${schema.invoices.sourceType} = 'event_registration'`,
        inArray(schema.invoices.sourceId, regIds),
      ));
    for (const row of invoiceRows) {
      if (row.sourceId) invoiceMap[row.sourceId] = { id: row.id, status: row.status };
    }
  }

  // Generate QR untuk tiap registrasi (hanya jika sudah confirmed/attended)
  const items = await Promise.all(regs.map(async (r) => {
    const status = r.status ?? "pending";
    const isPending = status === "pending";
    const invoice = invoiceMap[r.id] ?? null;
    const isWaitingVerif = invoice?.status === "waiting_verification";

    // QR hanya untuk tiket yang sudah dikonfirmasi
    let qrDataUrl: string | null = null;
    if (!isPending) {
      const lines = [
        `EVENT: ${r.eventTitle ?? "—"}`,
        `TIKET: ${r.ticketName ?? "—"}`,
        `NO: ${r.registrationNumber}`,
        `NAMA: ${r.attendeeName}`,
        r.attendeePhone ? `HP: ${displayPhone(r.attendeePhone)}` : null,
        r.attendeeEmail ? `EMAIL: ${r.attendeeEmail}` : null,
        `STATUS: ${status.toUpperCase()}`,
      ].filter(Boolean).join("\n");
      qrDataUrl = await generateQrDataUrl(lines, "#111827");
    }

    // Label status: jika menunggu verifikasi, tampilkan label berbeda
    const statusLabel = isWaitingVerif
      ? "Menunggu Verifikasi"
      : (STATUS_LABEL[status] ?? status);

    return {
      id:                 r.id,
      registrationNumber: r.registrationNumber,
      status,
      statusLabel,
      invoiceStatus:      invoice?.status ?? null,
      attendeeName:       r.attendeeName,
      attendeePhone:      displayPhone(r.attendeePhone),
      attendeeEmail:      r.attendeeEmail,
      ticketName:         r.ticketName ?? null,
      eventTitle:         r.eventTitle ?? "—",
      eventSlug:          r.eventSlug ?? null,
      eventStartsAt:      r.eventStartsAt ? r.eventStartsAt.toISOString() : null,
      qrDataUrl,
      invoiceId:          invoice?.id ?? null,
      tenantSlug:         slug,
    };
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Riwayat Event</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Keikutsertaan event Anda di {slug}.
        </p>
      </div>
      <AkunEventList items={items} />
    </div>
  );
}
