import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect, notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { LetterTemplateForm } from "@/components/letters/letter-template-form";

export default async function TemplateEditPage({
  params,
}: {
  params: Promise<{ tenant: string; id: string }>;
}) {
  const { tenant: slug, id: templateId } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/login");

  const { db: tenantDb, schema } = createTenantDb(slug);

  const [template] = await tenantDb
    .select({
      id:       schema.letterTemplates.id,
      name:     schema.letterTemplates.name,
      type:     schema.letterTemplates.type,
      subject:  schema.letterTemplates.subject,
      body:     schema.letterTemplates.body,
      isActive: schema.letterTemplates.isActive,
    })
    .from(schema.letterTemplates)
    .where(eq(schema.letterTemplates.id, templateId))
    .limit(1);

  if (!template) notFound();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/${slug}/letters/template`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Template
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-semibold">Edit Template</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{template.name}</p>
      </div>

      <LetterTemplateForm
        slug={slug}
        templateId={templateId}
        defaultValues={{
          name:     template.name,
          type:     (template.type ?? "outgoing") as "outgoing" | "internal",
          subject:  template.subject ?? "",
          body:     template.body ?? "",
          isActive: template.isActive,
        }}
      />
    </div>
  );
}
