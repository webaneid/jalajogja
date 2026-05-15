import { eq } from "drizzle-orm";
import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { notFound, redirect } from "next/navigation";
import { PageForm } from "@/components/website/page-form";
import type { SeoValues } from "@/components/seo/seo-panel";
import { publicUrl } from "@/lib/minio";

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

  // Fetch cover URL jika ada
  let coverUrl: string | null = null;
  if (page.coverId) {
    const [media] = await db
      .select({ path: schema.media.path, variants: schema.media.variants })
      .from(schema.media)
      .where(eq(schema.media.id, page.coverId))
      .limit(1);
    if (media) {
      const vv = media.variants as Record<string, string> | null;
      coverUrl = vv?.thumbnail ?? vv?.large ?? publicUrl(slug, media.path);
    }
  }

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
          coverUrl: coverUrl,
          seo:      seoValues,
        }}
      />
    </div>
  );
}
