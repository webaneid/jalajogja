// Halaman publik event — tanpa auth, siapapun bisa akses dan mendaftar
import { createTenantDb, db, tenants, members, contacts, profiles, tenantMemberships, getSettings, addresses, refRegencies, refProvinces, refProfessions } from "@jalajogja/db";
import { publicUrl } from "@/lib/minio";
import { eq, and, or, count, sql, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { CalendarDays, MapPin, Globe, Building2, Navigation, ExternalLink, Video, Ticket, CheckCircle2 } from "lucide-react";
import { isOwnHost } from "@/lib/is-own-host";
import { EventRegisterForm } from "@/components/event/event-register-form";
import type { CustomFormField } from "@/lib/event-custom-form";
import { EventDetailTabs, type TicketStat, type AttendeeStatsData } from "@/components/event/event-detail-tabs";
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

  // Filter metode pembayaran untuk event:
  // 1. Cari yang punya kategori "event" (jika admin konfigurasi spesifik)
  // 2. Fallback ke "general" (catch-all)
  // 3. Fallback ke semua akun (karena tidak ada kategori "event" di settings UI saat ini)
  function filterForEvent<T extends { categories?: string[] }>(accounts: T[]): T[] {
    const eventSpecific = accounts.filter((a) => a.categories?.includes("event"));
    if (eventSpecific.length > 0) return eventSpecific;
    const general = accounts.filter((a) => a.categories?.includes("general"));
    if (general.length > 0) return general;
    return accounts;
  }
  const banks        = filterForEvent(allBanks);
  const qrisAccounts = filterForEvent(allQris);

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

  // ── Tab Peserta: kuota per tiket (selalu fetch untuk tab, tidak tergantung showTicketCount) ──
  type TicketCountFull = { ticketId: string; name: string; quota: number | null; used: number };
  let ticketStatsForTab: TicketStat[] = [];
  let confirmedCount = 0;

  if (event.showAttendeeList) {
    const usedRows = await tenantDb
      .select({
        ticketId: schema.eventRegistrations.ticketId,
        used:     count(),
      })
      .from(schema.eventRegistrations)
      .where(and(
        eq(schema.eventRegistrations.eventId, event.id),
        sql`${schema.eventRegistrations.status} IN ('confirmed','attended')`
      ))
      .groupBy(schema.eventRegistrations.ticketId);

    const usedMap = new Map(usedRows.map((r) => [r.ticketId!, Number(r.used)]));
    confirmedCount = usedRows.reduce((s, r) => s + Number(r.used), 0);

    ticketStatsForTab = tickets.map((t) => ({
      ticketId: t.id,
      name:     t.name,
      quota:    t.quota ?? null,
      used:     usedMap.get(t.id) ?? 0,
    }));
  }

  const totalQuota = tickets.every(t => t.quota != null)
    ? tickets.reduce((s, t) => s + (t.quota ?? 0), 0)
    : null;

  // ── Tab Statistik: data breakdown per kategori ────────────────────────────
  const attendeeStatsBy = (event.attendeeStatsBy as string[] | null) ?? [];
  const emptyStats: AttendeeStatsData = { angkatan: [], kabupaten: [], provinsi: [], profesi: [] };
  let eventStats: AttendeeStatsData = emptyStats;

  if (event.showAttendeeStats && attendeeStatsBy.length > 0 && confirmedCount > 0) {
    // Ambil semua memberId dari registrasi confirmed/attended
    const regRows = await tenantDb
      .select({ memberId: schema.eventRegistrations.memberId })
      .from(schema.eventRegistrations)
      .where(and(
        eq(schema.eventRegistrations.eventId, event.id),
        sql`${schema.eventRegistrations.status} IN ('confirmed','attended')`,
        sql`${schema.eventRegistrations.memberId} IS NOT NULL`
      ));

    const memberIds = regRows.map(r => r.memberId!).filter(Boolean);

    if (memberIds.length > 0) {
      const memberRows = await db
        .select({
          id:               members.id,
          graduationYear:   members.graduationYear,
          graduationPeriod: members.graduationPeriod,
          professionId:     members.professionId,
          homeAddressId:    members.homeAddressId,
        })
        .from(members)
        .where(inArray(members.id, memberIds));

      // Angkatan
      if (attendeeStatsBy.includes("angkatan")) {
        const freq = new Map<string, number>();
        for (const m of memberRows) {
          if (!m.graduationYear) continue;
          const label = m.graduationYear === 1999
            ? (m.graduationPeriod === "awal" ? "1999 (Awal)" : m.graduationPeriod === "akhir" ? "1999 (Akhir)" : "1999")
            : String(m.graduationYear);
          freq.set(label, (freq.get(label) ?? 0) + 1);
        }
        eventStats.angkatan = [...freq.entries()]
          .map(([label, count]) => ({ label, count }))
          .sort((a, b) => a.label.localeCompare(b.label));
      }

      // Profesi
      if (attendeeStatsBy.includes("profesi")) {
        const professionIds = [...new Set(memberRows.map(m => m.professionId).filter(Boolean))] as number[];
        const profNames = professionIds.length > 0
          ? await db.select({ id: refProfessions.id, name: refProfessions.name })
              .from(refProfessions)
              .where(inArray(refProfessions.id, professionIds))
          : [];
        const profMap = new Map(profNames.map(p => [p.id, p.name]));
        const freq = new Map<string, number>();
        for (const m of memberRows) {
          const label = m.professionId ? (profMap.get(m.professionId) ?? "Lainnya") : "Tidak Diisi";
          freq.set(label, (freq.get(label) ?? 0) + 1);
        }
        eventStats.profesi = [...freq.entries()]
          .map(([label, count]) => ({ label, count }))
          .sort((a, b) => b.count - a.count);
      }

      // Kabupaten / Provinsi
      if (attendeeStatsBy.includes("kabupaten") || attendeeStatsBy.includes("provinsi")) {
        const addressIds = [...new Set(memberRows.map(m => m.homeAddressId).filter(Boolean))] as string[];
        const addrRows = addressIds.length > 0
          ? await db.select({ id: addresses.id, regencyId: addresses.regencyId, provinceId: addresses.provinceId })
              .from(addresses)
              .where(inArray(addresses.id, addressIds))
          : [];

        const addrMap = new Map(addrRows.map(a => [a.id, a]));

        if (attendeeStatsBy.includes("kabupaten")) {
          const regencyIds = [...new Set(addrRows.map(a => a.regencyId).filter(Boolean))] as number[];
          const regNames = regencyIds.length > 0
            ? await db.select({ id: refRegencies.id, name: refRegencies.name }).from(refRegencies)
                .where(inArray(refRegencies.id, regencyIds))
            : [];
          const regMap = new Map(regNames.map(r => [r.id, r.name]));
          const freq = new Map<string, number>();
          for (const m of memberRows) {
            if (!m.homeAddressId) continue;
            const addr = addrMap.get(m.homeAddressId);
            const label = addr?.regencyId ? (regMap.get(addr.regencyId) ?? "Tidak Diketahui") : "Tidak Diisi";
            freq.set(label, (freq.get(label) ?? 0) + 1);
          }
          eventStats.kabupaten = [...freq.entries()]
            .map(([label, count]) => ({ label, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 15);
        }

        if (attendeeStatsBy.includes("provinsi")) {
          const provinceIds = [...new Set(addrRows.map(a => a.provinceId).filter(Boolean))] as number[];
          const provNames = provinceIds.length > 0
            ? await db.select({ id: refProvinces.id, name: refProvinces.name }).from(refProvinces)
                .where(inArray(refProvinces.id, provinceIds))
            : [];
          const provMap = new Map(provNames.map(p => [p.id, p.name]));
          const freq = new Map<string, number>();
          for (const m of memberRows) {
            if (!m.homeAddressId) continue;
            const addr = addrMap.get(m.homeAddressId);
            const label = addr?.provinceId ? (provMap.get(addr.provinceId) ?? "Tidak Diketahui") : "Tidak Diisi";
            freq.set(label, (freq.get(label) ?? 0) + 1);
          }
          eventStats.provinsi = [...freq.entries()]
            .map(([label, count]) => ({ label, count }))
            .sort((a, b) => b.count - a.count);
        }
      }
    }
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
    id:                 string;
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
          id:                 schema.eventRegistrations.id,
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

  // Jika sudah terdaftar dan masih pending → cari invoice yang belum lunas
  let pendingInvoiceId: string | null = null;
  if (alreadyRegistered && alreadyRegistered.status === "pending") {
    const [inv] = await tenantDb
      .select({ id: schema.invoices.id })
      .from(schema.invoices)
      .where(and(
        eq(schema.invoices.sourceType, "event_registration"),
        eq(schema.invoices.sourceId, alreadyRegistered.id),
        sql`${schema.invoices.status} NOT IN ('paid', 'cancelled')`,
      ))
      .limit(1);
    pendingInvoiceId = inv?.id ?? null;
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

  // Linked product data (untuk cart flow)
  let linkedProductTitle: string | null = null;
  if (event.showDonationPrompt && event.linkedProductId) {
    const [product] = await tenantDb
      .select({ name: schema.products.name })
      .from(schema.products)
      .where(and(eq(schema.products.id, event.linkedProductId), eq(schema.products.status, "active")))
      .limit(1);
    linkedProductTitle = product?.name ?? null;
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

        {/* ── Kiri: Tab Detail / Peserta / Statistik ── */}
        <div className="space-y-6 min-w-0">
          <EventDetailTabs
            showAttendeeList={event.showAttendeeList}
            showAttendeeStats={event.showAttendeeStats}
            attendeeStatsBy={attendeeStatsBy}
            confirmedCount={confirmedCount}
            totalQuota={totalQuota}
            ticketStats={ticketStatsForTab}
            attendeeNames={attendeeNames}
            stats={eventStats}
            detailSlot={<>
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
            </>}
          /></div>

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
                  {/* Jika masih pending → link ke invoice untuk selesaikan pembayaran */}
                  {alreadyRegistered.status === "pending" && (
                    <div className="pt-2 border-t border-border space-y-2">
                      <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                        Segera selesaikan pembayaran untuk mengkonfirmasi pendaftaran Anda.
                      </p>
                      {pendingInvoiceId ? (
                        <a
                          href={`${baseUrl}/invoice/${pendingInvoiceId}`}
                          className="btn btn-primary btn-sm btn-full inline-flex justify-center"
                        >
                          Selesaikan Pembayaran →
                        </a>
                      ) : (
                        <p className="text-xs text-muted-foreground">Hubungi panitia untuk konfirmasi pembayaran.</p>
                      )}
                    </div>
                  )}

                  {alreadyRegistered.status === "confirmed" && (
                    <p className="text-[10px] text-muted-foreground pt-1 text-center">
                      Tunjukkan QR ini kepada panitia saat acara
                    </p>
                  )}
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
                  linkedProductId={event.linkedProductId ?? null}
                  linkedProductTitle={linkedProductTitle}
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
