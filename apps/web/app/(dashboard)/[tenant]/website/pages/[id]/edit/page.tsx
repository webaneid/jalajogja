import { eq } from "drizzle-orm";
import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { notFound, redirect } from "next/navigation";
import { PageForm } from "@/components/website/page-form";
import type { SeoValues } from "@/components/seo/seo-panel";

export default async function EditPagePage({
  params,
}: {
  params: Promise<{ tenant: string; id: string }>;
}) {
  const { tenant: slug, id: pageId } = await params;

  const access = await getTenantAccess(slug);
  if (!access) redirect(`/login`);

  const { db, schema } = createTenantDb(slug);

  const [page] = await db
    .select()
    .from(schema.pages)
    .where(eq(schema.pages.id, pageId))
    .limit(1);

  if (!page) notFound();

  const seoValues: SeoValues = {
    metaTitle:      page.metaTitle      ?? "",
    metaDesc:       page.metaDesc       ?? "",
    ogTitle:        page.ogTitle        ?? "",
    ogDescription:  page.ogDescription  ?? "",
    ogImageId:      page.ogImageId      ?? null,
    ogImageUrl:     null,
    twitterCard:    page.twitterCard    ?? "summary",
    focusKeyword:   page.focusKeyword   ?? "",
    canonicalUrl:   page.canonicalUrl   ?? "",
    robots:         page.robots         ?? "index,follow",
    schemaType:     page.schemaType     ?? "WebPage",
    structuredData: page.structuredData
      ? JSON.stringify(page.structuredData, null, 2)
      : "",
  };

  return (
    <div className="h-full flex flex-col">
      <PageForm
        slug={slug}
        pageId={pageId}
        initialData={{
          title:    page.title,
          pageSlug: page.slug,
          content:  page.content,
          template: page.template,
          status:   page.status,
          order:    page.order,
          coverId:  page.coverId,
          seo:      seoValues,
        }}
      />
    </div>
  );
}
