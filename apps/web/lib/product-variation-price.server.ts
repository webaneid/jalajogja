// Resolusi harga EFEKTIF variasi produk — variation.price kosong (null) berarti "pakai harga
// produk induk" (lihat docs/arsitektur-billing.md § "Fallback Harga/Berat/SKU per Variasi").
// Satu helper server-only dipakai di 4 titik yang sebelumnya masing-masing punya query
// MIN(price)/MAX(price) mentah — SQL polos itu SALAH begitu ada variasi ber-price NULL:
// agregat langsung mengabaikan baris NULL, padahal baris itu efektif punya harga = harga
// produk. WAJIB COALESCE(variation.price, product.price) dulu sebelum MIN/MAX.
import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { TenantDb } from "@jalajogja/db";

export type PriceRange = { min: string; max: string };

export async function resolveVariantPriceRanges(
  tenantClient: TenantDb,
  productIds:   string[],
): Promise<Map<string, PriceRange>> {
  const map = new Map<string, PriceRange>();
  if (productIds.length === 0) return map;

  const { db: tenantDb, schema } = tenantClient;

  const rows = await tenantDb
    .select({
      productId: schema.productVariations.productId,
      minPrice:  sql<string | null>`min(coalesce(${schema.productVariations.price}, ${schema.products.price}))`,
      maxPrice:  sql<string | null>`max(coalesce(${schema.productVariations.price}, ${schema.products.price}))`,
    })
    .from(schema.productVariations)
    .innerJoin(schema.products, eq(schema.products.id, schema.productVariations.productId))
    .where(and(
      inArray(schema.productVariations.productId, productIds),
      eq(schema.productVariations.isActive, true),
    ))
    .groupBy(schema.productVariations.productId);

  for (const r of rows) {
    if (r.minPrice != null && r.maxPrice != null) {
      map.set(r.productId, { min: r.minPrice, max: r.maxPrice });
    }
  }
  return map;
}
