import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { Plus } from "lucide-react";
import { LetterTypeManageClient } from "@/components/letters/letter-type-manage-client";
import { LetterTemplateList } from "@/components/letters/letter-template-list";

export default async function TemplatePage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/login");

  const { db: tenantDb, schema } = createTenantDb(slug);

  const letterTypes = await tenantDb
    .select()
    .from(schema.letterTypes)
    .orderBy(schema.letterTypes.sortOrder, schema.letterTypes.name);

  const templates = await tenantDb
    .select({
      id:       schema.letterTemplates.id,
      name:     schema.letterTemplates.name,
      type:     schema.letterTemplates.type,
      isActive: schema.letterTemplates.isActive,
      createdAt: schema.letterTemplates.createdAt,
    })
    .from(schema.letterTemplates)
    .orderBy(schema.letterTemplates.name);

  return (
    <div className="p-6 space-y-8">
      {/* Jenis Surat */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Jenis Surat</h2>
          <p className="text-sm text-muted-foreground">Kategori surat yang tersedia di form</p>
        </div>
        <LetterTypeManageClient
          slug={slug}
          initialTypes={letterTypes.map((t) => ({
            ...t,
            code:        t.code        ?? null,
            description: null,
          }))}
        />
      </div>

      {/* Template Konten Surat */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Template Surat</h2>
            <p className="text-sm text-muted-foreground">Template konten (perihal + isi) yang bisa dipilih saat buat surat</p>
          </div>
          <Link
            href={`/${slug}/letters/template/new`}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Template Baru
          </Link>
        </div>
        <LetterTemplateList
          slug={slug}
          templates={templates.map((t) => ({
            ...t,
            type: (t.type === "internal" ? "internal" : "outgoing") as "outgoing" | "internal",
          }))}
        />
      </div>
    </div>
  );
}
