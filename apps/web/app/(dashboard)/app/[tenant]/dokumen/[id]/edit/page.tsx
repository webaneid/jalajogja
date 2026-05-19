import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect, notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { DokumenForm } from "@/components/dokumen/dokumen-form";

export default async function DokumenEdit({
  params,
}: {
  params: Promise<{ tenant: string; id: string }>;
}) {
  const { tenant: slug, id: docId } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/login");

  const { db, schema } = createTenantDb(slug);

  const [doc] = await db
    .select()
    .from(schema.documents)
    .where(eq(schema.documents.id, docId))
    .limit(1);

  if (!doc) notFound();

  // Ambil info file versi aktif untuk ditampilkan (read-only di form edit)
  const [currentVersion] = doc.currentVersionId
    ? await db
        .select({
          fileName: schema.documentVersions.fileName,
          mimeType: schema.documentVersions.mimeType,
        })
        .from(schema.documentVersions)
        .where(eq(schema.documentVersions.id, doc.currentVersionId))
        .limit(1)
    : [null];

  const categories = await db
    .select({
      id:       schema.documentCategories.id,
      name:     schema.documentCategories.name,
      parentId: schema.documentCategories.parentId,
    })
    .from(schema.documentCategories)
    .orderBy(schema.documentCategories.sortOrder, schema.documentCategories.name);

  return (
    <DokumenForm
      slug={slug}
      documentId={docId}
      categories={categories}
      initialData={{
        title:            doc.title,
        description:      doc.description ?? "",
        categoryId:       doc.categoryId ?? null,
        visibility:       doc.visibility as "internal" | "public",
        tags:             doc.tags ?? [],
        currentFileName:  currentVersion?.fileName ?? null,
        currentMimeType:  currentVersion?.mimeType ?? null,
      }}
    />
  );
}
