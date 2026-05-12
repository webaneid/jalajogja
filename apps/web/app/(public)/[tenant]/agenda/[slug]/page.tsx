// Halaman publik event — tanpa auth, siapapun bisa akses dan mendaftar
import { createTenantDb, db, tenants, members, contacts, getSettings } from "@jalajogja/db";
import { publicUrl } from "@/lib/minio";
import { eq, and, count, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { CalendarDays, MapPin, Globe, Users, Ticket, MapIcon, UserCheck, CheckCircle2 } from "lucide-react";
import { EventRegisterForm } from "@/components/event/event-register-form";
import { renderBody } from "@/lib/letter-render";

type BankAccount = {
  id: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  categories: string[];
};

type QrisAccount = {
  id: string;
  name: string;
  imageUrl?: string;
  categories: string[];
};

const TZ = "Asia/Jakarta";

function fmtTime(d: Date) {
  return new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ }).format(d);
}

// Tanggal pintar: hari sama → jam range; bulan sama → hari-hari range; beda bulan → full range
function formatEventDateRange(startsAt: Date | null, endsAt: Date | null): string {
  if (!startsAt) return "—";

  const s = new Date(startsAt);
  const e = endsAt ? new Date(endsAt) : null;

  const opts = (o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("id-ID", { ...o, timeZone: TZ });

  const sDateFull = opts({ weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(s);

  if (!e) return `${sDateFull}, Pukul ${fmtTime(s)} WIB`;

  // Bandingkan komponen tanggal di timezone WIB
  const [sDay, sMonth, sYear] = [
    opts({ day: "numeric" }).format(s),
    opts({ month: "long"  }).format(s),
    opts({ year: "numeric" }).format(s),
  ];
  const [eDay, eMonth, eYear] = [
    opts({ day: "numeric" }).format(e),
    opts({ month: "long"  }).format(e),
    opts({ year: "numeric" }).format(e),
  ];

  const sTimeStr = fmtTime(s);
  const eTimeStr = fmtTime(e);

  if (sDay === eDay && sMonth === eMonth && sYear === eYear) {
    // Hari yang sama
    return `${sDateFull}, Pukul ${sTimeStr} - ${eTimeStr} WIB`;
  }

  if (sMonth === eMonth && sYear === eYear) {
    // Beda hari, bulan sama
    const sWeekday = opts({ weekday: "long" }).format(s);
    const eWeekday = opts({ weekday: "long" }).format(e);
    return `${sWeekday} - ${eWeekday}, ${sDay} - ${eDay} ${sMonth} ${sYear}, Pukul ${sTimeStr} - ${eTimeStr} WIB`;
  }

  // Beda bulan
  const eDateFull = opts({ weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(e);
  return `${sDateFull} - ${eDateFull}`;
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  offline: "Offline",
  online:  "Online",
  hybrid:  "Hybrid (Online + Offline)",
};

export default async function PublicEventPage({
  params,
}: {
  params: Promise<{ tenant: string; slug: string }>;
}) {
  const { tenant: tenantSlug, slug: eventSlug } = await params;

  // Cek tenant valid
  const [tenant] = await db
    .select({ id: tenants.id, name: tenants.name, isActive: tenants.isActive })
    .from(tenants)
    .where(eq(tenants.slug, tenantSlug))
    .limit(1);

  if (!tenant || !tenant.isActive) notFound();

  const { db: tenantDb, schema } = createTenantDb(tenantSlug);

  // Fetch event by slug — hanya yang published
  const [event] = await tenantDb
    .select()
    .from(schema.events)
    .where(and(
      eq(schema.events.slug,   eventSlug),
      eq(schema.events.status, "published")
    ))
    .limit(1);

  if (!event) notFound();

  // Fetch tiket aktif
  const tickets = await tenantDb
    .select()
    .from(schema.eventTickets)
    .where(and(
      eq(schema.eventTickets.eventId,  event.id),
      eq(schema.eventTickets.isActive, true)
    ))
    .orderBy(schema.eventTickets.sortOrder);

  // Fetch cover image URL jika ada
  let coverUrl: string | null = null;
  if (event.coverId) {
    const [media] = await tenantDb
      .select({ path: schema.media.path })
      .from(schema.media)
      .where(eq(schema.media.id, event.coverId))
      .limit(1);
    coverUrl = media ? publicUrl(tenantSlug, media.path) : null;
  }

  // Fetch payment settings (bank accounts + QRIS) untuk tiket berbayar
  const [bankRow] = await tenantDb
    .select({ value: schema.settings.value })
    .from(schema.settings)
    .where(and(eq(schema.settings.key, "bank_accounts"), eq(schema.settings.group, "payment")))
    .limit(1);

  const [qrisRow] = await tenantDb
    .select({ value: schema.settings.value })
    .from(schema.settings)
    .where(and(eq(schema.settings.key, "qris_accounts"), eq(schema.settings.group, "payment")))
    .limit(1);

  const allBanks = (bankRow?.value as BankAccount[] | null) ?? [];
  const allQris  = (qrisRow?.value  as QrisAccount[] | null) ?? [];

  // Filter: "donasi" atau "general" sebagai fallback pembayaran event
  // TODO: tambah kategori "event" di settings payment saat ada tiket berbayar
  const banks        = allBanks.filter((b) => b.categories?.includes("donasi") || b.categories?.includes("general"));
  const qrisAccounts = allQris.filter((q)  => q.categories?.includes("donasi") || q.categories?.includes("general"));

  const hasPaidTicket = tickets.some((t) => parseFloat(String(t.price)) > 0);

  // ── showTicketCount: hitung sisa kuota per tiket ──────────────────────────
  type TicketCount = { ticketId: string; used: number };
  let ticketCounts: TicketCount[] = [];

  if (event.showTicketCount && tickets.some((t) => t.quota != null)) {
    const rows = await tenantDb
      .select({
        ticketId: schema.eventRegistrations.ticketId,
        used:     count(),
      })
      .from(schema.eventRegistrations)
      .where(and(
        eq(schema.eventRegistrations.eventId, event.id),
        sql`${schema.eventRegistrations.status} != 'cancelled'`
      ))
      .groupBy(schema.eventRegistrations.ticketId);

    ticketCounts = rows.map((r) => ({ ticketId: r.ticketId!, used: Number(r.used) }));
  }

  // ── showAttendeeList: ambil nama peserta yang confirmed/attended ──────────
  let attendeeNames: string[] = [];

  if (event.showAttendeeList) {
    const rows = await tenantDb
      .select({ name: schema.eventRegistrations.attendeeName })
      .from(schema.eventRegistrations)
      .where(and(
        eq(schema.eventRegistrations.eventId, event.id),
        sql`${schema.eventRegistrations.status} IN ('confirmed','attended')`
      ))
      .orderBy(schema.eventRegistrations.attendeeName);

    attendeeNames = rows.map((r) => r.name);
  }

  // Bangun info tiket untuk form (dengan sisa kuota)
  const ticketCountMap = new Map(ticketCounts.map((tc) => [tc.ticketId, tc.used]));
  const ticketsForForm = tickets.map((t) => ({
    id:          t.id,
    name:        t.name,
    price:       parseFloat(String(t.price)),
    quota:       t.quota,
    description: t.description,
    usedCount:   ticketCountMap.get(t.id) ?? 0,
  }));

  // Pre-fill data peserta dari session + cek sudah terdaftar
  const session = await auth.api.getSession({ headers: await headers() });
  let defaultAttendeeName  = "";
  let defaultAttendeePhone = "";
  let defaultAttendeeEmail = "";
  let alreadyRegistered: { registrationNumber: string; status: string } | null = null;
  let resolvedMemberId: string | null = null;

  if (session?.user?.id) {
    const [member] = await db
      .select({ id: members.id, name: members.name, contactId: members.contactId })
      .from(members)
      .where(eq(members.betterAuthUserId, session.user.id))
      .limit(1);
    if (member) {
      resolvedMemberId    = member.id;
      defaultAttendeeName = member.name ?? "";
      if (member.contactId) {
        const [contact] = await db
          .select({ phone: contacts.phone, whatsapp: contacts.whatsapp, email: contacts.email })
          .from(contacts)
          .where(eq(contacts.id, member.contactId))
          .limit(1);
        if (contact) {
          defaultAttendeePhone = contact.whatsapp ?? contact.phone ?? "";
          defaultAttendeeEmail = contact.email ?? "";
        }
      }
    }
    if (!defaultAttendeeName) defaultAttendeeName = session.user.name ?? "";
    if (!defaultAttendeeEmail) defaultAttendeeEmail = session.user.email ?? "";

    // Cek apakah sudah terdaftar (by memberId atau email)
    const dupConditions = [
      eq(schema.eventRegistrations.eventId, event.id),
      sql`${schema.eventRegistrations.status} != 'cancelled'`,
    ] as Parameters<typeof and>;

    if (resolvedMemberId) {
      dupConditions.push(eq(schema.eventRegistrations.memberId, resolvedMemberId));
    } else if (defaultAttendeeEmail) {
      dupConditions.push(eq(schema.eventRegistrations.attendeeEmail, defaultAttendeeEmail));
    }

    if (dupConditions.length > 2) {
      const [existing] = await tenantDb
        .select({
          registrationNumber: schema.eventRegistrations.registrationNumber,
          status:             schema.eventRegistrations.status,
        })
        .from(schema.eventRegistrations)
        .where(and(...dupConditions))
        .limit(1);
      if (existing) alreadyRegistered = existing;
    }
  }

  // Donation prompt data
  type DonationPromptData = { campaignId: string; campaignTitle: string; amounts: number[] } | null;
  let donationPrompt: DonationPromptData = null;
  if (event.showDonationPrompt && event.linkedCampaignId) {
    const [campaign] = await tenantDb
      .select({ id: schema.campaigns.id, title: schema.campaigns.title })
      .from(schema.campaigns)
      .where(and(eq(schema.campaigns.id, event.linkedCampaignId), eq(schema.campaigns.status, "active")))
      .limit(1);
    if (campaign) {
      const donasiSettings = await getSettings(createTenantDb(tenantSlug), "donasi");
      const dc = donasiSettings.donation_config as { recommended_amounts?: number[] } | undefined;
      donationPrompt = {
        campaignId:    campaign.id,
        campaignTitle: campaign.title,
        amounts:       dc?.recommended_amounts ?? [10000, 25000, 50000, 100000],
      };
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header minimal org */}
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          <span className="font-semibold text-sm">{tenant.name}</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_360px] items-start">

          {/* ── Kiri: Gambar + Info + Deskripsi ── */}
          <div className="space-y-6">
            {/* Cover */}
            {coverUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coverUrl}
                alt={event.title}
                className="w-full aspect-video object-cover rounded-xl border border-border"
              />
            )}

            {/* Judul + Meta */}
            <div className="space-y-3">
              <h1 className="text-2xl font-bold leading-tight">{event.title}</h1>

              <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4 shrink-0" />
                  {formatEventDateRange(event.startsAt, event.endsAt)}
                </span>
                {(event.eventType === "offline" || event.eventType === "hybrid") && event.location && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 shrink-0" />
                    {event.location}
                  </span>
                )}
                {(event.eventType === "online" || event.eventType === "hybrid") && (
                  <span className="inline-flex items-center gap-1.5">
                    <Globe className="h-4 w-4 shrink-0" />
                    {EVENT_TYPE_LABELS[event.eventType]}
                  </span>
                )}
                {event.organizerName && (
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="h-4 w-4 shrink-0" />
                    {event.organizerName}
                  </span>
                )}
              </div>

              {event.locationDetail && (
                <p className="text-sm text-muted-foreground">{event.locationDetail}</p>
              )}

              {event.mapsUrl && (event.eventType === "offline" || event.eventType === "hybrid") && (
                <a
                  href={event.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  <MapIcon className="h-4 w-4" />
                  Lihat di Google Maps
                </a>
              )}
            </div>

            {/* Deskripsi */}
            {event.description && (
              <div
                className="prose prose-sm max-w-none text-foreground [&_p]:my-2 [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-0.5 [&_h1]:text-xl [&_h2]:text-lg [&_h3]:text-base"
                dangerouslySetInnerHTML={{ __html: renderBody(event.description) }}
              />
            )}

            {/* Link online */}
            {event.onlineLink && (event.eventType === "online" || event.eventType === "hybrid") && (
              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-1">
                <p className="text-sm font-semibold">Link Bergabung</p>
                <a
                  href={event.onlineLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary underline break-all"
                >
                  {event.onlineLink}
                </a>
              </div>
            )}

            {/* Daftar peserta */}
            {event.showAttendeeList && attendeeNames.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-semibold flex items-center gap-1.5">
                  <UserCheck className="h-4 w-4 text-muted-foreground" />
                  Peserta Terdaftar ({attendeeNames.length})
                </p>
                <div className="rounded-lg border border-border bg-card p-4">
                  <ul className="space-y-1.5 text-sm text-muted-foreground columns-2">
                    {attendeeNames.map((name, i) => (
                      <li key={i} className="truncate">{name}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* ── Kanan: Form Pendaftaran (sticky) ── */}
          <div className="lg:sticky lg:top-6 space-y-4">
            {alreadyRegistered ? (
              /* Sudah terdaftar — tampilkan status, sembunyikan form */
              <div className="rounded-xl border border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800 p-6 text-center space-y-3">
                <CheckCircle2 className="h-10 w-10 mx-auto text-green-500" />
                <div>
                  <p className="font-semibold text-sm text-green-800 dark:text-green-200">Kamu Sudah Terdaftar</p>
                  <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                    No. Pendaftaran:{" "}
                    <span className="font-mono font-semibold">{alreadyRegistered.registrationNumber}</span>
                  </p>
                </div>
                {alreadyRegistered.status === "pending" && (
                  <p className="text-xs text-green-600 dark:text-green-400">
                    Pendaftaranmu sedang menunggu konfirmasi panitia.
                  </p>
                )}
                {alreadyRegistered.status === "confirmed" && (
                  <p className="text-xs text-green-600 dark:text-green-400">
                    Pendaftaranmu telah dikonfirmasi. Sampai jumpa di acara!
                  </p>
                )}
                {alreadyRegistered.status === "attended" && (
                  <p className="text-xs text-green-600 dark:text-green-400">
                    Kamu sudah hadir di acara ini.
                  </p>
                )}
              </div>
            ) : tickets.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
                <Ticket className="h-8 w-8 mx-auto mb-2 opacity-40" />
                Pendaftaran belum dibuka
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card p-4 space-y-4">
                {/* Info kuota tiket */}
                {event.showTicketCount && tickets.some((t) => t.quota != null) && (
                  <div className="space-y-2">
                    {tickets.map((t) => {
                      const used     = ticketCountMap.get(t.id) ?? 0;
                      const quota    = t.quota;
                      const isFull   = quota != null && used >= quota;
                      const sisaText = quota != null ? `${quota - used} sisa` : "Tidak terbatas";
                      return (
                        <div key={t.id} className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Ticket className="h-3 w-3" />
                            {t.name}
                          </span>
                          <span className={isFull ? "text-destructive font-medium" : ""}>
                            {isFull ? "Penuh" : sisaText}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                <p className="font-semibold text-sm">Daftar Sekarang</p>
                <EventRegisterForm
                  slug={tenantSlug}
                  eventId={event.id}
                  tickets={ticketsForForm}
                  requireApproval={event.requireApproval}
                  banks={banks}
                  qrisAccounts={qrisAccounts}
                  hasPaidTicket={hasPaidTicket}
                  donationPrompt={donationPrompt}
                  defaultAttendeeName={defaultAttendeeName}
                  defaultAttendeePhone={defaultAttendeePhone}
                  defaultAttendeeEmail={defaultAttendeeEmail}
                />
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="border-t border-border mt-12 px-6 py-4 text-center text-xs text-muted-foreground">
        {tenant.name} · Powered by jalajogja
      </footer>
    </div>
  );
}
