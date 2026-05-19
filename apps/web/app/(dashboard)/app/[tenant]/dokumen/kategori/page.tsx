import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { eq, count } from "drizzle-orm";
import { DokumenCategoryClient } from "@/components/dokumen/dokumen-category-client";
import { FolderOpen } from "lucide-react";

export default async function DokumenKategori({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/login");

  const { db, schema } = createTenantDb(slug);

  // Fetch semua kategori
  const cats = await db
    .select({
      id:        schema.documentCategories.id,
      name:      schema.documentCategories.name,
      slug:      schema.documentCategories.slug,
      parentId:  schema.documentCategories.parentId,
      sortOrder: schema.documentCategories.sortOrder,
    })
    .from(schema.documentCategories)
    .orderBy(schema.documentCategories.sortOrder, schema.documentCategories.name);

  // Hitung dokumen per kategori
  const docCounts = await db
    .select({
      categoryId: schema.documents.categoryId,
      total:      count(),
    })
    .from(schema.documents)
    .groupBy(schema.documents.categoryId);

  const countMap = new Map(docCounts.map((r) => [r.categoryId, Number(r.total)]));

  const categories = cats.map((c) => ({
    ...c,
    docCount: countMap.get(c.id) ?? 0,
  }));

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-2">
        <FolderOpen className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-semibold">Kategori Dokumen</h1>
        <span className="text-sm text-muted-foreground">({categories.length})</span>
      </div>

      <DokumenCategoryClient slug={slug} categories={categories} />
    </div>
  );
}
