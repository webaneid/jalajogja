import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect, notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ProductForm } from "@/components/toko/product-form";
import type { SeoValues } from "@/components/seo/seo-panel";
import type { ProductImage } from "@/app/(dashboard)/app/[tenant]/toko/actions";

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
  if (!access) redirect("/app/login");

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

  // Fetch variations jika variable product
  const existingVariations = product.productType === "variable"
    ? await db.select().from(schema.productVariations)
        .where(eq(schema.productVariations.productId, productId))
        .orderBy(schema.productVariations.createdAt)
    : [];

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
        publicPrice: product.publicPrice != null ? parseFloat(String(product.publicPrice)) : null,
        memberPrice: product.memberPrice != null ? parseFloat(String(product.memberPrice)) : null,
        stock:           product.stock,
        weightGram:      product.weightGram  ?? null,
        images,
        categoryId:      product.categoryId  ?? null,
        status:          product.status,
        productType:     (product.productType ?? "simple") as "simple" | "variable",
        attributeGroups: Array.isArray(product.attributeGroups) ? product.attributeGroups as import("@jalajogja/db").AttributeGroup[] : [],
        variations:      existingVariations.map(v => ({
          _key:           v.id,
          id:             v.id,
          sku:            v.sku ?? "",
          price:          String(v.price),
          publicPrice:    v.publicPrice != null ? String(v.publicPrice) : "",
          memberPrice:    v.memberPrice != null ? String(v.memberPrice) : "",
          stock:          String(v.stock),
          weightGram:     v.weightGram != null ? String(v.weightGram) : "",
          images:         Array.isArray(v.images) ? v.images as ProductImage[] : [],
          attributeCombo: (v.attributeCombo as Record<string, string>) ?? {},
          isActive:       v.isActive,
        })),
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
