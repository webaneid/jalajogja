import { asc, count, eq } from "drizzle-orm";
import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { CategoryManager } from "@/components/website/category-manager";

export default async function CategoriesPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;

  const access = await getTenantAccess(slug);
  if (!access) redirect(`/login`);

  const { db, schema } = createTenantDb(slug);

  // Fetch semua kategori + jumlah posts per kategori secara paralel
  const [rawCategories, rawTags] = await Promise.all([
    db
      .select({
        id:       schema.postCategories.id,
        name:     schema.postCategories.name,
        slug:     schema.postCategories.slug,
        parentId: schema.postCategories.parentId,
      })
      .from(schema.postCategories)
      .orderBy(asc(schema.postCategories.name)),

    db
      .select({
        id:   schema.postTags.id,
        name: schema.postTags.name,
        slug: schema.postTags.slug,
      })
      .from(schema.postTags)
      .orderBy(asc(schema.postTags.name)),
  ]);

  // Count posts per kategori
  const catPostCounts = await db
    .select({
      categoryId: schema.posts.categoryId,
      total: count(),
    })
    .from(schema.posts)
    .groupBy(schema.posts.categoryId);

  const catCountMap = new Map(
    catPostCounts
      .filter((r) => r.categoryId !== null)
      .map((r) => [r.categoryId!, Number(r.total)])
  );

  // Count posts per tag via pivot
  const tagPostCounts = await db
    .select({
      tagId: schema.postTagPivot.tagId,
      total: count(),
    })
    .from(schema.postTagPivot)
    .groupBy(schema.postTagPivot.tagId);

  const tagCountMap = new Map(
    tagPostCounts.map((r) => [r.tagId, Number(r.total)])
  );

  // Gabungkan data dengan post count
  const categories = rawCategories.map((cat) => ({
    ...cat,
    postCount: catCountMap.get(cat.id) ?? 0,
  }));

  const tags = rawTags.map((tag) => ({
    ...tag,
    postCount: tagCountMap.get(tag.id) ?? 0,
  }));

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Kategori & Tag</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Kelola taksonomi konten website
        </p>
      </div>

      <CategoryManager
        slug={slug}
        categories={categories}
        tags={tags}
      />
    </div>
  );
}
