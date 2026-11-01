import { listAllOrigins } from "@/lib/shipping-origins.server";
import { publicCityLabel } from "@/lib/city-label";
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
  // Asal kirim (semua pemilik) — form menyaring ke pemilik produk. Label wilayah AMAN (kota, provinsi) saja.
  const originOptions = (await listAllOrigins(createTenantDb(slug))).map((o) => ({
    id: o.id, producerId: o.producerId, label: o.label, isDefault: o.isDefault, place: publicCityLabel(o.destination.label),
  }));

  return (
    <ProductForm
      slug={slug}
      tenantName={access.tenant.name}
      producerOptions={producerOptions}
      originOptions={originOptions}
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
        originId:        null,
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
