import { asc } from "drizzle-orm";
import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { CreatePageButton, PagesTable } from "@/components/website/page-list-client";

export default async function PagesListPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;

  const access = await getTenantAccess(slug);
  if (!access) redirect(`/login`);

  const { db, schema } = createTenantDb(slug);

  // Pages diurutkan berdasarkan order (urutan di navigasi), lalu title
  const pages = await db
    .select({
      id:          schema.pages.id,
      title:       schema.pages.title,
      slug:        schema.pages.slug,
      status:      schema.pages.status,
      order:       schema.pages.order,
      publishedAt: schema.pages.publishedAt,
      updatedAt:   schema.pages.updatedAt,
    })
    .from(schema.pages)
    .orderBy(asc(schema.pages.order), asc(schema.pages.title));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Halaman</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Halaman statis — Tentang Kami, Kontak, FAQ, dll
          </p>
        </div>
        <CreatePageButton slug={slug} />
      </div>

      <PagesTable pages={pages} slug={slug} />
    </div>
  );
}
