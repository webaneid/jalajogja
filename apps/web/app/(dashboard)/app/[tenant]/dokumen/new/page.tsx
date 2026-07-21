import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { DokumenForm } from "@/components/dokumen/dokumen-form";

export default async function DokumenNew({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/app/login");

  const { db, schema } = createTenantDb(slug);

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
      documentId={null}
      categories={categories}
      initialData={{
        title:       "",
        description: "",
        categoryId:  null,
        visibility:  "internal",
        tags:        [],
        seo: {
          metaTitle: "", metaDesc: "", focusKeyword: "", ogTitle: "", ogDescription: "",
          ogImageId: null, ogImageUrl: null, twitterCard: "summary_large_image",
          canonicalUrl: "", robots: "index,follow", schemaType: "WebPage", structuredData: "",
        },
      }}
    />
  );
}
