import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect, notFound } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import { publicUrl } from "@/lib/minio";
import { EventForm } from "@/components/event/event-form";
import { getTenantTimezone, utcIsoToLocalDatetime } from "@/lib/tenant-timezone.server";
import type { CustomFormField } from "@/lib/event-custom-form";
import type { SeoValues } from "@/components/seo/seo-panel";

export default async function AcaraEditPage({
  params,
}: {
  params: Promise<{ tenant: string; id: string }>;
}) {
  const { tenant: slug, id: eventId } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/app/login");

  const tenantClient = createTenantDb(slug);
  const { db, schema } = tenantClient;

  const [[event], categories, tickets, activeCampaigns, activeProducts, tenantTimezone] = await Promise.all([
    db.select().from(schema.events).where(eq(schema.events.id, eventId)).limit(1),
    db.select({ id: schema.eventCategories.id, name: schema.eventCategories.name })
      .from(schema.eventCategories)
      .orderBy(schema.eventCategories.sortOrder, schema.eventCategories.name),
    db.select()
      .from(schema.eventTickets)
      .where(eq(schema.eventTickets.eventId, eventId))
      .orderBy(schema.eventTickets.sortOrder),
    db.select({ id: schema.campaigns.id, title: schema.campaigns.title })
      .from(schema.campaigns)
      .where(eq(schema.campaigns.status, "active"))
      .orderBy(desc(schema.campaigns.createdAt)),
    db.select({ id: schema.products.id, name: schema.products.name })
      .from(schema.products)
      .where(eq(schema.products.status, "active"))
      .orderBy(schema.products.name),
    getTenantTimezone(tenantClient),
  ]);

  if (!event) notFound();

  let coverUrl: string | null = null;
  if (event.coverId) {
    const [media] = await db
      .select({ path: schema.media.path })
      .from(schema.media)
      .where(eq(schema.media.id, event.coverId))
      .limit(1);
    coverUrl = media ? publicUrl(slug, media.path) : null;
  }

  return (
    <EventForm
      slug={slug}
      eventId={eventId}
      categories={categories}
      activeCampaigns={activeCampaigns}
      activeProducts={activeProducts}
      tenantTimezone={tenantTimezone}
      initialData={{
        slug:             event.slug,
        title:            event.title,
        description:      event.description      ?? "",
        categoryId:       event.categoryId        ?? null,
        eventType:        event.eventType         as "offline" | "online" | "hybrid",
        status:           event.status            as "draft" | "published" | "cancelled" | "completed",
        startsAt:         event.startsAt
          ? utcIsoToLocalDatetime(event.startsAt.toISOString(), tenantTimezone)
          : null,
        endsAt:           event.endsAt
          ? utcIsoToLocalDatetime(event.endsAt.toISOString(), tenantTimezone)
          : null,
        location:         event.location          ?? "",
        locationDetail:   event.locationDetail    ?? "",
        mapsUrl:          event.mapsUrl           ?? "",
        onlineLink:       event.onlineLink        ?? "",
        organizerName:    event.organizerName     ?? "",
        maxCapacity:      event.maxCapacity        ?? null,
        showAttendeeList:   event.showAttendeeList,
        showTicketCount:    event.showTicketCount,
        requireApproval:    event.requireApproval,
        showDonationPrompt: event.showDonationPrompt,
        enableCustomForm:   event.enableCustomForm,
        customFormFields:   (event.customFormFields as CustomFormField[]) ?? [],
        showAttendeeStats:  event.showAttendeeStats,
        attendeeStatsBy:    (event.attendeeStatsBy as string[]) ?? [],
        linkedCampaignId:   event.linkedCampaignId  ?? null,
        linkedProductId:    event.linkedProductId   ?? null,
        coverId:            event.coverId            ?? null,
        coverUrl,
        tickets: tickets.map((t) => ({
          id:                 t.id,
          name:               t.name,
          description:        t.description   ?? "",
          price:              parseFloat(String(t.price)),
          quota:              t.quota          ?? null,
          isActive:           t.isActive,
          saleStartsAt:       t.saleStartsAt
            ? utcIsoToLocalDatetime(t.saleStartsAt.toISOString(), tenantTimezone)
            : null,
          saleEndsAt:         t.saleEndsAt
            ? utcIsoToLocalDatetime(t.saleEndsAt.toISOString(), tenantTimezone)
            : null,
          sortOrder:          t.sortOrder,
          requiresMembership: t.requiresMembership,
          requiresRegistration: t.requiresRegistration,
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
