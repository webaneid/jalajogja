"use server";

import { eq, count, inArray, and, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { createTenantDb, generateFinancialNumber, recordIncome, createLinkedInvoice, syncInvoicePayment, db as publicDb, members, contacts, profiles, tenantMemberships, tenants } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { hasFullAccess, canConfirmPayment } from "@/lib/permissions";
import { auth }           from "@/lib/auth";
import { headers, cookies } from "next/headers";
import { normalizePhone } from "@/lib/phone";
import type { CustomFormField } from "@/lib/event-custom-form";
import { notifyWa, waAppUrl } from "@/lib/wa-notify";
import { getTenantTimezone, formatInTz, tzLabel, todayInTz } from "@/lib/tenant-timezone.server";
import { checkGeneralRegistrationEligibility } from "@/lib/member-eligibility";

function formatEventDateWib(date: Date | null, timezone: string): string {
  if (!date) return "-";
  return `${formatInTz(date, timezone, {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })} ${tzLabel(timezone)}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export type TicketInput = {
  id?:                  string | null;
  name:                 string;
  description?:         string | null;
  price:                number;
  quota?:               number | null;
  isActive:             boolean;
  saleStartsAt?:        string | null;
  saleEndsAt?:          string | null;
  sortOrder:            number;
  requiresMembership:   boolean;
  requiresRegistration: boolean;
};

export type EventData = {
  slug:             string;
  title:            string;
  description?:     string | null;
  categoryId?:      string | null;
  eventType:        "offline" | "online" | "hybrid";
  status:           "draft" | "published" | "cancelled" | "completed";
  startsAt?:        string | null; // ISO string dari datetime-local input
  endsAt?:          string | null;
  location?:        string | null;
  locationDetail?:  string | null;
  mapsUrl?:         string | null;
  onlineLink?:      string | null;
  organizerName?:   string | null;
  maxCapacity?:     number | null;
  showAttendeeList:    boolean;
  showTicketCount:     boolean;
  requireApproval:     boolean;
  showDonationPrompt:  boolean;
  enableCustomForm:    boolean;
  customFormFields:    CustomFormField[];
  showAttendeeStats:   boolean;
  attendeeStatsBy:     string[];
  linkedCampaignId?:   string | null;
  linkedProductId?:    string | null;
  coverId?:            string | null;
  tickets:             TicketInput[];
  // SEO
  metaTitle?:      string | null;
  metaDesc?:       string | null;
  ogTitle?:        string | null;
  ogDescription?:  string | null;
  ogImageId?:      string | null;
  twitterCard?:    "summary" | "summary_large_image" | null;
  focusKeyword?:   string | null;
  canonicalUrl?:   string | null;
  robots?:         "index,follow" | "noindex" | "noindex,nofollow";
  schemaType?:     string | null;
};

// ─── Helper ───────────────────────────────────────────────────────────────────

function revalidateEvent(slug: string) {
  revalidatePath(`/app/${slug}/event`);
  revalidatePath(`/app/${slug}/event/acara`);
}

// Generate EVT-YYYYMM-NNNNN — atomic SELECT FOR UPDATE
async function generateRegistrationNumber(
  tenantDb: ReturnType<typeof createTenantDb>,
  now = new Date()
): Promise<string> {
  const { db, schema } = tenantDb;
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

// Sync tiket saat update event — diff: delete removed, update existing, insert baru
async function syncTickets(
  tenantDb: ReturnType<typeof createTenantDb>,
  eventId: string,
  tickets: TicketInput[]
) {
  const { db, schema } = tenantDb;

  const existing = await db
    .select({ id: schema.eventTickets.id })
    .from(schema.eventTickets)
    .where(eq(schema.eventTickets.eventId, eventId));

  const existingIds = new Set(existing.map((t) => t.id));
  const incomingIds = new Set(tickets.filter((t) => t.id).map((t) => t.id!));

  // Tiket yang dihapus user
  const toDeleteIds = [...existingIds].filter((id) => !incomingIds.has(id));
  if (toDeleteIds.length > 0) {
    // Guard: jangan hapus tiket yang sudah ada pendaftaran
    const [{ total }] = await db
      .select({ total: count() })
      .from(schema.eventRegistrations)
      .where(inArray(schema.eventRegistrations.ticketId, toDeleteIds));

    if (Number(total) > 0)
      throw new Error(`${total} tiket yang dihapus sudah memiliki pendaftaran.`);

    await db
      .delete(schema.eventTickets)
      .where(inArray(schema.eventTickets.id, toDeleteIds));
  }

  // Update tiket yang ada
  for (const t of tickets.filter((t) => t.id)) {
    await db
      .update(schema.eventTickets)
      .set({
        name:                 t.name.trim(),
        description:          t.description?.trim() ?? null,
        price:                String(t.price ?? 0),
        quota:                t.quota ?? null,
        isActive:             t.isActive,
        saleStartsAt:         t.saleStartsAt ? new Date(t.saleStartsAt) : null,
        saleEndsAt:           t.saleEndsAt   ? new Date(t.saleEndsAt)   : null,
        sortOrder:            t.sortOrder,
        requiresMembership:   t.requiresMembership,
        requiresRegistration: t.requiresRegistration,
      })
      .where(eq(schema.eventTickets.id, t.id!));
  }

  // Insert tiket baru
  const newTickets = tickets.filter((t) => !t.id);
  if (newTickets.length > 0) {
    await db.insert(schema.eventTickets).values(
      newTickets.map((t) => ({
        eventId,
        name:                 t.name.trim(),
        description:          t.description?.trim() ?? null,
        price:                String(t.price ?? 0),
        quota:                t.quota ?? null,
        isActive:             t.isActive,
        saleStartsAt:         t.saleStartsAt ? new Date(t.saleStartsAt) : null,
        saleEndsAt:           t.saleEndsAt   ? new Date(t.saleEndsAt)   : null,
        sortOrder:            t.sortOrder,
        requiresMembership:   t.requiresMembership,
        requiresRegistration: t.requiresRegistration,
      }))
    );
  }
}

// ─── Event Actions ────────────────────────────────────────────────────────────

export async function createEventAction(
  slug: string,
  data: EventData
): Promise<ActionResult<{ eventId: string }>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "event"))
    return { success: false, error: "Hanya admin yang bisa membuat event." };

  if (!data.title.trim()) return { success: false, error: "Judul event wajib diisi." };
  if (!data.slug.trim())  return { success: false, error: "Slug event wajib diisi." };

  const tenantDb = createTenantDb(slug);
  const { db, schema } = tenantDb;

  try {
    const [event] = await db
      .insert(schema.events)
      .values({
        slug:             data.slug.trim(),
        title:            data.title.trim(),
        description:      data.description       ?? null,
        categoryId:       data.categoryId         ?? null,
        eventType:        data.eventType,
        status:           data.status,
        startsAt:         data.startsAt           ? new Date(data.startsAt)  : null,
        endsAt:           data.endsAt             ? new Date(data.endsAt)    : null,
        location:         data.location?.trim()        ?? null,
        locationDetail:   data.locationDetail?.trim()  ?? null,
        mapsUrl:          data.mapsUrl?.trim()         || null,
        onlineLink:       data.onlineLink?.trim()       ?? null,
        organizerName:    data.organizerName?.trim()    ?? null,
        maxCapacity:      data.maxCapacity              ?? null,
        showAttendeeList:   data.showAttendeeList,
        showTicketCount:    data.showTicketCount,
        requireApproval:    data.requireApproval,
        showDonationPrompt: data.showDonationPrompt,
        enableCustomForm:   data.enableCustomForm,
        customFormFields:   data.customFormFields ?? [],
        showAttendeeStats:  data.showAttendeeStats,
        attendeeStatsBy:    data.attendeeStatsBy   ?? [],
        linkedCampaignId:   data.linkedCampaignId ?? null,
        linkedProductId:    data.linkedProductId  ?? null,
        coverId:          data.coverId                  ?? null,
        metaTitle:        data.metaTitle?.trim()       || null,
        metaDesc:         data.metaDesc?.trim()        || null,
        ogTitle:          data.ogTitle?.trim()         || null,
        ogDescription:    data.ogDescription?.trim()   || null,
        ogImageId:        data.ogImageId                ?? null,
        twitterCard:      data.twitterCard              || "summary_large_image",
        focusKeyword:     data.focusKeyword?.trim()    || null,
        canonicalUrl:     data.canonicalUrl?.trim()    || null,
        robots:           data.robots                  || "index,follow",
        schemaType:       data.schemaType              || "Event",
      })
      .returning({ id: schema.events.id });

    // Insert tiket awal
    if (data.tickets.length > 0) {
      await db.insert(schema.eventTickets).values(
        data.tickets.map((t) => ({
          eventId:      event.id,
          name:         t.name.trim(),
          description:  t.description?.trim() ?? null,
          price:        String(t.price ?? 0),
          quota:        t.quota ?? null,
          isActive:     t.isActive,
          saleStartsAt: t.saleStartsAt ? new Date(t.saleStartsAt) : null,
          saleEndsAt:   t.saleEndsAt   ? new Date(t.saleEndsAt)   : null,
          sortOrder:    t.sortOrder,
        }))
      );
    }

    revalidateEvent(slug);
    return { success: true, data: { eventId: event.id } };
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("unique"))
      return { success: false, error: "Slug sudah digunakan. Gunakan slug lain." };
    console.error("[createEventAction]", err);
    return { success: false, error: "Gagal membuat event." };
  }
}

export async function updateEventAction(
  slug: string,
  eventId: string,
  data: EventData
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "event"))
    return { success: false, error: "Hanya admin yang bisa mengubah event." };

  if (!data.title.trim()) return { success: false, error: "Judul event wajib diisi." };

  const tenantDb = createTenantDb(slug);
  const { db, schema } = tenantDb;

  try {
    await db
      .update(schema.events)
      .set({
        slug:             data.slug.trim(),
        title:            data.title.trim(),
        description:      data.description       ?? null,
        categoryId:       data.categoryId         ?? null,
        eventType:        data.eventType,
        status:           data.status,
        startsAt:         data.startsAt           ? new Date(data.startsAt)  : null,
        endsAt:           data.endsAt             ? new Date(data.endsAt)    : null,
        location:         data.location?.trim()        ?? null,
        locationDetail:   data.locationDetail?.trim()  ?? null,
        mapsUrl:          data.mapsUrl?.trim()         || null,
        onlineLink:       data.onlineLink?.trim()       ?? null,
        organizerName:    data.organizerName?.trim()    ?? null,
        maxCapacity:      data.maxCapacity              ?? null,
        showAttendeeList:   data.showAttendeeList,
        showTicketCount:    data.showTicketCount,
        requireApproval:    data.requireApproval,
        showDonationPrompt: data.showDonationPrompt,
        enableCustomForm:   data.enableCustomForm,
        customFormFields:   data.customFormFields ?? [],
        showAttendeeStats:  data.showAttendeeStats,
        attendeeStatsBy:    data.attendeeStatsBy   ?? [],
        linkedCampaignId:   data.linkedCampaignId ?? null,
        linkedProductId:    data.linkedProductId  ?? null,
        coverId:          data.coverId                  ?? null,
        metaTitle:        data.metaTitle?.trim()       || null,
        metaDesc:         data.metaDesc?.trim()        || null,
        ogTitle:          data.ogTitle?.trim()         || null,
        ogDescription:    data.ogDescription?.trim()   || null,
        ogImageId:        data.ogImageId                ?? null,
        twitterCard:      data.twitterCard              || "summary_large_image",
        focusKeyword:     data.focusKeyword?.trim()    || null,
        canonicalUrl:     data.canonicalUrl?.trim()    || null,
        robots:           data.robots                  || "index,follow",
        schemaType:       data.schemaType              || "Event",
        updatedAt:        new Date(),
      })
      .where(eq(schema.events.id, eventId));

    // Sync tiket
    await syncTickets(tenantDb, eventId, data.tickets);

    revalidateEvent(slug);
    revalidatePath(`/app/${slug}/event/acara/${eventId}`);
    return { success: true, data: undefined };
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("unique"))
      return { success: false, error: "Slug sudah digunakan. Gunakan slug lain." };
    if (err instanceof Error && err.message.includes("tiket yang dihapus"))
      return { success: false, error: err.message };
    console.error("[updateEventAction]", err);
    return { success: false, error: "Gagal menyimpan event." };
  }
}

export async function deleteEventAction(
  slug: string,
  eventId: string
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "event"))
    return { success: false, error: "Hanya admin yang bisa menghapus event." };

  const { db, schema } = createTenantDb(slug);

  const [{ total }] = await db
    .select({ total: count() })
    .from(schema.eventRegistrations)
    .where(eq(schema.eventRegistrations.eventId, eventId));

  if (Number(total) > 0)
    return { success: false, error: `Event sudah memiliki ${total} pendaftaran dan tidak bisa dihapus. Batalkan saja.` };

  // Hapus tiket dulu (tidak ada registrasi karena sudah dicek di atas)
  await db.delete(schema.eventTickets).where(eq(schema.eventTickets.eventId, eventId));
  await db.delete(schema.events).where(eq(schema.events.id, eventId));

  revalidateEvent(slug);
  return { success: true, data: undefined };
}

// ─── Event Category Actions ───────────────────────────────────────────────────

export async function createEventCategoryAction(
  slug: string,
  data: { name: string; slug: string; metaTitle?: string | null; metaDesc?: string | null }
): Promise<ActionResult<{ categoryId: string }>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "event"))
    return { success: false, error: "Hanya admin yang bisa membuat kategori." };

  if (!data.name.trim()) return { success: false, error: "Nama kategori wajib diisi." };
  if (!data.slug.trim()) return { success: false, error: "Slug kategori wajib diisi." };

  const { db, schema } = createTenantDb(slug);

  try {
    const [cat] = await db
      .insert(schema.eventCategories)
      .values({
        name: data.name.trim(), slug: data.slug.trim(),
        metaTitle: data.metaTitle || null, metaDesc: data.metaDesc || null,
      })
      .returning({ id: schema.eventCategories.id });

    revalidatePath(`/app/${slug}/event/kategori`);
    revalidatePath(`/app/${slug}/event/acara`);
    return { success: true, data: { categoryId: cat.id } };
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("unique"))
      return { success: false, error: "Slug sudah digunakan." };
    console.error("[createEventCategoryAction]", err);
    return { success: false, error: "Gagal membuat kategori." };
  }
}

export async function updateEventCategoryAction(
  slug: string,
  categoryId: string,
  data: { name: string; slug: string; metaTitle?: string | null; metaDesc?: string | null }
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "event"))
    return { success: false, error: "Hanya admin yang bisa mengubah kategori." };

  const { db, schema } = createTenantDb(slug);

  try {
    await db
      .update(schema.eventCategories)
      .set({
        name: data.name.trim(), slug: data.slug.trim(),
        metaTitle: data.metaTitle || null, metaDesc: data.metaDesc || null,
      })
      .where(eq(schema.eventCategories.id, categoryId));

    revalidatePath(`/app/${slug}/event/kategori`);
    return { success: true, data: undefined };
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("unique"))
      return { success: false, error: "Slug sudah digunakan." };
    console.error("[updateEventCategoryAction]", err);
    return { success: false, error: "Gagal memperbarui kategori." };
  }
}

export async function deleteEventCategoryAction(
  slug: string,
  categoryId: string
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "event"))
    return { success: false, error: "Hanya admin yang bisa menghapus kategori." };

  const { db, schema } = createTenantDb(slug);

  const [{ total }] = await db
    .select({ total: count() })
    .from(schema.events)
    .where(eq(schema.events.categoryId, categoryId));

  if (Number(total) > 0)
    return { success: false, error: `Kategori ini digunakan oleh ${total} event. Pindahkan event terlebih dahulu.` };

  await db
    .delete(schema.eventCategories)
    .where(eq(schema.eventCategories.id, categoryId));

  revalidatePath(`/app/${slug}/event/kategori`);
  revalidatePath(`/app/${slug}/event/acara`);
  return { success: true, data: undefined };
}

// ─── Resolusi akun event dari settings ───────────────────────────────────────

async function resolveEventAccounts(tenantDb: ReturnType<typeof createTenantDb>) {
  const { db, schema } = tenantDb;
  const [row] = await db
    .select({ value: schema.settings.value })
    .from(schema.settings)
    .where(and(
      eq(schema.settings.key,   "account_mappings"),
      eq(schema.settings.group, "keuangan")
    ))
    .limit(1);

  const m = (row?.value && typeof row.value === "object")
    ? (row.value as Record<string, string | null>)
    : {};

  return {
    cash_default:  (m.cash_default  ?? null) as string | null,
    bank_default:  (m.bank_default  ?? null) as string | null,
    event_income:  (m.event_income  ?? m.dana_titipan ?? null) as string | null,
  };
}

// ─── Registrasi Event (PUBLIC — tanpa auth) ───────────────────────────────────

export type RegisterData = {
  eventId:      string;
  ticketId:     string;
  attendeeName:  string;
  attendeePhone?: string | null;
  attendeeEmail?: string | null;
  // Custom form answers (key → value, diisi hanya jika event.enableCustomForm = true)
  customFieldAnswers?: Record<string, unknown> | null;
  // Untuk tiket berbayar
  method?:          "cash" | "transfer" | "qris";
  bankAccountRef?:  string | null;
  qrisAccountRef?:  string | null;
};

export async function registerForEventAction(
  slug: string,
  data: RegisterData
): Promise<ActionResult<{
  registrationId:     string;
  registrationNumber: string;
  isPaid:             boolean;
  amount?:            number;
  uniqueCode?:        number;
  totalAmount?:       number;
  paymentId?:         string;
  invoiceId?:         string;
}>> {
  if (!data.attendeeName.trim())
    return { success: false, error: "Nama peserta wajib diisi." };

  const tenantDb = createTenantDb(slug);
  const { db, schema } = tenantDb;

  // Resolve identitas user yang login (opsional — guest boleh daftar)
  let resolvedMemberId:  string | null = null;
  let resolvedProfileId: string | null = null;
  let resolvedEmail:     string | null = data.attendeeEmail?.trim() ?? null;

  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.id) {
    const [member] = await publicDb
      .select({ id: members.id, contactId: members.contactId })
      .from(members)
      .where(eq(members.betterAuthUserId, session.user.id))
      .limit(1);

    if (member) {
      resolvedMemberId = member.id;
      if (member.contactId && !resolvedEmail) {
        const [contact] = await publicDb
          .select({ email: contacts.email })
          .from(contacts)
          .where(eq(contacts.id, member.contactId))
          .limit(1);
        resolvedEmail = contact?.email ?? null;
      }
    } else {
      // Cek apakah akun publik (profiles)
      const [profile] = await publicDb
        .select({ id: profiles.id, email: profiles.email })
        .from(profiles)
        .where(eq(profiles.betterAuthUserId, session.user.id))
        .limit(1);
      if (profile) {
        resolvedProfileId = profile.id;
        if (!resolvedEmail) resolvedEmail = profile.email ?? null;
      }
    }
  }

  // Guard double-daftar: cek via OR (memberId ATAU email) agar registrasi lama tetap terdeteksi.
  // Cek awal ini hanya early-exit cepat untuk UX — pengecekan definitif (anti race condition)
  // diulang lagi di dalam transaction setelah lock tiket (lihat di bawah), karena dua request
  // yang datang hampir bersamaan bisa sama-sama lolos cek di sini sebelum salah satunya insert.
  const identityOr: ReturnType<typeof eq>[] = [];
  if (resolvedMemberId) identityOr.push(eq(schema.eventRegistrations.memberId, resolvedMemberId));
  if (resolvedEmail)    identityOr.push(eq(schema.eventRegistrations.attendeeEmail, resolvedEmail));

  if (identityOr.length > 0) {
    const [existing] = await db
      .select({ id: schema.eventRegistrations.id })
      .from(schema.eventRegistrations)
      .where(and(
        eq(schema.eventRegistrations.eventId, data.eventId),
        sql`${schema.eventRegistrations.status} != 'cancelled'`,
        or(...identityOr),
      ))
      .limit(1);

    if (existing) return { success: false, error: "Kamu sudah terdaftar di event ini." };
  }

  // Cek event masih published + ambil maxCapacity sekaligus
  const [event] = await db
    .select({
      id:              schema.events.id,
      slug:            schema.events.slug,
      title:           schema.events.title,
      startsAt:        schema.events.startsAt,
      location:        schema.events.location,
      requireApproval: schema.events.requireApproval,
      maxCapacity:     schema.events.maxCapacity,
    })
    .from(schema.events)
    .where(and(eq(schema.events.id, data.eventId), eq(schema.events.status, "published")))
    .limit(1);

  if (!event) return { success: false, error: "Event tidak ditemukan atau sudah tidak tersedia." };

  // Cek tiket valid, aktif, dan dalam periode jual
  const [ticket] = await db
    .select()
    .from(schema.eventTickets)
    .where(and(
      eq(schema.eventTickets.id,      data.ticketId),
      eq(schema.eventTickets.eventId, data.eventId),
      eq(schema.eventTickets.isActive, true)
    ))
    .limit(1);

  if (!ticket) return { success: false, error: "Tiket tidak ditemukan atau tidak aktif." };

  const now = new Date();
  if (ticket.saleStartsAt && now < ticket.saleStartsAt)
    return { success: false, error: "Penjualan tiket belum dimulai." };
  if (ticket.saleEndsAt && now > ticket.saleEndsAt)
    return { success: false, error: "Penjualan tiket sudah berakhir." };

  // Guard: tiket wajib anggota terdaftar
  if (ticket.requiresMembership) {
    if (!resolvedMemberId)
      return { success: false, error: "Tiket ini hanya untuk anggota terdaftar. Silakan login dan lengkapi keanggotaan terlebih dahulu." };

    // Cek apakah member terdaftar di tenant ini (status active atau alumni)
    const [tenantRow] = await publicDb
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.slug, slug))
      .limit(1);

    if (tenantRow) {
      const [membership] = await publicDb
        .select({ id: tenantMemberships.id })
        .from(tenantMemberships)
        .where(and(
          eq(tenantMemberships.tenantId, tenantRow.id),
          eq(tenantMemberships.memberId, resolvedMemberId),
          sql`${tenantMemberships.status} IN ('active', 'alumni')`,
        ))
        .limit(1);

      if (!membership)
        return { success: false, error: "Tiket ini hanya untuk anggota terdaftar cabang ini. Lengkapi data keanggotaan Anda terlebih dahulu." };
    }
  }

  // Guard: tiket wajib terdaftar (umum) — TIDAK peduli tenant membership, beda dari
  // requiresMembership di atas. Berlaku anggota IKPM maupun akun publik, keduanya wajib
  // login DAN data pribadinya lengkap. Lihat lib/member-eligibility.ts.
  if (ticket.requiresRegistration) {
    const genEligibility = await checkGeneralRegistrationEligibility(resolvedMemberId, resolvedProfileId);
    if (!genEligibility.hasAccount)
      return { success: false, error: "Tiket ini mengharuskan Anda login/daftar akun terlebih dahulu." };
    if (!genEligibility.eligible)
      return { success: false, error: "Tiket ini mengharuskan data pribadi Anda lengkap. Silakan lengkapi data diri Anda di halaman Akun terlebih dahulu." };
  }

  try {
    const regNumber = await generateRegistrationNumber(tenantDb);
    const price     = parseFloat(String(ticket.price));
    const isGratis  = price <= 0;
    const regStatus = isGratis && !event.requireApproval ? "confirmed" : "pending";

    // INSERT dalam transaction: lock tiket dulu (FOR UPDATE) untuk cegah race condition kuota
    const [reg] = await db.transaction(async (tx) => {
      // Lock tiket row — satu request menunggu yang lain selesai
      await tx.select({ id: schema.eventTickets.id })
        .from(schema.eventTickets)
        .where(sql`${schema.eventTickets.id} = ${data.ticketId} FOR UPDATE`)
        .limit(1);

      // Ulangi cek double-daftar SETELAH lock — menutup race condition klik ganda/double-tap.
      // Request kedua yang tadi lolos cek awal (sebelum ada yang insert) sekarang akan
      // menemukan registrasi dari request pertama sudah tercatat (request pertama sudah
      // commit duluan karena antre di lock yang sama).
      if (identityOr.length > 0) {
        const [existingLocked] = await tx
          .select({ id: schema.eventRegistrations.id })
          .from(schema.eventRegistrations)
          .where(and(
            eq(schema.eventRegistrations.eventId, data.eventId),
            sql`${schema.eventRegistrations.status} != 'cancelled'`,
            or(...identityOr),
          ))
          .limit(1);
        if (existingLocked) throw new Error("Kamu sudah terdaftar di event ini.");
      }

      // Cek kuota tiket (di dalam transaction, setelah lock)
      if (ticket.quota != null) {
        const [{ used }] = await tx
          .select({ used: count() })
          .from(schema.eventRegistrations)
          .where(and(
            eq(schema.eventRegistrations.ticketId, data.ticketId),
            sql`${schema.eventRegistrations.status} != 'cancelled'`
          ));
        if (Number(used) >= ticket.quota)
          throw new Error("Kuota tiket sudah habis.");
      }

      // Cek kapasitas total event
      if (event.maxCapacity != null) {
        const [{ total }] = await tx
          .select({ total: count() })
          .from(schema.eventRegistrations)
          .where(and(
            eq(schema.eventRegistrations.eventId, data.eventId),
            sql`${schema.eventRegistrations.status} != 'cancelled'`
          ));
        if (Number(total) >= event.maxCapacity)
          throw new Error("Kapasitas event sudah penuh.");
      }

      // Simpan custom form answers — sudah divalidasi di client (required check)
      const customFields =
        data.customFieldAnswers && Object.keys(data.customFieldAnswers).length > 0
          ? data.customFieldAnswers
          : null;

      return tx
        .insert(schema.eventRegistrations)
        .values({
          registrationNumber: regNumber,
          eventId:            data.eventId,
          ticketId:           data.ticketId,
          memberId:           resolvedMemberId,
          profileId:          resolvedProfileId,
          attendeeName:       data.attendeeName.trim(),
          attendeePhone:      normalizePhone(data.attendeePhone),
          attendeeEmail:      data.attendeeEmail?.trim().toLowerCase() ?? null,
          customFields,
          status:             regStatus,
        })
        .returning({ id: schema.eventRegistrations.id });
    });

    // Notifikasi WA — konfirmasi pendaftaran diterima. Fire di sini (bukan setelah
    // payment confirm) karena ini satu-satunya touchpoint untuk alur direct (bukan cart) —
    // tiket berbayar via cart sudah dapat invoice_created+payment_confirmed generik.
    void (async () => {
      const [eventUrl, tenantTimezone] = await Promise.all([
        waAppUrl(slug, `/agenda/${event.slug}`),
        getTenantTimezone(tenantDb),
      ]);
      void notifyWa({
        slug, tenantDb, event: "event_registered",
        phone: normalizePhone(data.attendeePhone),
        vars: {
          name:      data.attendeeName.trim(),
          eventName: event.title,
          eventDate: formatEventDateWib(event.startsAt, tenantTimezone),
          location:  event.location ?? "-",
          regNumber: regNumber,
          eventUrl,
        },
      });
    })();

    // Tiket berbayar — buat invoice universal (tanpa direct payment record)
    if (!isGratis) {
      const ticketName = ticket.name ?? "Tiket Event";

      const { invoiceId, uniqueCode } = await createLinkedInvoice(tenantDb, {
        sourceType:    "event_registration",
        sourceId:      reg.id,
        customerName:  data.attendeeName.trim(),
        customerPhone: data.attendeePhone?.trim() ?? null,
        customerEmail: data.attendeeEmail?.trim() ?? null,
        items: [{
          itemType:  "ticket",
          itemId:    data.ticketId,
          name:      ticketName,
          unitPrice: price,
          quantity:  1,
        }],
      });

      revalidatePath(`/app/${slug}/event/acara/${data.eventId}`);
      return {
        success: true,
        data: {
          registrationId:     reg.id,
          registrationNumber: regNumber,
          isPaid:             false,
          amount:             price,
          uniqueCode,
          totalAmount:        price + uniqueCode,
          invoiceId,
        },
      };
    }

    revalidatePath(`/app/${slug}/event/acara/${data.eventId}`);
    return {
      success: true,
      data: { registrationId: reg.id, registrationNumber: regNumber, isPaid: true },
    };
  } catch (err) {
    if (err instanceof Error && (err.message.includes("Kuota") || err.message.includes("Kapasitas") || err.message.includes("sudah terdaftar")))
      return { success: false, error: err.message };
    console.error("[registerForEventAction]", err);
    return { success: false, error: "Gagal mendaftarkan peserta. Silakan coba lagi." };
  }
}

// ─── Tambah Tiket Event ke Keranjang (public) ─────────────────────────────────
// Dipakai saat event punya linked campaign/product (donation prompt).
// Validasi sama seperti registerForEventAction tapi output ke cart, bukan event_registrations.

export type EventCartAttendeeData = {
  eventId:            string;
  ticketId:           string;
  attendeeName:       string;
  attendeePhone?:     string | null;
  attendeeEmail?:     string | null;
  customFieldAnswers?: Record<string, string | number>;
};

export async function addEventTicketToCartAction(
  slug: string,
  data: EventCartAttendeeData
): Promise<ActionResult<{ cartItemId: string }>> {
  if (!data.attendeeName.trim()) return { success: false, error: "Nama peserta wajib diisi." };

  const tenantDb = createTenantDb(slug);
  const { db, schema } = tenantDb;

  // Resolve identity (session) untuk cek keanggotaan — member DULU, fallback akun publik
  // (persis pola registerForEventAction) supaya Toggle B (requiresRegistration) bisa
  // menerima kedua jenis identitas, bukan cuma anggota IKPM.
  let resolvedMemberId:  string | null = null;
  let resolvedProfileId: string | null = null;
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.id) {
    const [member] = await publicDb
      .select({ id: members.id })
      .from(members)
      .where(eq(members.betterAuthUserId, session.user.id))
      .limit(1);
    if (member) {
      resolvedMemberId = member.id;
    } else {
      const [profile] = await publicDb
        .select({ id: profiles.id })
        .from(profiles)
        .where(eq(profiles.betterAuthUserId, session.user.id))
        .limit(1);
      if (profile) resolvedProfileId = profile.id;
    }
  }

  // Validasi event masih published
  const [event] = await db
    .select({ id: schema.events.id, maxCapacity: schema.events.maxCapacity })
    .from(schema.events)
    .where(and(eq(schema.events.id, data.eventId), eq(schema.events.status, "published")))
    .limit(1);
  if (!event) return { success: false, error: "Event tidak ditemukan atau sudah tidak tersedia." };

  // Validasi tiket aktif
  const [ticket] = await db
    .select()
    .from(schema.eventTickets)
    .where(and(
      eq(schema.eventTickets.id,       data.ticketId),
      eq(schema.eventTickets.eventId,  data.eventId),
      eq(schema.eventTickets.isActive, true),
    ))
    .limit(1);
  if (!ticket) return { success: false, error: "Tiket tidak ditemukan atau tidak aktif." };

  const now = new Date();
  if (ticket.saleStartsAt && now < ticket.saleStartsAt)
    return { success: false, error: "Penjualan tiket belum dimulai." };
  if (ticket.saleEndsAt && now > ticket.saleEndsAt)
    return { success: false, error: "Penjualan tiket sudah berakhir." };

  // Guard: tiket wajib anggota
  if (ticket.requiresMembership) {
    if (!resolvedMemberId)
      return { success: false, error: "Tiket ini hanya untuk anggota terdaftar. Silakan login terlebih dahulu." };

    const [tenantRow] = await publicDb
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.slug, slug))
      .limit(1);

    if (tenantRow) {
      const [membership] = await publicDb
        .select({ id: tenantMemberships.id })
        .from(tenantMemberships)
        .where(and(
          eq(tenantMemberships.tenantId, tenantRow.id),
          eq(tenantMemberships.memberId, resolvedMemberId),
          sql`${tenantMemberships.status} IN ('active', 'alumni')`,
        ))
        .limit(1);
      if (!membership)
        return { success: false, error: "Tiket ini hanya untuk anggota terdaftar cabang ini." };
    }
  }

  // Guard: tiket wajib terdaftar (umum) — lihat komentar lengkap di registerForEventAction.
  if (ticket.requiresRegistration) {
    const genEligibility = await checkGeneralRegistrationEligibility(resolvedMemberId, resolvedProfileId);
    if (!genEligibility.hasAccount)
      return { success: false, error: "Tiket ini mengharuskan Anda login/daftar akun terlebih dahulu." };
    if (!genEligibility.eligible)
      return { success: false, error: "Tiket ini mengharuskan data pribadi Anda lengkap. Silakan lengkapi data diri Anda di halaman Akun terlebih dahulu." };
  }

  // Soft quota check (tanpa lock — lock final ada di checkout)
  if (ticket.quota != null) {
    const [{ used }] = await db
      .select({ used: count() })
      .from(schema.eventRegistrations)
      .where(and(
        eq(schema.eventRegistrations.ticketId, data.ticketId),
        sql`${schema.eventRegistrations.status} != 'cancelled'`
      ));
    if (Number(used) >= ticket.quota)
      return { success: false, error: "Kuota tiket sudah habis." };
  }

  try {
    // Cart session via cookie (replikasi logic dari cart/actions.ts)
    const COOKIE_NAME   = "cart_session";
    const CART_TTL_SEC  = 24 * 60 * 60;
    const cookieStore   = await cookies();

    let cartId: string;
    const existingToken = cookieStore.get(COOKIE_NAME)?.value ?? null;

    if (existingToken) {
      const [existing] = await db
        .select({ id: schema.carts.id, expiresAt: schema.carts.expiresAt })
        .from(schema.carts)
        .where(eq(schema.carts.sessionToken, existingToken))
        .limit(1);

      if (existing && existing.expiresAt > new Date()) {
        cartId = existing.id;
      } else {
        const newToken  = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + CART_TTL_SEC * 1000);
        const [cart]    = await db.insert(schema.carts).values({ sessionToken: newToken, expiresAt }).returning({ id: schema.carts.id });
        cookieStore.set(COOKIE_NAME, newToken, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: CART_TTL_SEC, path: "/" });
        cartId = cart.id;
      }
    } else {
      const newToken  = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + CART_TTL_SEC * 1000);
      const [cart]    = await db.insert(schema.carts).values({ sessionToken: newToken, expiresAt }).returning({ id: schema.carts.id });
      cookieStore.set(COOKIE_NAME, newToken, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: CART_TTL_SEC, path: "/" });
      cartId = cart.id;
    }

    // Simpan data peserta di notes sebagai JSON
    const notes = JSON.stringify({
      attendeeName:       data.attendeeName.trim(),
      attendeePhone:      normalizePhone(data.attendeePhone),
      attendeeEmail:      data.attendeeEmail?.trim() ?? null,
      customFieldAnswers: data.customFieldAnswers ?? null,
    });

    const price = parseFloat(String(ticket.price));

    // Jika tiket yang sama sudah di cart → update notes (attendee bisa ganti data)
    const [existingItem] = await db
      .select({ id: schema.cartItems.id })
      .from(schema.cartItems)
      .where(and(eq(schema.cartItems.cartId, cartId), eq(schema.cartItems.itemId, data.ticketId)))
      .limit(1);

    if (existingItem) {
      await db.update(schema.cartItems).set({ notes }).where(eq(schema.cartItems.id, existingItem.id));
      revalidatePath(`/${slug}/keranjang`);
      return { success: true, data: { cartItemId: existingItem.id } };
    }

    const [{ cnt }] = await db
      .select({ cnt: sql<number>`count(*)` })
      .from(schema.cartItems)
      .where(eq(schema.cartItems.cartId, cartId));

    const [cartItem] = await db
      .insert(schema.cartItems)
      .values({
        cartId,
        itemType:  "ticket",
        itemId:    data.ticketId,
        name:      ticket.name,
        unitPrice: price.toFixed(2),
        quantity:  1,
        notes,
        sortOrder: Number(cnt),
      })
      .returning({ id: schema.cartItems.id });

    revalidatePath(`/${slug}/keranjang`);
    return { success: true, data: { cartItemId: cartItem.id } };
  } catch (err) {
    console.error("[addEventTicketToCartAction]", err);
    return { success: false, error: "Gagal menambahkan tiket ke keranjang." };
  }
}

// ─── Konfirmasi Pembayaran (admin) ────────────────────────────────────────────

export async function confirmRegistrationPaymentAction(
  slug: string,
  paymentId: string
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!canConfirmPayment(access.tenantUser, "event"))
    return { success: false, error: "Hanya admin yang bisa mengkonfirmasi pembayaran." };

  const tenantDb = createTenantDb(slug);
  const { db, schema } = tenantDb;

  const [payment] = await db
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.id, paymentId))
    .limit(1);

  if (!payment) return { success: false, error: "Data pembayaran tidak ditemukan." };
  if (payment.sourceType !== "event_registration")
    return { success: false, error: "Bukan pembayaran event." };
  if (payment.status === "paid")
    return { success: false, error: "Pembayaran sudah dikonfirmasi sebelumnya." };

  const [reg] = await db
    .select({ id: schema.eventRegistrations.id, eventId: schema.eventRegistrations.eventId })
    .from(schema.eventRegistrations)
    .where(eq(schema.eventRegistrations.id, payment.sourceId!))
    .limit(1);

  if (!reg) return { success: false, error: "Data registrasi tidak ditemukan." };

  const mappings      = await resolveEventAccounts(tenantDb);
  const cashAccountId = mappings.cash_default ?? mappings.bank_default;
  const incomeAccountId = mappings.event_income;

  if (!cashAccountId || !incomeAccountId) {
    return {
      success: false,
      error: "Mapping akun belum dikonfigurasi. Atur di Keuangan → Akun → Mapping (cash_default + event_income).",
    };
  }

  const amount = parseFloat(String(payment.amount));

  try {
    const tenantTimezone = await getTenantTimezone(tenantDb);
    const txNumber = await generateFinancialNumber(tenantDb, "journal");
    const transaction = await recordIncome(tenantDb, {
      date:            todayInTz(tenantTimezone),
      description:     `Pembayaran tiket event ${payment.number}`,
      referenceNumber: txNumber,
      createdBy:       access.userId,
      amount,
      cashAccountId,
      incomeAccountId,
    });

    await db
      .update(schema.payments)
      .set({
        status:        "paid",
        confirmedBy:   access.userId,
        confirmedAt:   new Date(),
        transactionId: transaction.id,
        updatedAt:     new Date(),
      })
      .where(eq(schema.payments.id, paymentId));

    // Konfirmasi registrasi
    await db
      .update(schema.eventRegistrations)
      .set({ status: "confirmed", updatedAt: new Date() })
      .where(eq(schema.eventRegistrations.id, reg.id));

    // Sync invoice yang terhubung ke registrasi ini
    await syncInvoicePayment(tenantDb, {
      sourceType: "event_registration",
      sourceId:   reg.id,
      paymentId:  paymentId,
      amount,
    });

    revalidatePath(`/app/${slug}/event/acara/${reg.eventId}`);
    return { success: true, data: undefined };
  } catch (err) {
    console.error("[confirmRegistrationPaymentAction]", err);
    return { success: false, error: "Gagal mengkonfirmasi pembayaran." };
  }
}

// ─── Konfirmasi pembayaran event via invoice (alur cart/publik) ───────────────
// Dipakai saat customer submit bukti bayar melalui halaman invoice publik.
// Payment source_type = 'invoice' (bukan 'event_registration' seperti alur lama).

export async function confirmEventInvoicePaymentAction(
  slug:      string,
  paymentId: string,
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!canConfirmPayment(access.tenantUser, "event"))
    return { success: false, error: "Hanya admin yang bisa mengkonfirmasi pembayaran." };

  const tenantDb = createTenantDb(slug);
  const { db, schema } = tenantDb;

  const [payment] = await db
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.id, paymentId))
    .limit(1);

  if (!payment)                         return { success: false, error: "Pembayaran tidak ditemukan." };
  if (payment.status === "paid")        return { success: false, error: "Pembayaran sudah diverifikasi." };
  if (payment.sourceType !== "invoice") return { success: false, error: "Bukan pembayaran invoice." };
  if (!payment.sourceId)                return { success: false, error: "Invoice tidak ditemukan." };

  const [inv] = await db
    .select()
    .from(schema.invoices)
    .where(eq(schema.invoices.id, payment.sourceId))
    .limit(1);

  if (!inv)                             return { success: false, error: "Invoice tidak ditemukan." };
  if (inv.status === "paid")            return { success: false, error: "Invoice sudah lunas." };
  if (inv.status === "cancelled")       return { success: false, error: "Invoice sudah dibatalkan." };
  if (inv.sourceType !== "event_registration") return { success: false, error: "Bukan invoice event." };
  if (!inv.sourceId)                    return { success: false, error: "Registrasi tidak ditemukan." };

  const payAmount  = parseFloat(String(payment.amount));

  const mappings      = await resolveEventAccounts(tenantDb);
  const cashAccountId = mappings.cash_default ?? mappings.bank_default;
  const incomeAccountId = mappings.event_income;

  if (!cashAccountId || !incomeAccountId) {
    return {
      success: false,
      error: "Mapping akun belum dikonfigurasi. Atur di Keuangan → Akun → Mapping.",
    };
  }

  try {
    const tenantTimezone = await getTenantTimezone(tenantDb);
    const txNumber = await generateFinancialNumber(tenantDb, "journal");

    await db.transaction(async (tx) => {
      // Lock invoice — cegah race dengan pemanggil lain (checkoutAction/finance/billing) pada
      // invoice yang sama, pola sama dengan confirmInvoicePaymentAction.
      const [lockedInv] = await tx
        .select()
        .from(schema.invoices)
        .where(sql`${schema.invoices.id} = ${inv.id} FOR UPDATE`)
        .limit(1);
      if (!lockedInv || lockedInv.status === "paid" || lockedInv.status === "cancelled") return;

      const paidSoFar  = parseFloat(String(lockedInv.paidAmount));
      const total      = parseFloat(String(lockedInv.total));
      const uniqueCode = lockedInv.uniqueCode ?? 0;
      const newPaid    = paidSoFar + payAmount;
      const newStatus  = newPaid >= (total + uniqueCode) ? "paid" : "partial";

      await tx
        .update(schema.payments)
        .set({ status: "paid", confirmedBy: access.tenantUser.id, confirmedAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.payments.id, paymentId));

      await tx
        .update(schema.invoices)
        .set({ paidAmount: newPaid.toFixed(2), status: newStatus, updatedAt: new Date() })
        .where(eq(schema.invoices.id, inv.id));

      if (newStatus === "paid") {
        // Bukukan nominal SESUNGGUHNYA yang diterima (termasuk kelebihan bayar), dikurangi
        // uniqueCode invoice-level saja — konsisten dengan confirmInvoicePaymentAction di
        // finance/billing/actions.ts. Lihat docs/arsitektur-billing.md § "Overpayment Juga Dijurnal".
        const journalAmount = Math.max(0, newPaid - uniqueCode);
        await recordIncome(tenantDb, {
          date:            todayInTz(tenantTimezone),
          description:     `Pembayaran tiket event - ${inv.invoiceNumber}`,
          referenceNumber: txNumber,
          createdBy:       access.tenantUser.id,
          amount:          journalAmount,
          cashAccountId,
          incomeAccountId,
        });

        await tx
          .update(schema.eventRegistrations)
          .set({ status: "confirmed", updatedAt: new Date() })
          .where(eq(schema.eventRegistrations.id, inv.sourceId!));
      }
    });

    // Cari eventId untuk revalidate
    const [reg] = await db
      .select({ eventId: schema.eventRegistrations.eventId })
      .from(schema.eventRegistrations)
      .where(eq(schema.eventRegistrations.id, inv.sourceId))
      .limit(1);

    if (reg?.eventId) revalidatePath(`/app/${slug}/event/acara/${reg.eventId}`);
    return { success: true, data: undefined };
  } catch (err) {
    console.error("[confirmEventInvoicePaymentAction]", err);
    return { success: false, error: "Gagal mengkonfirmasi pembayaran." };
  }
}

// ─── Setujui registrasi pending (admin — untuk requireApproval=true) ──────────

export async function approveRegistrationAction(
  slug: string,
  registrationId: string
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "event"))
    return { success: false, error: "Hanya admin yang bisa menyetujui pendaftaran." };

  const { db, schema } = createTenantDb(slug);

  const [reg] = await db
    .select({ id: schema.eventRegistrations.id, eventId: schema.eventRegistrations.eventId, status: schema.eventRegistrations.status })
    .from(schema.eventRegistrations)
    .where(eq(schema.eventRegistrations.id, registrationId))
    .limit(1);

  if (!reg) return { success: false, error: "Registrasi tidak ditemukan." };
  if (reg.status !== "pending") return { success: false, error: "Registrasi tidak dalam status pending." };

  await db
    .update(schema.eventRegistrations)
    .set({ status: "confirmed", updatedAt: new Date() })
    .where(eq(schema.eventRegistrations.id, registrationId));

  revalidatePath(`/app/${slug}/event/acara/${reg.eventId}`);
  return { success: true, data: undefined };
}

// ─── Batalkan registrasi (admin) ──────────────────────────────────────────────

export async function cancelRegistrationAction(
  slug: string,
  registrationId: string
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "event"))
    return { success: false, error: "Hanya admin yang bisa membatalkan registrasi." };

  const { db, schema } = createTenantDb(slug);

  const [reg] = await db
    .select({ id: schema.eventRegistrations.id, eventId: schema.eventRegistrations.eventId })
    .from(schema.eventRegistrations)
    .where(eq(schema.eventRegistrations.id, registrationId))
    .limit(1);

  if (!reg) return { success: false, error: "Registrasi tidak ditemukan." };

  await db
    .update(schema.eventRegistrations)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(schema.eventRegistrations.id, registrationId));

  // Cancel payment jika ada
  await db
    .update(schema.payments)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(and(
      eq(schema.payments.sourceType, "event_registration"),
      eq(schema.payments.sourceId,   registrationId),
      sql`${schema.payments.status} != 'paid'`
    ));

  revalidatePath(`/app/${slug}/event/acara/${reg.eventId}`);
  return { success: true, data: undefined };
}

// ─── Edit data peserta (admin) — untuk registrasi yang sudah terlanjur masuk ──
// dengan attendeeName/HP/email/custom form salah atau belum lengkap (mis. hasil invoice
// manual admin sebelum fix custom form, lihat lib/event-custom-form.ts). Tidak menyentuh
// status/pembayaran — murni koreksi data kontak+identitas peserta.

export type UpdateRegistrationData = {
  attendeeName:        string;
  attendeePhone:        string;
  attendeeEmail:        string;
  customFieldAnswers?:  Record<string, string>;
};

// Keys di dalam event_registrations.customFields yang DIKELOLA SISTEM (bukan jawaban form
// custom field yang diedit admin lewat dialog ini) — WAJIB dipertahankan saat admin mengedit
// data peserta. `sourceInvoiceId` adalah satu-satunya penghubung registrasi tiket dari cart ke
// invoice pelunasannya (bukan foreign key kolom, murni key JSONB) — kalau ditimpa/hilang, invoice
// yang sudah lunas tidak lagi terhubung ke registrasinya (status pembayaran tampil salah di
// admin/export meski pendaftaran sudah confirmed). Lihat lib/event-registration-sync.server.ts.
const RESERVED_CUSTOM_FIELD_KEYS = ["sourceInvoiceId"] as const;

export async function updateRegistrationDataAction(
  slug: string,
  registrationId: string,
  data: UpdateRegistrationData,
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "event"))
    return { success: false, error: "Hanya admin yang bisa mengedit data peserta." };

  if (!data.attendeeName?.trim())
    return { success: false, error: "Nama peserta wajib diisi." };

  const { db, schema } = createTenantDb(slug);

  const [reg] = await db
    .select({
      id:           schema.eventRegistrations.id,
      eventId:      schema.eventRegistrations.eventId,
      customFields: schema.eventRegistrations.customFields,
    })
    .from(schema.eventRegistrations)
    .where(eq(schema.eventRegistrations.id, registrationId))
    .limit(1);

  if (!reg) return { success: false, error: "Registrasi tidak ditemukan." };

  // MERGE, bukan replace — dulu customFields ditimpa total dengan customFieldAnswers, diam-diam
  // menghapus sourceInvoiceId setiap kali admin edit nama/HP/email peserta di dialog ini.
  const existingFields = (reg.customFields ?? {}) as Record<string, unknown>;
  const preservedFields: Record<string, unknown> = {};
  for (const key of RESERVED_CUSTOM_FIELD_KEYS) {
    if (existingFields[key] !== undefined) preservedFields[key] = existingFields[key];
  }
  const mergedFields = { ...preservedFields, ...(data.customFieldAnswers ?? {}) };

  try {
    await db
      .update(schema.eventRegistrations)
      .set({
        attendeeName:  data.attendeeName.trim(),
        attendeePhone: data.attendeePhone?.trim() ? normalizePhone(data.attendeePhone) : null,
        attendeeEmail: data.attendeeEmail?.trim().toLowerCase() || null,
        customFields:  Object.keys(mergedFields).length > 0 ? mergedFields : null,
        updatedAt: new Date(),
      })
      .where(eq(schema.eventRegistrations.id, registrationId));

    revalidatePath(`/app/${slug}/event/acara/${reg.eventId}`);
    return { success: true, data: undefined };
  } catch (err) {
    console.error("[updateRegistrationDataAction]", err);
    return { success: false, error: "Gagal menyimpan data peserta." };
  }
}

// ─── Check-in peserta (admin) ─────────────────────────────────────────────────

export async function checkInRegistrationAction(
  slug: string,
  registrationId: string
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "event"))
    return { success: false, error: "Akses ditolak." };

  const { db, schema } = createTenantDb(slug);

  const [reg] = await db
    .select({ id: schema.eventRegistrations.id, eventId: schema.eventRegistrations.eventId, status: schema.eventRegistrations.status })
    .from(schema.eventRegistrations)
    .where(eq(schema.eventRegistrations.id, registrationId))
    .limit(1);

  if (!reg) return { success: false, error: "Registrasi tidak ditemukan." };
  if (!["confirmed", "pending"].includes(reg.status))
    return { success: false, error: `Peserta berstatus "${reg.status}", tidak bisa check-in.` };

  await db
    .update(schema.eventRegistrations)
    .set({ status: "attended", checkedInAt: new Date(), checkedInBy: access.userId, updatedAt: new Date() })
    .where(eq(schema.eventRegistrations.id, registrationId));

  revalidatePath(`/app/${slug}/event/acara/${reg.eventId}`);
  revalidatePath(`/app/${slug}/event/acara/${reg.eventId}/checkin`);
  return { success: true, data: undefined };
}

// Export generateRegistrationNumber
export { generateRegistrationNumber };
