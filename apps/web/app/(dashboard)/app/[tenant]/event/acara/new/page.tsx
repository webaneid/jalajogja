import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import { EventForm } from "@/components/event/event-form";
import { getTenantTimezone } from "@/lib/tenant-timezone";
import type { SeoValues } from "@/components/seo/seo-panel";

const DEFAULT_SEO: SeoValues = {
  metaTitle:      "",
  metaDesc:       "",
  focusKeyword:   "",
  ogTitle:        "",
  ogDescription:  "",
  ogImageId:      null,
  ogImageUrl:     null,
  twitterCard:    "summary_large_image",
  canonicalUrl:   "",
  robots:         "index,follow",
  schemaType:     "Event",
  structuredData: "",
};

export default async function AcaraNewPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/app/login");

  const tenantClient = createTenantDb(slug);
  const { db, schema } = tenantClient;

  const [categories, activeCampaigns, activeProducts, tenantTimezone] = await Promise.all([
    db.select({ id: schema.eventCategories.id, name: schema.eventCategories.name })
      .from(schema.eventCategories)
      .orderBy(schema.eventCategories.sortOrder, schema.eventCategories.name),
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

  return (
    <EventForm
      slug={slug}
      eventId={null}
      categories={categories}
      activeCampaigns={activeCampaigns}
      activeProducts={activeProducts}
      tenantTimezone={tenantTimezone}
      initialData={{
        slug:             "",
        title:            "",
        description:      "",
        categoryId:       null,
        eventType:        "offline",
        status:           "draft",
        startsAt:         null,
        endsAt:           null,
        location:         "",
        locationDetail:   "",
        mapsUrl:          "",
        onlineLink:       "",
        organizerName:    "",
        maxCapacity:      null,
        showAttendeeList:   false,
        showTicketCount:    true,
        requireApproval:    false,
        showDonationPrompt: false,
        enableCustomForm:   false,
        customFormFields:   [],
        showAttendeeStats:  false,
        attendeeStatsBy:    [],
        linkedCampaignId:   null,
        linkedProductId:    null,
        coverId:            null,
        coverUrl:         null,
        tickets:          [],
        seo:              DEFAULT_SEO,
      }}
    />
  );
}
