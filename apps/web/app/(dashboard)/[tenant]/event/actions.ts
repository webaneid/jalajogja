"use server";

import { eq, count, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";

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
    const [row] = await tx
      .select()
      .from(schema.eventRegistrationSequences)
      .where(
        eq(schema.eventRegistrationSequences.year, year)
      )
      .limit(1);

    if (!row || row.month !== month) {
      await tx.insert(schema.eventRegistrationSequences).values({ year, month, counter: 1 });
      return 1;
    }

    const next = row.counter + 1;
    await tx
      .update(schema.eventRegistrationSequences)
      .set({ counter: next })
      .where(eq(schema.eventRegistrationSequences.id, row.id));
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
  if (!["owner", "admin"].includes(access.tenantUser.role))
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
        location:         data.location?.trim()   ?? null,
        locationDetail:   data.locationDetail?.trim() ?? null,
        onlineLink:       data.onlineLink?.trim() ?? null,
        organizerName:    data.organizerName?.trim() ?? null,
        maxCapacity:      data.maxCapacity         ?? null,
        showAttendeeList: data.showAttendeeList,
        showTicketCount:  data.showTicketCount,
        requireApproval:  data.requireApproval,
        coverId:          data.coverId             ?? null,
        metaTitle:        data.metaTitle?.trim()  || null,
        metaDesc:         data.metaDesc?.trim()   || null,
        ogTitle:          data.ogTitle?.trim()    || null,
        ogDescription:    data.ogDescription?.trim() || null,
        ogImageId:        data.ogImageId           ?? null,
        twitterCard:      data.twitterCard         || "summary_large_image",
        focusKeyword:     data.focusKeyword?.trim() || null,
        canonicalUrl:     data.canonicalUrl?.trim() || null,
        robots:           data.robots              || "index,follow",
        schemaType:       data.schemaType          || "Event",
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
  if (!["owner", "admin"].includes(access.tenantUser.role))
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
        location:         data.location?.trim()   ?? null,
        locationDetail:   data.locationDetail?.trim() ?? null,
        onlineLink:       data.onlineLink?.trim() ?? null,
        organizerName:    data.organizerName?.trim() ?? null,
        maxCapacity:      data.maxCapacity         ?? null,
        showAttendeeList: data.showAttendeeList,
        showTicketCount:  data.showTicketCount,
        requireApproval:  data.requireApproval,
        coverId:          data.coverId             ?? null,
        metaTitle:        data.metaTitle?.trim()  || null,
        metaDesc:         data.metaDesc?.trim()   || null,
        ogTitle:          data.ogTitle?.trim()    || null,
        ogDescription:    data.ogDescription?.trim() || null,
        ogImageId:        data.ogImageId           ?? null,
        twitterCard:      data.twitterCard         || "summary_large_image",
        focusKeyword:     data.focusKeyword?.trim() || null,
        canonicalUrl:     data.canonicalUrl?.trim() || null,
        robots:           data.robots              || "index,follow",
        schemaType:       data.schemaType          || "Event",
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
  if (!["owner", "admin"].includes(access.tenantUser.role))
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
  if (!["owner", "admin"].includes(access.tenantUser.role))
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
  if (!["owner", "admin"].includes(access.tenantUser.role))
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
  if (!["owner", "admin"].includes(access.tenantUser.role))
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

// Export generateRegistrationNumber untuk dipakai di halaman pendaftaran (roadmap)
export { generateRegistrationNumber };
