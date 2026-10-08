// Resolusi harga EFEKTIF variasi produk — variation.price kosong (null) berarti "pakai harga
// produk induk" (lihat docs/arsitektur-billing.md § "Fallback Harga/Berat/SKU per Variasi").
// Satu helper server-only dipakai di 4 titik yang sebelumnya masing-masing punya query
// MIN(price)/MAX(price) mentah — SQL polos itu SALAH begitu ada variasi ber-price NULL:
// agregat langsung mengabaikan baris NULL, padahal baris itu efektif punya harga = harga
// produk. WAJIB COALESCE(variation.price, product.price) dulu sebelum MIN/MAX.
import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { mergeVariationPrices, resolveSellingPrice, type TenantDb, type ViewerTier } from "@jalajogja/db";

export type PriceRange = { min: string; max: string };

// Rentang harga JUAL variasi aktif per produk, untuk pembeli (`viewer`) ini. Tiap variasi:
// Harga Dasar/Publik/Anggota-nya ikut produk induk kalau kosong (mergeVariationPrices), lalu
// diresolve dengan aturan yang SAMA dengan checkout (resolveSellingPrice). Dihitung di JS, bukan
// SQL min/max mentah — SQL polos mengabaikan baris NULL dan tidak tahu aturan tier/anggota.
export async function resolveVariantPriceRanges(
  tenantClient: TenantDb,
  productIds:   string[],
  viewer:       ViewerTier = "public",
): Promise<Map<string, PriceRange>> {
  const map = new Map<string, PriceRange>();
  if (productIds.length === 0) return map;

  const { db: tenantDb, schema } = tenantClient;

  const rows = await tenantDb
    .select({
      productId:     schema.productVariations.productId,
      vPrice:        schema.productVariations.price,
      vPublicPrice:  schema.productVariations.publicPrice,
      vMemberPrice:  schema.productVariations.memberPrice,
      pPrice:        schema.products.price,
      pPublicPrice:  schema.products.publicPrice,
      pMemberPrice:  schema.products.memberPrice,
      tenantOnly:    schema.products.memberPriceTenantOnly,
    })
    .from(schema.productVariations)
    .innerJoin(schema.products, eq(schema.products.id, schema.productVariations.productId))
    .where(and(
      inArray(schema.productVariations.productId, productIds),
      eq(schema.productVariations.isActive, true),
    ));

  const acc = new Map<string, { min: number; max: number }>();
  for (const r of rows) {
    const merged = mergeVariationPrices(
      { price: r.pPrice, publicPrice: r.pPublicPrice, memberPrice: r.pMemberPrice },
      { price: r.vPrice, publicPrice: r.vPublicPrice, memberPrice: r.vMemberPrice },
    );
    const price = resolveSellingPrice(merged, viewer, r.tenantOnly);
    const cur   = acc.get(r.productId);
    acc.set(r.productId, cur ? { min: Math.min(cur.min, price), max: Math.max(cur.max, price) } : { min: price, max: price });
  }
  for (const [id, v] of acc) map.set(id, { min: String(v.min), max: String(v.max) });
  return map;
}
