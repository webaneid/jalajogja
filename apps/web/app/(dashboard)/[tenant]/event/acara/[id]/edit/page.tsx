import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect, notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { EventForm } from "@/components/event/event-form";
import type { SeoValues } from "@/components/seo/seo-panel";

export default async function AcaraEditPage({
  params,
}: {
  params: Promise<{ tenant: string; id: string }>;
}) {
  const { tenant: slug, id: eventId } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/login");

  const { db, schema } = createTenantDb(slug);

  const [[event], categories, tickets] = await Promise.all([
    db.select().from(schema.events).where(eq(schema.events.id, eventId)).limit(1),
    db.select({ id: schema.eventCategories.id, name: schema.eventCategories.name })
      .from(schema.eventCategories)
      .orderBy(schema.eventCategories.sortOrder, schema.eventCategories.name),
    db.select()
      .from(schema.eventTickets)
      .where(eq(schema.eventTickets.eventId, eventId))
      .orderBy(schema.eventTickets.sortOrder),
  ]);

  if (!event) notFound();

  // Ambil URL cover image jika ada
  let coverUrl: string | null = null;
  if (event.coverId) {
    const [media] = await db
      .select({ path: schema.media.path })
      .from(schema.media)
      .where(eq(schema.media.id, event.coverId))
      .limit(1);
    coverUrl = media?.path ?? null;
  }

  return (
    <EventForm
      slug={slug}
      eventId={eventId}
      categories={categories}
      initialData={{
        slug:             event.slug,
        title:            event.title,
        description:      event.description      ?? "",
        categoryId:       event.categoryId        ?? null,
        eventType:        event.eventType         as "offline" | "online" | "hybrid",
        status:           event.status            as "draft" | "published" | "cancelled" | "completed",
        startsAt:         event.startsAt
          ? new Date(event.startsAt).toISOString().slice(0, 16)
          : null,
        endsAt:           event.endsAt
          ? new Date(event.endsAt).toISOString().slice(0, 16)
          : null,
        location:         event.location          ?? "",
        locationDetail:   event.locationDetail    ?? "",
        onlineLink:       event.onlineLink        ?? "",
        organizerName:    event.organizerName     ?? "",
        maxCapacity:      event.maxCapacity        ?? null,
        showAttendeeList: event.showAttendeeList,
        showTicketCount:  event.showTicketCount,
        requireApproval:  event.requireApproval,
        coverId:          event.coverId            ?? null,
        coverUrl,
        tickets: tickets.map((t) => ({
          id:           t.id,
          name:         t.name,
          description:  t.description   ?? "",
          price:        parseFloat(String(t.price)),
          quota:        t.quota          ?? null,
          isActive:     t.isActive,
          saleStartsAt: t.saleStartsAt
            ? new Date(t.saleStartsAt).toISOString().slice(0, 16)
            : null,
          saleEndsAt:   t.saleEndsAt
            ? new Date(t.saleEndsAt).toISOString().slice(0, 16)
            : null,
          sortOrder:    t.sortOrder,
        })),
        seo: {
          metaTitle:      event.metaTitle     ?? "",
          metaDesc:       event.metaDesc      ?? "",
          focusKeyword:   event.focusKeyword  ?? "",
          ogTitle:        event.ogTitle       ?? "",
          ogDescription:  event.ogDescription ?? "",
          ogImageId:      event.ogImageId     ?? null,
          ogImageUrl:     null,
          twitterCard:    (event.twitterCard  ?? "summary_large_image") as SeoValues["twitterCard"],
          canonicalUrl:   event.canonicalUrl  ?? "",
          robots:         (event.robots       ?? "index,follow") as SeoValues["robots"],
          schemaType:     (event.schemaType   ?? "Event") as SeoValues["schemaType"],
          structuredData: "",
        },
      }}
    />
  );
}
