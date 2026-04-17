"use server";

import { eq, count, inArray, and, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { createTenantDb, generateFinancialNumber, recordIncome } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { hasFullAccess, canConfirmPayment } from "@/lib/permissions";

// ─── Types ────────────────────────────────────────────────────────────────────

type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export type TicketInput = {
  id?:           string | null;
  name:          string;
  description?:  string | null;
  price:         number;
  quota?:        number | null;
  isActive:      boolean;
  saleStartsAt?: string | null;
  saleEndsAt?:   string | null;
  sortOrder:     number;
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
  showAttendeeList: boolean;
  showTicketCount:  boolean;
  requireApproval:  boolean;
  coverId?:         string | null;
  tickets:          TicketInput[];
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
  revalidatePath(`/${slug}/event`);
  revalidatePath(`/${slug}/event/acara`);
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
        name:         t.name.trim(),
        description:  t.description?.trim() ?? null,
        price:        String(t.price ?? 0),
        quota:        t.quota ?? null,
        isActive:     t.isActive,
        saleStartsAt: t.saleStartsAt ? new Date(t.saleStartsAt) : null,
        saleEndsAt:   t.saleEndsAt   ? new Date(t.saleEndsAt)   : null,
        sortOrder:    t.sortOrder,
      })
      .where(eq(schema.eventTickets.id, t.id!));
  }

  // Insert tiket baru
  const newTickets = tickets.filter((t) => !t.id);
  if (newTickets.length > 0) {
    await db.insert(schema.eventTickets).values(
      newTickets.map((t) => ({
        eventId,
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
        showAttendeeList: data.showAttendeeList,
        showTicketCount:  data.showTicketCount,
        requireApproval:  data.requireApproval,
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
        showAttendeeList: data.showAttendeeList,
        showTicketCount:  data.showTicketCount,
        requireApproval:  data.requireApproval,
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
    revalidatePath(`/${slug}/event/acara/${eventId}`);
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
  data: { name: string; slug: string }
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
      .values({ name: data.name.trim(), slug: data.slug.trim() })
      .returning({ id: schema.eventCategories.id });

    revalidatePath(`/${slug}/event/kategori`);
    revalidatePath(`/${slug}/event/acara`);
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
  data: { name: string; slug: string }
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "event"))
    return { success: false, error: "Hanya admin yang bisa mengubah kategori." };

  const { db, schema } = createTenantDb(slug);

  try {
    await db
      .update(schema.eventCategories)
      .set({ name: data.name.trim(), slug: data.slug.trim() })
      .where(eq(schema.eventCategories.id, categoryId));

    revalidatePath(`/${slug}/event/kategori`);
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

  revalidatePath(`/${slug}/event/kategori`);
  revalidatePath(`/${slug}/event/acara`);
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
}>> {
  if (!data.attendeeName.trim())
    return { success: false, error: "Nama peserta wajib diisi." };

  const tenantDb = createTenantDb(slug);
  const { db, schema } = tenantDb;

  // Cek event masih published + ambil maxCapacity sekaligus
  const [event] = await db
    .select({
      id:              schema.events.id,
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

      return tx
        .insert(schema.eventRegistrations)
        .values({
          registrationNumber: regNumber,
          eventId:            data.eventId,
          ticketId:           data.ticketId,
          attendeeName:       data.attendeeName.trim(),
          attendeePhone:      data.attendeePhone?.trim() ?? null,
          attendeeEmail:      data.attendeeEmail?.trim() ?? null,
          status:             regStatus,
        })
        .returning({ id: schema.eventRegistrations.id });
    });

    // Tiket berbayar — buat payment record
    if (!isGratis) {
      const method     = data.method ?? "transfer";
      const uniqueCode = method === "transfer" ? Math.floor(Math.random() * 999) + 1 : 0;
      const total      = price + uniqueCode;
      const payNum     = await generateFinancialNumber(tenantDb, "payment");

      const [payment] = await db
        .insert(schema.payments)
        .values({
          number:         payNum,
          sourceType:     "event_registration",
          sourceId:       reg.id,
          amount:         String(price),
          uniqueCode,
          method,
          bankAccountRef: data.bankAccountRef ?? null,
          qrisAccountRef: data.qrisAccountRef ?? null,
          status:         method === "cash" ? "submitted" : "pending",
          payerName:      data.attendeeName.trim(),
        })
        .returning({ id: schema.payments.id });

      revalidatePath(`/${slug}/event/acara/${data.eventId}`);
      return {
        success: true,
        data: {
          registrationId:     reg.id,
          registrationNumber: regNumber,
          isPaid:             false,
          amount:             price,
          uniqueCode,
          totalAmount:        total,
          paymentId:          payment.id,
        },
      };
    }

    revalidatePath(`/${slug}/event/acara/${data.eventId}`);
    return {
      success: true,
      data: { registrationId: reg.id, registrationNumber: regNumber, isPaid: true },
    };
  } catch (err) {
    if (err instanceof Error && (err.message.includes("Kuota") || err.message.includes("Kapasitas")))
      return { success: false, error: err.message };
    console.error("[registerForEventAction]", err);
    return { success: false, error: "Gagal mendaftarkan peserta. Silakan coba lagi." };
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
    const txNumber = await generateFinancialNumber(tenantDb, "journal");
    const transaction = await recordIncome(tenantDb, {
      date:            new Date().toISOString().slice(0, 10),
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

    revalidatePath(`/${slug}/event/acara/${reg.eventId}`);
    return { success: true, data: undefined };
  } catch (err) {
    console.error("[confirmRegistrationPaymentAction]", err);
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

  revalidatePath(`/${slug}/event/acara/${reg.eventId}`);
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

  revalidatePath(`/${slug}/event/acara/${reg.eventId}`);
  return { success: true, data: undefined };
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

  revalidatePath(`/${slug}/event/acara/${reg.eventId}`);
  revalidatePath(`/${slug}/event/acara/${reg.eventId}/checkin`);
  return { success: true, data: undefined };
}

// Export generateRegistrationNumber
export { generateRegistrationNumber };
