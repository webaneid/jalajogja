import { createTenantDb } from "@jalajogja/db";
import { eq } from "drizzle-orm";
import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { ProductForm } from "@/components/toko/product-form";
import { resolveProducers } from "@/lib/producer.server";
import { hasFullAccess } from "@/lib/permissions";
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
  if (!access) redirect("/app/login");

  const { db, schema } = createTenantDb(slug);

  const categories = await db
    .select({
      id:   schema.productCategories.id,
      name: schema.productCategories.name,
      slug: schema.productCategories.slug,
    })
    .from(schema.productCategories)
    .orderBy(schema.productCategories.name);

  // Opsi produsen aktif (id + nama saja) — hanya pengguna akses penuh
  let producerOptions: { value: string; label: string }[] | null = null;
  if (hasFullAccess(access.tenantUser, "toko")) {
    const prodRows = await db.select({ id: schema.producers.id }).from(schema.producers).where(eq(schema.producers.isActive, true));
    const views = await resolveProducers(createTenantDb(slug), { id: access.tenant.id, name: access.tenant.name, tenantType: access.tenant.tenantType }, prodRows.map((r) => r.id));
    producerOptions = [...views.values()].map((v) => ({
      value: v.id as string,
      label: `${v.name} (${v.kind === "member" ? `anggota · ${v.sourceType}` : "custom"})`,
    }));
  }

  return (
    <ProductForm
      slug={slug}
      tenantName={access.tenant.name}
      producerOptions={producerOptions}
      productId={null}
      initialData={{
        name:        "",
        productSlug: "",
        sku:         "",
        description: "",
        price:           0,
        publicPrice:     null,
        memberPrice:     null,
        memberPriceTenantOnly: false,
        stock:           0,
        weightGram:      null,
        originCityId:    null,
        originCityName:  null,
        freeShippingMode:      "none",
        freeShippingProvinces: [],
        freeShippingCities:    [],
        pickupLocationName: null,
        pickupAddress:      null,
        pickupMapsUrl:      null,
        productType:     "simple",
        attributeGroups: [],
        variations:      [],
        images:      [],
        categoryId:  null,
        producerId:      null,
        status:      "draft",
        seo:         DEFAULT_SEO,
      }}
      categories={categories}
    />
  );
}
