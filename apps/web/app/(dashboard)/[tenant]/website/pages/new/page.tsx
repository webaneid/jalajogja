import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { PageForm } from "@/components/website/page-form";
import type { SeoValues } from "@/components/seo/seo-panel";

const DEFAULT_SEO: SeoValues = {
  metaTitle:      "",
  metaDesc:       "",
  focusKeyword:   "",
  ogTitle:        "",
  ogDescription:  "",
  ogImageId:      null,
  ogImageUrl:     null,
  twitterCard:    "summary",
  canonicalUrl:   "",
  robots:         "index,follow",
  schemaType:     "WebPage",
  structuredData: "",
};

export default async function PagesNewPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/login");

  return (
    <PageForm
      slug={slug}
      pageId={null}
      initialData={{
        title:    "",
        pageSlug: "",
        content:  null,
        coverId:  null,
        status:   "draft",
        order:    0,
        seo:      DEFAULT_SEO,
      }}
    />
  );
}
