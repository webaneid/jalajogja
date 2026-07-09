// Halaman publik event — tanpa auth, siapapun bisa akses dan mendaftar
import { createTenantDb, db, tenants, members, contacts, profiles, tenantMemberships, getSettings } from "@jalajogja/db";
import { publicUrl } from "@/lib/minio";
import { eq, and, or, count, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { CalendarDays, MapPin, Globe, Building2, Navigation, ExternalLink, Video, Ticket, UserCheck, CheckCircle2 } from "lucide-react";
import { isOwnHost } from "@/lib/is-own-host";
import { EventRegisterForm } from "@/components/event/event-register-form";
import type { CustomFormField } from "@/lib/event-custom-form";
import { renderBody } from "@/lib/letter-render";
import { generateQrDataUrl } from "@/lib/qr-code";
import type { Metadata } from "next";
import { getTenantSeoBase } from "@/lib/tenant-seo";
import { generateMetadata as buildMetadata } from "@/lib/seo";

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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenant: string; slug: string }>;
}): Promise<Metadata> {
  const { tenant: slug, slug: eventSlug } = await params;
  const tenantClient = createTenantDb(slug);
  const { db: tenantDb, schema } = tenantClient;
  const [event, base] = await Promise.all([
    tenantDb
      .select({ title: schema.events.title, description: schema.events.description })
      .from(schema.events)
      .where(eq(schema.events.slug, eventSlug))
      .limit(1)
      .then((r) => r[0]),
    getTenantSeoBase(slug),
  ]);
  if (!event) return {};
  return buildMetadata({
    title:        event.title,
    description:  event.description ? event.description.slice(0, 160) : undefined,
    siteName:     base.siteName,
    canonicalUrl: `${base.baseUrl}/agenda/${eventSlug}`,
    ogImageUrl:   base.logoUrl,
  });
}

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

  const hdrs    = await headers();
  const host    = hdrs.get("host") ?? "";
  const baseUrl = isOwnHost(host) ? `/${tenantSlug}` : "";

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

  // Filter: cari kategori "event" dulu, fallback ke "general"
  function filterByCategory<T extends { categories?: string[] }>(accounts: T[], category: string): T[] {
    const specific = accounts.filter((a) => a.categories?.includes(category));
    if (specific.length > 0) return specific;
    return accounts.filter((a) => a.categories?.includes("general"));
  }
  const banks        = filterByCategory(allBanks, "event");
  const qrisAccounts = filterByCategory(allQris,  "event");

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
    id:                 t.id,
    name:               t.name,
    price:              parseFloat(String(t.price)),
    quota:              t.quota,
    description:        t.description,
    usedCount:          ticketCountMap.get(t.id) ?? 0,
    requiresMembership: t.requiresMembership,
  }));

  // Pre-fill data peserta dari session + cek sudah terdaftar
  const session = await auth.api.getSession({ headers: hdrs });
  let defaultAttendeeName  = "";
  let defaultAttendeePhone = "";
  let defaultAttendeeEmail = "";
  let alreadyRegistered: {
    registrationNumber: string;
    status:             string;
    attendeeName:       string;
    attendeePhone:      string | null;
    attendeeEmail:      string | null;
    ticketId:           string | null;
  } | null = null;
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
    // Fallback: akun publik (profiles) — phone tersimpan langsung di profiles
    if (!resolvedMemberId) {
      const [profile] = await db
        .select({ name: profiles.name, phone: profiles.phone, whatsapp: profiles.whatsapp, email: profiles.email })
        .from(profiles)
        .where(eq(profiles.betterAuthUserId, session.user.id))
        .limit(1);
      if (profile) {
        if (!defaultAttendeeName)  defaultAttendeeName  = profile.name ?? "";
        if (!defaultAttendeePhone) defaultAttendeePhone = profile.whatsapp ?? profile.phone ?? "";
        if (!defaultAttendeeEmail) defaultAttendeeEmail = profile.email ?? "";
      }
    }

    if (!defaultAttendeeName)  defaultAttendeeName  = session.user.name  ?? "";
    if (!defaultAttendeeEmail) defaultAttendeeEmail = session.user.email ?? "";

    // Cek apakah sudah terdaftar — OR antara memberId dan email agar registrasi lama
    // (sebelum memberId disimpan) tetap terdeteksi via email
    const identityConditions = [];
    if (resolvedMemberId)      identityConditions.push(eq(schema.eventRegistrations.memberId, resolvedMemberId));
    if (defaultAttendeeEmail)  identityConditions.push(eq(schema.eventRegistrations.attendeeEmail, defaultAttendeeEmail));

    if (identityConditions.length > 0) {
      const [existing] = await tenantDb
        .select({
          registrationNumber: schema.eventRegistrations.registrationNumber,
          status:             schema.eventRegistrations.status,
          attendeeName:       schema.eventRegistrations.attendeeName,
          attendeePhone:      schema.eventRegistrations.attendeePhone,
          attendeeEmail:      schema.eventRegistrations.attendeeEmail,
          ticketId:           schema.eventRegistrations.ticketId,
        })
        .from(schema.eventRegistrations)
        .where(and(
          eq(schema.eventRegistrations.eventId, event.id),
          sql`${schema.eventRegistrations.status} != 'cancelled'`,
          or(...identityConditions),
        ))
        .limit(1);
      if (existing) alreadyRegistered = existing;
    }
  }

  // Cek apakah user terdaftar sebagai anggota cabang ini
  let currentUserIsEnrolled = false;
  if (resolvedMemberId && tenant) {
    const [membership] = await db
      .select({ id: tenantMemberships.id })
      .from(tenantMemberships)
      .where(and(
        eq(tenantMemberships.tenantId, tenant.id),
        eq(tenantMemberships.memberId, resolvedMemberId),
        sql`${tenantMemberships.status} IN ('active', 'alumni')`,
      ))
      .limit(1);
    currentUserIsEnrolled = !!membership;
  }

  // QR Code tiket digital — generate server-side jika sudah terdaftar
  let ticketQrDataUrl: string | null = null;
  let registeredTicketName: string | null = null;
  if (alreadyRegistered) {
    // Nama tiket
    if (alreadyRegistered.ticketId) {
      const found = tickets.find((t) => t.id === alreadyRegistered!.ticketId);
      registeredTicketName = found?.name ?? null;
    }

    // Konten QR: teks terstruktur agar mudah dibaca scanner apapun
    const lines = [
      `EVENT: ${event.title}`,
      `TIKET: ${registeredTicketName ?? "—"}`,
      `NO: ${alreadyRegistered.registrationNumber}`,
      `NAMA: ${alreadyRegistered.attendeeName}`,
      alreadyRegistered.attendeePhone ? `HP: ${alreadyRegistered.attendeePhone}` : null,
      alreadyRegistered.attendeeEmail ? `EMAIL: ${alreadyRegistered.attendeeEmail}` : null,
      `STATUS: ${alreadyRegistered.status.toUpperCase()}`,
    ].filter(Boolean).join("\n");

    ticketQrDataUrl = await generateQrDataUrl(lines, "#111827");
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
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="text-xs text-muted-foreground mb-6 flex items-center gap-2">
        <a href={`/${tenantSlug}/agenda`} className="hover:text-foreground transition-colors">Agenda</a>
        <span>/</span>
        <span className="text-foreground truncate max-w-xs">{event.title}</span>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px] items-start">

        {/* ── Kiri: Gambar + Info + Deskripsi ── */}
        <div className="space-y-6 min-w-0">
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
            <div className="space-y-4">
              <h1 className="text-2xl font-bold leading-tight">{event.title}</h1>

              {/* Satu baris per informasi */}
              <div className="space-y-2.5 text-sm text-muted-foreground">

                {/* Penyelenggara */}
                {event.organizerName && (
                  <div className="flex items-start gap-2.5">
                    <Building2 className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{event.organizerName}</span>
                  </div>
                )}

                {/* Waktu pelaksanaan */}
                <div className="flex items-start gap-2.5">
                  <CalendarDays className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{formatEventDateRange(event.startsAt, event.endsAt)}</span>
                </div>

                {/* Tempat (offline/hybrid) */}
                {(event.eventType === "offline" || event.eventType === "hybrid") && event.location && (
                  <div className="flex items-start gap-2.5">
                    <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{event.location}</span>
                  </div>
                )}

                {/* Online (online/hybrid) */}
                {(event.eventType === "online" || event.eventType === "hybrid") && (
                  <div className="flex items-start gap-2.5">
                    <Video className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{EVENT_TYPE_LABELS[event.eventType]}</span>
                  </div>
                )}

                {/* Alamat detail */}
                {event.locationDetail && (
                  <div className="flex items-start gap-2.5">
                    <Navigation className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{event.locationDetail}</span>
                  </div>
                )}

                {/* Google Maps */}
                {event.mapsUrl && (event.eventType === "offline" || event.eventType === "hybrid") && (
                  <div className="flex items-start gap-2.5">
                    <Globe className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                    <a
                      href={event.mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1"
                    >
                      Lihat di Google Maps
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}

                {/* Link bergabung online */}
                {event.onlineLink && (event.eventType === "online" || event.eventType === "hybrid") && (
                  <div className="flex items-start gap-2.5">
                    <ExternalLink className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                    <a
                      href={event.onlineLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline break-all"
                    >
                      {event.onlineLink}
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Deskripsi */}
            {event.description && (
              <div
                className="prose prose-sm max-w-none text-foreground [&_p]:my-2 [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-0.5 [&_h1]:text-xl [&_h2]:text-lg [&_h3]:text-base"
                dangerouslySetInnerHTML={{ __html: renderBody(event.description, { imageBaseUrl: `${process.env.MINIO_PUBLIC_URL ?? "https://minio.jalakarta.com"}/tenant-${tenantSlug}` }) }}
              />
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
              /* Tiket digital — QR + info peserta */
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                {/* Header tiket */}
                <div className="bg-primary px-4 py-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary-foreground shrink-0" />
                  <p className="text-sm font-semibold text-primary-foreground">Tiket Pendaftaran</p>
                  <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    alreadyRegistered.status === "attended"  ? "bg-white/30 text-white" :
                    alreadyRegistered.status === "confirmed" ? "bg-white/20 text-white" :
                    "bg-white/10 text-white/80"
                  }`}>
                    {alreadyRegistered.status === "pending"   ? "Menunggu" :
                     alreadyRegistered.status === "confirmed" ? "Dikonfirmasi" :
                     alreadyRegistered.status === "attended"  ? "Sudah Hadir" :
                     alreadyRegistered.status}
                  </span>
                </div>

                {/* QR Code */}
                {ticketQrDataUrl && (
                  <div className="flex justify-center py-5 bg-white dark:bg-neutral-950 border-b border-dashed border-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={ticketQrDataUrl}
                      alt="QR Code Tiket"
                      className="w-44 h-44"
                    />
                  </div>
                )}

                {/* Info peserta */}
                <div className="px-4 py-4 space-y-2.5 text-sm">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">No. Pendaftaran</p>
                    <p className="font-mono font-bold text-base">{alreadyRegistered.registrationNumber}</p>
                  </div>
                  {registeredTicketName && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Tiket</p>
                      <p className="font-medium">{registeredTicketName}</p>
                    </div>
                  )}
                  <div className="border-t border-border pt-2.5 space-y-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Nama</p>
                      <p className="font-medium">{alreadyRegistered.attendeeName}</p>
                    </div>
                    {alreadyRegistered.attendeePhone && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">HP</p>
                        <p>{alreadyRegistered.attendeePhone}</p>
                      </div>
                    )}
                    {alreadyRegistered.attendeeEmail && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Email</p>
                        <p className="truncate">{alreadyRegistered.attendeeEmail}</p>
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground pt-1 text-center">
                    Tunjukkan QR ini kepada panitia saat acara
                  </p>
                </div>
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
                  currentUserIsEnrolled={currentUserIsEnrolled}
                  donationPrompt={donationPrompt}
                  defaultAttendeeName={defaultAttendeeName}
                  defaultAttendeePhone={defaultAttendeePhone}
                  defaultAttendeeEmail={defaultAttendeeEmail}
                  baseUrl={baseUrl}
                  enableCustomForm={event.enableCustomForm}
                  customFormFields={(event.customFormFields as CustomFormField[]) ?? []}
                />
              </div>
            )}
          </div>
      </div>
    </div>
  );
}
