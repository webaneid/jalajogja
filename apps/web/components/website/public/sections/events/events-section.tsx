import { eq, desc, and, gte, inArray } from "drizzle-orm";
import { getSettings, type TenantDb } from "@jalajogja/db";
import { getTenantTimezone } from "@/lib/tenant-timezone.server";
import { publicUrl } from "@/lib/minio";
import type { EventCardData } from "@/lib/event-card-templates";
import type { EventsSectionData, EventsSectionDesignId, EventsSectionProps } from "@/lib/events-section-designs";
import { EVENT_ARCHIVE_CARD_DESIGN_IDS, type EventArchiveCardDesignId } from "@/lib/event-archive-card-designs";
import { EventsDesign1 } from "./events-design-1";
import { EventsDesign2 } from "./events-design-2";
import { EventsDesign3 } from "./events-design-3";

type Props = {
  data:         EventsSectionData;
  variant:      EventsSectionDesignId;
  tenantClient: TenantDb;
  tenantSlug:   string;
};

async function fetchEvents(
  tenantClient: TenantDb,
  data: EventsSectionData,
  tenantSlug: string,
): Promise<EventCardData[]> {
  const { db, schema } = tenantClient;
  const count = data.count ?? 6;
  const now   = new Date();

  const clauses = [
    eq(schema.events.status, "published"),
    ...(data.categoryId   ? [eq(schema.events.categoryId, data.categoryId)] : []),
    ...(data.upcomingOnly ? [gte(schema.events.startsAt, now)]              : []),
  ];

  const rows = await db
    .select({
      id:           schema.events.id,
      title:        schema.events.title,
      slug:         schema.events.slug,
      description:  schema.events.description,
      eventType:    schema.events.eventType,
      coverId:      schema.events.coverId,
      startsAt:     schema.events.startsAt,
      endsAt:       schema.events.endsAt,
      location:     schema.events.location,
      status:       schema.events.status,
      categoryName: schema.eventCategories.name,
    })
    .from(schema.events)
    .leftJoin(schema.eventCategories, eq(schema.eventCategories.id, schema.events.categoryId))
    .where(and(...clauses))
    .orderBy(schema.events.startsAt)
    .limit(count);

  // Resolve covers
  const coverIds = [...new Set(rows.map(r => r.coverId).filter(Boolean))] as string[];
  const coverMap = new Map<string, string>();
  if (coverIds.length > 0) {
    const media = await db.select({ id: schema.media.id, path: schema.media.path })
      .from(schema.media).where(inArray(schema.media.id, coverIds));
    media.forEach(m => coverMap.set(m.id, publicUrl(tenantSlug, m.path)));
  }

  // lowestPrice per event (MIN dari tiket aktif)
  const eventIds = rows.map(r => r.id);
  const priceMap = new Map<string, string>();
  if (eventIds.length > 0) {
    const prices = await db
      .select({ eventId: schema.eventTickets.eventId })
      .from(schema.eventTickets)
      .where(and(
        inArray(schema.eventTickets.eventId, eventIds),
        eq(schema.eventTickets.isActive, true),
      ));
    // Group by eventId — menggunakan JavaScript karena tidak ada MIN() helper yang mudah
    for (const row of rows) {
      const tickets = await db
        .select({ price: schema.eventTickets.price })
        .from(schema.eventTickets)
        .where(and(
          eq(schema.eventTickets.eventId, row.id),
          eq(schema.eventTickets.isActive, true),
        ));
      if (tickets.length > 0) {
        const min = Math.min(...tickets.map(t => parseFloat(String(t.price))));
        priceMap.set(row.id, String(min));
      }
    }
    // suppress unused variable warning
    void prices;
  }

  return rows.map(r => ({
    id:           r.id,
    title:        r.title,
    slug:         r.slug,
    description:  r.description,
    eventType:    (r.eventType ?? "offline") as EventCardData["eventType"],
    coverUrl:     r.coverId ? (coverMap.get(r.coverId) ?? null) : null,
    categoryName: r.categoryName ?? null,
    startsAt:     r.startsAt ? r.startsAt.toISOString() : null,
    endsAt:       r.endsAt   ? r.endsAt.toISOString()   : null,
    location:     r.location ?? null,
    lowestPrice:  priceMap.get(r.id) ?? null,
    status:       r.status,
  }));
}

export async function EventsSection({ data, variant, tenantClient, tenantSlug }: Props) {
  const { db, schema } = tenantClient;

  let sectionTitle = data.title || "Event Mendatang";
  let filterHref   = `/${tenantSlug}/agenda`;

  if (data.categoryId) {
    const [cat] = await db
      .select({ name: schema.eventCategories.name, slug: schema.eventCategories.slug })
      .from(schema.eventCategories)
      .where(eq(schema.eventCategories.id, data.categoryId))
      .limit(1);
    if (cat) {
      if (!data.title) sectionTitle = cat.name;
      filterHref = `/${tenantSlug}/agenda?category=${cat.slug}`;
    }
  }

  const events = await fetchEvents(tenantClient, data, tenantSlug);

  // Desain kartu untuk "Grid Event" — ikut setting Desain Kartu Arsip yang aktif.
  // Lihat docs/arsitektur-event.md § "Coupling ke Landing Section Grid Event".
  const eventSettings    = await getSettings(tenantClient, "event");
  const archiveDesignRaw = eventSettings.event_archive_design as { design?: string } | undefined;
  const cardDesign: EventArchiveCardDesignId = EVENT_ARCHIVE_CARD_DESIGN_IDS.includes(archiveDesignRaw?.design as EventArchiveCardDesignId)
    ? (archiveDesignRaw!.design as EventArchiveCardDesignId)
    : "1";

  const timezone = await getTenantTimezone(tenantClient);

  const props: EventsSectionProps = { data, events, tenantSlug, sectionTitle, filterHref, cardDesign, timezone };

  switch (variant) {
    case "2": return <EventsDesign2 {...props} />;
    case "3": return <EventsDesign3 {...props} />;
    default:  return <EventsDesign1 {...props} />;
  }
}
