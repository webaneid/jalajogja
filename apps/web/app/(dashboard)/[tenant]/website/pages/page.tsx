import { asc, inArray } from "drizzle-orm";
import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { CreatePageButton, PagesTable, SingletonPageCards } from "@/components/website/page-list-client";

export default async function PagesListPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;

  const access = await getTenantAccess(slug);
  if (!access) redirect(`/login`);

  const { db, schema } = createTenantDb(slug);

  const allPages = await db
    .select({
      id:          schema.pages.id,
      title:       schema.pages.title,
      slug:        schema.pages.slug,
      status:      schema.pages.status,
      template:    schema.pages.template,
      order:       schema.pages.order,
      publishedAt: schema.pages.publishedAt,
      updatedAt:   schema.pages.updatedAt,
    })
    .from(schema.pages)
    .orderBy(asc(schema.pages.order), asc(schema.pages.title));

  // Pisahkan singleton pages dari halaman biasa
  const singletonTemplates = ["terms", "privacy"] as const;
  const singletonPages = allPages.filter(p => (singletonTemplates as readonly string[]).includes(p.template));
  const regularPages   = allPages.filter(p => !(singletonTemplates as readonly string[]).includes(p.template));

  const existingTerms   = singletonPages.find(p => p.template === "terms");
  const existingPrivacy = singletonPages.find(p => p.template === "privacy");

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Halaman</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Halaman statis — Tentang Kami, Kontak, FAQ, dll
          </p>
        </div>
        <CreatePageButton slug={slug} />
      </div>

      {/* Singleton pages — Syarat & Ketentuan + Kebijakan Privasi */}
      <SingletonPageCards
        slug={slug}
        existingTerms={existingTerms ? { id: existingTerms.id, status: existingTerms.status } : null}
        existingPrivacy={existingPrivacy ? { id: existingPrivacy.id, status: existingPrivacy.status } : null}
      />

      <PagesTable pages={regularPages} slug={slug} />
    </div>
  );
}
