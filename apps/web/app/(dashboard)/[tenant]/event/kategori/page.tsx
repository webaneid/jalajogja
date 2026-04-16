import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { EventCategoryManageClient } from "@/components/event/event-category-manage-client";

export default async function KategoriEventPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/login");

  const { db, schema } = createTenantDb(slug);

  const categories = await db
    .select({
      id:         schema.eventCategories.id,
      name:       schema.eventCategories.name,
      slug:       schema.eventCategories.slug,
      eventCount: sql<number>`COUNT(${schema.events.id})::int`,
    })
    .from(schema.eventCategories)
    .leftJoin(
      schema.events,
      sql`${schema.events.categoryId} = ${schema.eventCategories.id}`
    )
    .groupBy(
      schema.eventCategories.id,
      schema.eventCategories.name,
      schema.eventCategories.slug,
    )
    .orderBy(schema.eventCategories.sortOrder, schema.eventCategories.name);

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold">Kategori Event</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {categories.length} kategori
        </p>
      </div>

      <EventCategoryManageClient
        slug={slug}
        initialCategories={categories as { id: string; name: string; slug: string; eventCount: number }[]}
      />
    </div>
  );
}
