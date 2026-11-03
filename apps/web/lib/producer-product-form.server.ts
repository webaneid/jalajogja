// Data bersama halaman Tambah/Ubah produk PRODUSEN yang memakai ProductForm bersama (mode produsen) — docs/arsitektur-produk-produsen.md § 15.
// Hanya membaca: kategori, gudang MILIK produsen (scope dari sesi), dan memetakan baris produk → initialData form.
import "server-only";
import { asc } from "drizzle-orm";
import { createTenantDb } from "@jalajogja/db";
import { listOrigins } from "@/lib/shipping-origins.server";
import { publicCityLabel } from "@/lib/city-label";
import type { ProductFormProps } from "@/components/toko/product-form";
import type { ProductImage } from "@/app/(dashboard)/app/[tenant]/toko/actions";

export async function loadProducerFormContext(slug: string, producerId: string) {
  const tc = createTenantDb(slug);
  const [categories, origins] = await Promise.all([
    tc.db.select({ id: tc.schema.productCategories.id, name: tc.schema.productCategories.name, slug: tc.schema.productCategories.slug })
      .from(tc.schema.productCategories).orderBy(asc(tc.schema.productCategories.name)),
    listOrigins(tc, { producerId }),
  ]);
  const originOptions: NonNullable<ProductFormProps["originOptions"]> = origins.map((o) => ({
    id: o.id, producerId: o.producerId, label: o.label, isDefault: o.isDefault, place: publicCityLabel(o.destination.label),
  }));
  return { tc, categories, originOptions };
}

const EMPTY_SEO = {
  metaTitle: "", metaDesc: "", focusKeyword: "", ogTitle: "", ogDescription: "", ogImageId: null, ogImageUrl: null,
  twitterCard: "summary_large_image", canonicalUrl: "", robots: "index,follow", schemaType: "Product", structuredData: "",
} as ProductFormProps["initialData"]["seo"];

/** initialData untuk produk BARU (status bawaan draft — K32). */
export function emptyProducerInitialData(producerId: string): ProductFormProps["initialData"] {
  return {
    name: "", productSlug: "", sku: "", description: "", price: 0, publicPrice: null, memberPrice: null, memberPriceTenantOnly: false,
    stock: 0, weightGram: null, originId: null, freeShippingMode: "none", freeShippingProvinces: [], freeShippingCities: [],
    pickupLocationName: null, pickupAddress: null, pickupMapsUrl: null, images: [], categoryId: null, producerId,
    status: "draft", productType: "simple", attributeGroups: [], variations: [], seo: EMPTY_SEO,
  };
}

type ProductRow = Awaited<ReturnType<typeof import("@/lib/producer-products.server")["requireOwnedProduct"]>>;
type VariationRow = { id: string; sku: string | null; price: unknown; publicPrice: unknown; memberPrice: unknown; stock: number; weightGram: number | null; images: unknown; attributeCombo: unknown; isActive: boolean };

/** initialData untuk produk yang sudah ada (milik produsen — pemanggil sudah memverifikasi lewat requireOwnedProduct). */
export function producerInitialData(product: NonNullable<ProductRow>, variations: VariationRow[]): ProductFormProps["initialData"] {
  const n = (v: unknown) => (v === null || v === undefined ? null : parseFloat(String(v)));
  const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));
  return {
    ...emptyProducerInitialData(product.producerId ?? ""),
    name: product.name, productSlug: product.slug, sku: product.sku ?? "", description: product.description ?? "",
    price: n(product.price) ?? 0, publicPrice: n(product.publicPrice), memberPrice: n(product.memberPrice),
    stock: product.stock, weightGram: product.weightGram ?? null, originId: product.originId ?? null,
    images: Array.isArray(product.images) ? (product.images as ProductImage[]) : [],
    categoryId: product.categoryId ?? null, status: product.status,
    seo: {
      ...EMPTY_SEO, metaTitle: product.metaTitle ?? "", metaDesc: product.metaDesc ?? "", focusKeyword: product.focusKeyword ?? "",
      ogTitle: product.ogTitle ?? "", ogDescription: product.ogDescription ?? "",
      twitterCard: product.twitterCard === "summary" ? "summary" : "summary_large_image",
    },
    productType: (product.productType ?? "simple") as "simple" | "variable",
    attributeGroups: Array.isArray(product.attributeGroups) ? (product.attributeGroups as import("@jalajogja/db").AttributeGroup[]) : [],
    variations: variations.map((v) => ({
      _key: v.id, id: v.id, sku: v.sku ?? "", price: s(v.price), publicPrice: s(v.publicPrice), memberPrice: s(v.memberPrice),
      stock: String(v.stock), weightGram: s(v.weightGram), images: Array.isArray(v.images) ? (v.images as ProductImage[]) : [],
      attributeCombo: (v.attributeCombo as Record<string, string>) ?? {}, isActive: v.isActive,
    })),
  };
}
