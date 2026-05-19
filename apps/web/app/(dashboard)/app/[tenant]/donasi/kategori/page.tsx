import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { CampaignCategoryManageClient } from "@/components/donasi/campaign-category-manage-client";

export default async function KategoriDonasiPage({
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
      id:            schema.campaignCategories.id,
      name:          schema.campaignCategories.name,
      slug:          schema.campaignCategories.slug,
      campaignCount: sql<number>`COUNT(${schema.campaigns.id})::int`,
    })
    .from(schema.campaignCategories)
    .leftJoin(
      schema.campaigns,
      sql`${schema.campaigns.categoryId} = ${schema.campaignCategories.id}`
    )
    .groupBy(
      schema.campaignCategories.id,
      schema.campaignCategories.name,
      schema.campaignCategories.slug,
    )
    .orderBy(schema.campaignCategories.sortOrder, schema.campaignCategories.name);

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold">Kategori Campaign</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {categories.length} kategori
        </p>
      </div>

      <CampaignCategoryManageClient
        slug={slug}
        initialCategories={categories as { id: string; name: string; slug: string; campaignCount: number }[]}
      />
    </div>
  );
}
