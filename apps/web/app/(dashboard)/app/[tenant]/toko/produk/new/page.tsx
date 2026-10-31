import { listProducerIdsWithWarehouse } from "@/lib/producer-warehouse.server";
import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { ProductForm } from "@/components/toko/product-form";
import { listProducerOptions } from "@/lib/producer.server";
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

  // Opsi produsen aktif (id + nama saja) — hanya pengguna akses penuh. Pemuat ringan: tanpa kontak/alamat.
  let producerOptions: { value: string; label: string }[] | null = null;
  if (hasFullAccess(access.tenantUser, "toko")) {
    const opts = await listProducerOptions(createTenantDb(slug));
    producerOptions = opts.map((v) => ({
      value: v.id,
      label: `${v.name} (${v.kind === "member" ? `anggota · ${v.sourceType}` : "custom"})`,
    }));
  }

  // Produsen yang sudah punya gudang → kolom "Kota Asal" per produk disembunyikan (kota asal mengikuti gudang produsen).
  const producerIdsWithWarehouse = producerOptions ? await listProducerIdsWithWarehouse(createTenantDb(slug)) : [];

  return (
    <ProductForm
      slug={slug}
      tenantName={access.tenant.name}
      producerOptions={producerOptions}
      producerIdsWithWarehouse={producerIdsWithWarehouse}
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
