import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { ProductForm } from "@/components/toko/product-form";
import type { SeoValues } from "@/components/seo/seo-panel";

const DEFAULT_SEO: SeoValues = {
  metaTitle:      "",
  metaDesc:       "",
  focusKeyword:   "",
  ogTitle:        "",
  ogDescription:  "",
  ogImageId:      null,
  ogImageUrl:     null,
  twitterCard:    "summary_large_image",
  canonicalUrl:   "",
  robots:         "index,follow",
  schemaType:     "Product",
  structuredData: "",
};

export default async function ProdukNewPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/login");

  const { db, schema } = createTenantDb(slug);

  const categories = await db
    .select({
      id:   schema.productCategories.id,
      name: schema.productCategories.name,
      slug: schema.productCategories.slug,
    })
    .from(schema.productCategories)
    .orderBy(schema.productCategories.name);

  return (
    <ProductForm
      slug={slug}
      productId={null}
      initialData={{
        name:        "",
        productSlug: "",
        sku:         "",
        description: "",
        price:       0,
        stock:       0,
        images:      [],
        categoryId:  null,
        status:      "draft",
        seo:         DEFAULT_SEO,
      }}
      categories={categories}
    />
  );
}
