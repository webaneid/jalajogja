import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect, notFound } from "next/navigation";
import { eq, count, and, inArray, sql } from "drizzle-orm";
import Link from "next/link";
import { CalendarDays, MapPin, Globe, Users, Pencil, Ticket, UserCheck, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EventRegistrationList, type RegistrationRow } from "@/components/event/event-registration-list";
import { getTenantTimezone, formatInTz } from "@/lib/tenant-timezone.server";

function formatDate(d: Date | null, timezone: string) {
  if (!d) return "—";
  return formatInTz(d, timezone, {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const STATUS_COLORS: Record<string, string> = {
  draft:      "bg-muted text-muted-foreground",
  published:  "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200",
  cancelled:  "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200",
  completed:  "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200",
};

const STATUS_LABELS: Record<string, string> = {
  draft:      "Draft",
  published:  "Dipublikasikan",
  cancelled:  "Dibatalkan",
  completed:  "Selesai",
};

export default async function AcaraDetailPage({
  params,
}: {
  params: Promise<{ tenant: string; id: string }>;
}) {
  const { tenant: slug, id: eventId } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/app/login");

  const tenantClient = createTenantDb(slug);
  const { db, schema } = tenantClient;
  const tenantTimezone = await getTenantTimezone(tenantClient);

  const [[event], tickets] = await Promise.all([
    db.select().from(schema.events).where(eq(schema.events.id, eventId)).limit(1),
    db.select()
      .from(schema.eventTickets)
      .where(eq(schema.eventTickets.eventId, eventId))
      .orderBy(schema.eventTickets.sortOrder),
  ]);

  if (!event) notFound();

  // Statistik pendaftaran
  const [{ total }] = await db
    .select({ total: count() })
    .from(schema.eventRegistrations)
    .where(eq(schema.eventRegistrations.eventId, eventId));

  const [{ confirmed }] = await db
    .select({ confirmed: count() })
    .from(schema.eventRegistrations)
    .where(and(
      eq(schema.eventRegistrations.eventId, eventId),
      eq(schema.eventRegistrations.status, "confirmed")
    ));

  const [{ attended }] = await db
    .select({ attended: count() })
    .from(schema.eventRegistrations)
    .where(and(
      eq(schema.eventRegistrations.eventId, eventId),
      eq(schema.eventRegistrations.status, "attended")
    ));

  const [{ pending }] = await db
    .select({ pending: count() })
    .from(schema.eventRegistrations)
    .where(and(
      eq(schema.eventRegistrations.eventId, eventId),
      eq(schema.eventRegistrations.status, "pending")
    ));

  // Fetch registrasi + tiket + payment
  const rawRegs = await db
    .select({
      id:                 schema.eventRegistrations.id,
      registrationNumber: schema.eventRegistrations.registrationNumber,
      attendeeName:       schema.eventRegistrations.attendeeName,
      attendeePhone:      schema.eventRegistrations.attendeePhone,
      attendeeEmail:      schema.eventRegistrations.attendeeEmail,
      status:             schema.eventRegistrations.status,
      checkedInAt:        schema.eventRegistrations.checkedInAt,
      certificateUrl:     schema.eventRegistrations.certificateUrl,
      createdAt:          schema.eventRegistrations.createdAt,
      ticketId:           schema.eventRegistrations.ticketId,
    })
    .from(schema.eventRegistrations)
    .where(eq(schema.eventRegistrations.eventId, eventId))
    .orderBy(schema.eventRegistrations.createdAt);

  const ticketMap = new Map(tickets.map((t) => [t.id, t]));

  // Query invoice per registrasi (alur cart/publik: sourceType='event_registration')
  const regIds = rawRegs.map((r) => r.id);
  const invoiceRows = regIds.length > 0
    ? await db
        .select({
          id:       schema.invoices.id,
          sourceId: schema.invoices.sourceId,
          status:   schema.invoices.status,
          invoiceNumber: schema.invoices.invoiceNumber,
        })
        .from(schema.invoices)
        .where(and(
          sql`${schema.invoices.sourceType} = 'event_registration'`,
          inArray(schema.invoices.sourceId, regIds),
        ))
    : [];

  // invoiceMap: regId → invoice
  const invoiceMap = new Map(invoiceRows.map((i) => [i.sourceId, i]));

  // Query payment yang sudah di-submit (sourceType='invoice', alur publik baru)
  const invoiceIds = invoiceRows.map((i) => i.id);
  const paymentRows = invoiceIds.length > 0
    ? await db
        .select({
          id:       schema.payments.id,
          sourceId: schema.payments.sourceId,   // invoiceId
          status:   schema.payments.status,
          method:   schema.payments.method,
          proofUrl: schema.payments.proofUrl,
        })
        .from(schema.payments)
        .where(and(
          sql`${schema.payments.sourceType} = 'invoice'`,
          inArray(schema.payments.sourceId, invoiceIds),
          inArray(schema.payments.status, ["submitted", "paid"]),
        ))
    : [];

  // paymentByInvoice: invoiceId → payment
  const paymentByInvoice = new Map(paymentRows.map((p) => [p.sourceId, p]));

  const registrations: RegistrationRow[] = rawRegs.map((r) => {
    const ticket  = ticketMap.get(r.ticketId ?? "");
    const invoice = invoiceMap.get(r.id);
    const payment = invoice ? paymentByInvoice.get(invoice.id) : undefined;
    return {
      id:                 r.id,
      registrationNumber: r.registrationNumber,
      attendeeName:       r.attendeeName,
      attendeePhone:      r.attendeePhone ?? null,
      attendeeEmail:      r.attendeeEmail ?? null,
      status:             r.status as RegistrationRow["status"],
      checkedInAt:        r.checkedInAt ?? null,
      ticketName:         ticket?.name ?? "—",
      ticketPrice:        ticket ? parseFloat(String(ticket.price)) : 0,
      paymentId:          payment?.id ?? null,
      paymentStatus:      (payment?.status ?? null) as RegistrationRow["paymentStatus"],
      paymentMethod:      payment?.method ?? null,
      invoiceId:          invoice?.id ?? null,
      invoiceStatus:      invoice?.status ?? null,
      proofUrl:           payment?.proofUrl ?? null,
      certificateUrl:     r.certificateUrl ?? null,
      createdAt:          r.createdAt!,
    };
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/app/${slug}/event/acara`}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Acara
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-medium truncate max-w-[200px]">{event.title}</span>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Event Info */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold">{event.title}</h1>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[event.status]}`}>
                {STATUS_LABELS[event.status]}
              </span>
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                {formatDate(event.startsAt, tenantTimezone)}
              </span>
              {event.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {event.location}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            {event.status === "published" && (
              <Link
                href={`/app/${slug}/event/acara/${eventId}/checkin`}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
              >
                <UserCheck className="h-4 w-4" />
                Check-in
              </Link>
            )}
            <Link
              href={`/app/${slug}/event/acara/${eventId}/edit`}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </Link>
          </div>
        </div>

        {/* Statistik */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Daftar",   value: total,     icon: Ticket,    color: "text-foreground"   },
            { label: "Dikonfirmasi",   value: confirmed, icon: CalendarDays, color: "text-green-600" },
            { label: "Menunggu",       value: pending,   icon: Globe,     color: "text-amber-600"   },
            { label: "Hadir",          value: attended,  icon: UserCheck, color: "text-blue-600"    },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-xl border border-border bg-card p-4 space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{label}</p>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <p className={`text-2xl font-bold ${color}`}>{Number(value)}</p>
            </div>
          ))}
        </div>

        {/* Tiket Aktif */}
        {tickets.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold">Tiket</h2>
            <div className="flex flex-wrap gap-2">
              {tickets.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm"
                >
                  <Ticket className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{t.name}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="font-medium">
                    {parseFloat(String(t.price)) <= 0
                      ? "Gratis"
                      : new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(parseFloat(String(t.price)))}
                  </span>
                  {!t.isActive && <Badge variant="secondary" className="text-xs">Nonaktif</Badge>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Daftar Pendaftaran */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Daftar Pendaftar</h2>
            <Button asChild variant="outline" size="sm" className="h-7 px-2 text-xs">
              <a href={`/api/events/${eventId}/export-participants?tenant=${slug}`}>
                <Download className="h-3 w-3 mr-1" />
                Export ke Excel
              </a>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground -mt-1">
            Hanya peserta yang sudah dikonfirmasi/bayar (status Dikonfirmasi atau Hadir) yang diikutkan.
          </p>
          <EventRegistrationList
            slug={slug}
            eventId={eventId}
            registrations={registrations}
            timezone={tenantTimezone}
          />
        </div>
      </main>
    </div>
  );
}
