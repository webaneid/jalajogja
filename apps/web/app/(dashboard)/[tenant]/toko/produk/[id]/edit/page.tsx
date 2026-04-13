import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect, notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ProductForm } from "@/components/toko/product-form";
import type { SeoValues } from "@/components/seo/seo-panel";
import type { ProductImage } from "@/app/(dashboard)/[tenant]/toko/actions";

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

export default async function ProductEditPage({
  params,
}: {
  params: Promise<{ tenant: string; id: string }>;
}) {
  const { tenant: slug, id: productId } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/login");

  const { db, schema } = createTenantDb(slug);

  const [product] = await db
    .select()
    .from(schema.products)
    .where(eq(schema.products.id, productId))
    .limit(1);

  if (!product) notFound();

  const categories = await db
    .select({
      id:   schema.productCategories.id,
      name: schema.productCategories.name,
      slug: schema.productCategories.slug,
    })
    .from(schema.productCategories)
    .orderBy(schema.productCategories.name);

  // Ambil URL OG image jika ada
  let ogImageUrl: string | null = null;
  if (product.ogImageId) {
    const [media] = await db
      .select({ url: schema.media.path })
      .from(schema.media)
      .where(eq(schema.media.id, product.ogImageId))
      .limit(1);
    ogImageUrl = media?.url ?? null;
  }

  const images = Array.isArray(product.images)
    ? (product.images as ProductImage[])
    : [];

  return (
    <ProductForm
      slug={slug}
      productId={productId}
      initialData={{
        name:        product.name,
        productSlug: product.slug,
        sku:         product.sku       ?? "",
        description: product.description ?? "",
        price:       parseFloat(String(product.price)),
        stock:       product.stock,
        images,
        categoryId:  product.categoryId ?? null,
        status:      product.status,
        seo: {
          ...DEFAULT_SEO,
          metaTitle:     product.metaTitle     ?? "",
          metaDesc:      product.metaDesc      ?? "",
          ogTitle:       product.ogTitle       ?? "",
          ogDescription: product.ogDescription ?? "",
          ogImageId:     product.ogImageId     ?? null,
          ogImageUrl,
          twitterCard:   product.twitterCard   ?? "summary_large_image",
          focusKeyword:  product.focusKeyword  ?? "",
          canonicalUrl:  product.canonicalUrl  ?? "",
          robots:        (product.robots       ?? "index,follow") as SeoValues["robots"],
          schemaType:    product.schemaType    ?? "Product",
        },
      }}
      categories={categories}
    />
  );
}
