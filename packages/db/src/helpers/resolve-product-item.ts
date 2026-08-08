/**
 * resolveProductCartItem() — resolusi PASTI untuk `cart_items.itemId` bertipe "product".
 *
 * Root cause bug yang ditutup fungsi ini: `product-detail-client.tsx` mengirim
 * `itemId = isVariable ? activeVariation.id : product.id` — untuk produk BERVARIASI, itemId
 * yang tersimpan di cart adalah `product_variations.id`, BUKAN `products.id`. Sebelumnya
 * checkoutAction/previewVoucherAction query `WHERE products.id = itemId` langsung — untuk
 * variasi, query itu TIDAK PERNAH match (`prod` selalu undefined), sehingga:
 *   1. unitPrice/mitraId jatuh balik ke snapshot cart yang tidak divalidasi ulang (celah harga,
 *      sudah dicatat di docs/arsitektur-voucher.md § 10 poin 6 — "belum dieksekusi").
 *   2. mitraId SELALU resolve jadi null (default lokal) — voucher tidak pernah mengecualikan
 *      produk mitra untuk item yang sebenarnya variasi produk mitra (celah eksklusi mitra).
 *   3. Voucher yang menargetkan produk spesifik (VoucherTargetPicker HANYA memilih products.id,
 *      tidak pernah variasi) TIDAK PERNAH cocok untuk item bervariasi apa pun — "Voucher tidak
 *      berlaku untuk item di keranjang Anda" meski customer genuinely membeli produk yang
 *      ditarget. Lihat docs/arsitektur-voucher.md § 11 (audit lanjutan).
 *
 * Dipakai IDENTIK oleh checkoutAction DAN previewVoucherAction (apps/web/.../cart/actions.ts) —
 * staleness antara preview dan checkout sungguhan tidak boleh terjadi, jadi satu fungsi shared,
 * bukan duplikasi (beda dari pola "duplikasi demi isolasi" yang biasa dipakai project ini —
 * di sini korektnes butuh SATU sumber kebenaran, sama seperti voucher.ts sendiri).
 */

import { eq, and, type ExtractTablesWithRelations } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import type { TenantDb } from "../tenant-client";

type TenantTx = PgTransaction<
  PostgresJsQueryResultHKT,
  Record<string, unknown>,
  ExtractTablesWithRelations<Record<string, unknown>>
>;

type TenantDbOrTx = TenantDb["db"] | TenantTx;

export type ResolvedProductCartItem = {
  // ID PRODUK INDUK — dipakai untuk cocokkan voucher.targetItemIds (VoucherTargetPicker HANYA
  // pernah menyimpan products.id, tidak pernah variasi). BEDA dari cart_items.itemId asli, yang
  // tetap dipertahankan apa adanya (variasi) di invoice_items untuk keperluan fulfillment/SKU.
  productId: string;
  price:     number;   // harga EFEKTIF: variation.price kalau terisi, else harga produk induk
  mitraId:   string | null;
};

export async function resolveProductCartItem(
  db: TenantDbOrTx,
  schema: TenantDb["schema"],
  itemId: string,
): Promise<ResolvedProductCartItem | null> {
  // 1) Coba sebagai produk simple dulu — kasus paling umum.
  const [prod] = await db
    .select({ id: schema.products.id, price: schema.products.price, mitraId: schema.products.mitraId })
    .from(schema.products)
    .where(eq(schema.products.id, itemId))
    .limit(1);
  if (prod) {
    return { productId: prod.id, price: parseFloat(String(prod.price)), mitraId: prod.mitraId ?? null };
  }

  // 2) Fallback: itemId adalah product_variations.id — JOIN ke produk induk untuk mitraId +
  // fallback harga (pola COALESCE sama seperti resolveVariantPriceRanges di
  // lib/product-variation-price.server.ts).
  const [variation] = await db
    .select({
      productId:      schema.productVariations.productId,
      variationPrice: schema.productVariations.price,
      productPrice:   schema.products.price,
      mitraId:        schema.products.mitraId,
    })
    .from(schema.productVariations)
    .innerJoin(schema.products, eq(schema.products.id, schema.productVariations.productId))
    .where(and(
      eq(schema.productVariations.id, itemId),
      eq(schema.productVariations.isActive, true),
    ))
    .limit(1);
  if (!variation) return null;

  const price = variation.variationPrice != null
    ? parseFloat(String(variation.variationPrice))
    : parseFloat(String(variation.productPrice));

  return { productId: variation.productId, price, mitraId: variation.mitraId ?? null };
}
