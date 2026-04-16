import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { EventForm } from "@/components/event/event-form";
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
  if (!access) redirect("/login");

  const { db, schema } = createTenantDb(slug);

  const categories = await db
    .select({ id: schema.eventCategories.id, name: schema.eventCategories.name })
    .from(schema.eventCategories)
    .orderBy(schema.eventCategories.sortOrder, schema.eventCategories.name);

  return (
    <EventForm
      slug={slug}
      eventId={null}
      categories={categories}
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
        onlineLink:       "",
        organizerName:    "",
        maxCapacity:      null,
        showAttendeeList: false,
        showTicketCount:  true,
        requireApproval:  false,
        coverId:          null,
        coverUrl:         null,
        tickets:          [],
        seo:              DEFAULT_SEO,
      }}
    />
  );
}
