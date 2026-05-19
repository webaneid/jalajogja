import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { DokumenListClient, CreateDocumentButton } from "@/components/dokumen/dokumen-list-client";
import { FileText } from "lucide-react";

export default async function DokumenSemua({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/login");

  const { db, schema } = createTenantDb(slug);

  // Fetch dokumen + join versi aktif + join kategori
  const rows = await db
    .select({
      id:              schema.documents.id,
      title:           schema.documents.title,
      description:     schema.documents.description,
      visibility:      schema.documents.visibility,
      categoryId:      schema.documents.categoryId,
      categoryName:    schema.documentCategories.name,
      currentVersionId: schema.documents.currentVersionId,
      updatedAt:       schema.documents.updatedAt,
      // dari document_versions
      currentFileName: schema.documentVersions.fileName,
      currentMimeType: schema.documentVersions.mimeType,
      currentFileSize: schema.documentVersions.fileSize,
      versionNumber:   schema.documentVersions.versionNumber,
    })
    .from(schema.documents)
    .leftJoin(
      schema.documentCategories,
      eq(schema.documents.categoryId, schema.documentCategories.id),
    )
    .leftJoin(
      schema.documentVersions,
      eq(schema.documents.currentVersionId, schema.documentVersions.id),
    )
    .orderBy(schema.documents.updatedAt);

  const categories = await db
    .select({
      id:       schema.documentCategories.id,
      name:     schema.documentCategories.name,
      parentId: schema.documentCategories.parentId,
    })
    .from(schema.documentCategories)
    .orderBy(schema.documentCategories.sortOrder, schema.documentCategories.name);

  // Reverse untuk descending (updatedAt terbaru di atas)
  const documents = rows.reverse().map((r) => ({
    ...r,
    visibility: r.visibility as "internal" | "public",
  }));

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">Semua Dokumen</h1>
          <span className="text-sm text-muted-foreground">({documents.length})</span>
        </div>
        <CreateDocumentButton slug={slug} />
      </div>

      <DokumenListClient
        slug={slug}
        documents={documents}
        categories={categories}
      />
    </div>
  );
}
