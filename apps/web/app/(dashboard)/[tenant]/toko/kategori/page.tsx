import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { CategoryManageClient } from "@/components/toko/category-manage-client";

export default async function KategoriPage({
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
      id:           schema.productCategories.id,
      name:         schema.productCategories.name,
      slug:         schema.productCategories.slug,
      productCount: sql<number>`COUNT(${schema.products.id})::int`,
    })
    .from(schema.productCategories)
    .leftJoin(
      schema.products,
      sql`${schema.products.categoryId} = ${schema.productCategories.id}`
    )
    .groupBy(
      schema.productCategories.id,
      schema.productCategories.name,
      schema.productCategories.slug,
    )
    .orderBy(schema.productCategories.name);

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold">Kategori Produk</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {categories.length} kategori
        </p>
      </div>

      <CategoryManageClient slug={slug} initialCategories={categories as { id: string; name: string; slug: string; productCount: number }[]} />
    </div>
  );
}
