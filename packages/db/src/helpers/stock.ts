/**
 * Helper stok produk — SATU-SATUNYA tempat yang boleh baca/ubah `products.stock` /
 * `product_variations.stock` dari alur cart→invoice (checkout, konfirmasi bayar, reaktivasi
 * invoice dibatalkan). Lihat docs/arsitektur-stok.md untuk desain lengkap.
 *
 * Prinsip yang dikunci di dokumen itu:
 * - Stok FISIK (kolom `stock`) hanya berkurang saat invoice jadi `paid` — bukan saat checkout.
 * - "Stok tersedia" (dipakai validasi checkout + tampilan publik) = stok fisik dikurangi
 *   jumlah yang sedang "digantung" di invoice_items milik invoice yang masih pending
 *   (`pending`/`waiting_verification`/`partial`) — dihitung ulang tiap kali (computed), BUKAN
 *   kolom tersimpan, supaya tidak jadi kelas bug "reservasi drift" (persis pola bug kode-unik/
 *   voucher yang sudah 3x kejadian independen di project ini — lihat
 *   docs/arsitektur-voucher.md § 16-18).
 * - `itemId` untuk produk BISA berupa `products.id` (simple) ATAU `product_variations.id`
 *   (variasi) — sama seperti pola resolusi di `resolve-product-item.ts`, dicoba sebagai
 *   produk dulu, baru fallback ke variasi.
 *
 * Sengaja TIDAK dipakai oleh alur `orders` lama (`toko/actions.ts`
 * confirmOrderPaymentAction/cancelOrderAction) — itu sudah punya logic sendiri yang sudah
 * benar (validasi + decrement + restore), tidak disentuh untuk minimalkan risiko regresi di
 * kode yang sudah jalan. Helper ini KHUSUS alur invoice/cart yang sebelumnya nol logic stok
 * sama sekali.
 */

import { eq, and, inArray, ne, sql, type ExtractTablesWithRelations } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import type { TenantDb } from "../tenant-client";

type TenantTx = PgTransaction<
  PostgresJsQueryResultHKT,
  Record<string, unknown>,
  ExtractTablesWithRelations<Record<string, unknown>>
>;

type TenantDbOrTx = TenantDb["db"] | TenantTx;

export type StockLineItem = { itemId: string; quantity: number };

// ─── Baca stok fisik (tanpa lock) — dipakai untuk tampilan/hitung stok tersedia ───────────────

async function getPhysicalStock(
  db: TenantDbOrTx,
  schema: TenantDb["schema"],
  itemId: string,
): Promise<number | null> {
  const [prod] = await db
    .select({ stock: schema.products.stock })
    .from(schema.products)
    .where(eq(schema.products.id, itemId))
    .limit(1);
  if (prod) return prod.stock;

  const [variation] = await db
    .select({ stock: schema.productVariations.stock })
    .from(schema.productVariations)
    .where(eq(schema.productVariations.id, itemId))
    .limit(1);
  if (variation) return variation.stock;

  return null; // itemId bukan produk maupun variasi yang dikenal
}

// ─── Jumlah yang sedang "digantung" invoice pending lain ──────────────────────────────────────

async function getReservedQuantity(
  db: TenantDbOrTx,
  schema: TenantDb["schema"],
  itemId: string,
  excludeInvoiceId?: string,
): Promise<number> {
  const rows = await db
    .select({ quantity: schema.invoiceItems.quantity })
    .from(schema.invoiceItems)
    .innerJoin(schema.invoices, eq(schema.invoices.id, schema.invoiceItems.invoiceId))
    .where(and(
      eq(schema.invoiceItems.itemId, itemId),
      eq(schema.invoiceItems.itemType, "product"),
      inArray(schema.invoices.status, ["pending", "waiting_verification", "partial"]),
      excludeInvoiceId ? ne(schema.invoices.id, excludeInvoiceId) : undefined,
    ));

  return rows.reduce((sum, r) => sum + r.quantity, 0);
}

/**
 * Stok tersedia untuk publik/validasi = stok fisik − reservasi invoice pending lain.
 * Return `null` kalau `itemId` bukan produk/variasi yang dikenal (item sudah dihapus, dll).
 */
export async function getAvailableStock(
  db: TenantDbOrTx,
  schema: TenantDb["schema"],
  itemId: string,
  opts?: { excludeInvoiceId?: string },
): Promise<number | null> {
  const physical = await getPhysicalStock(db, schema, itemId);
  if (physical === null) return null;

  const reserved = await getReservedQuantity(db, schema, itemId, opts?.excludeInvoiceId);
  return Math.max(0, physical - reserved);
}

/**
 * Validasi checkout — dipanggil DI DALAM transaction checkout, SEBELUM invoice dibuat. Mengunci
 * baris produk/variasi (`FOR UPDATE`) supaya checkout paralel untuk stok yang sama serial,
 * bukan race. Ini pencegahan proaktif di titik pertama customer commit ke suatu quantity — bukan
 * jaminan mutlak (2 checkout hampir bersamaan tetap bisa sama-sama lolos kalau stoknya cukup
 * buat masing-masing sendiri tapi tidak buat keduanya sekaligus; itu wajar, ditutup oleh
 * notifikasi "stok habis" via cron — lihat docs/arsitektur-stok.md).
 */
export async function checkStockAvailability(
  tx: TenantTx,
  schema: TenantDb["schema"],
  items: StockLineItem[],
): Promise<{ ok: true } | { ok: false; itemId: string; available: number; requested: number }> {
  for (const item of items) {
    // Lock baris produk ATAU variasi — coba produk dulu (pola sama resolve-product-item.ts).
    // Sintaks FOR UPDATE sama persis dengan lock cart di checkoutAction (cart/actions.ts).
    const [lockedProduct] = await tx
      .select({ stock: schema.products.stock })
      .from(schema.products)
      .where(sql`${schema.products.id} = ${item.itemId} FOR UPDATE`)
      .limit(1);

    let physicalStock: number | null = null;
    if (lockedProduct) {
      physicalStock = lockedProduct.stock;
    } else {
      const [lockedVariation] = await tx
        .select({ stock: schema.productVariations.stock })
        .from(schema.productVariations)
        .where(sql`${schema.productVariations.id} = ${item.itemId} FOR UPDATE`)
        .limit(1);
      if (lockedVariation) physicalStock = lockedVariation.stock;
    }

    if (physicalStock === null) continue; // itemId tidak dikenal — bukan tanggung jawab helper ini

    const reserved  = await getReservedQuantity(tx, schema, item.itemId);
    const available = Math.max(0, physicalStock - reserved);
    if (item.quantity > available) {
      return { ok: false, itemId: item.itemId, available, requested: item.quantity };
    }
  }
  return { ok: true };
}

/**
 * Kurangi stok fisik saat invoice jadi `paid` — dipanggil dari SEMUA titik transisi status
 * invoice ke "paid" di alur invoice (confirmInvoicePaymentAction, verifySubmittedPaymentAction,
 * confirmCodPaymentAction, createInvoiceAction saat langsung lunas, applyVoucherToInvoiceAction
 * saat diskon 100%, checkoutAction saat voucher 100%/Rp 0). Clamp ke 0 (GREATEST), TIDAK PERNAH
 * menolak transisi paid itu sendiri — validasi/penolakan sudah terjadi di titik checkout
 * (`checkStockAvailability`) dan reaktivasi invoice batal (`checkStockAvailability` juga). Admin
 * yang secara eksplisit mengonfirmasi bayar (COD, invoice manual, dst) tetap final authority,
 * tidak diblokir mekanisme ini.
 */
export async function decrementStockForInvoiceItems(
  tx: TenantTx,
  schema: TenantDb["schema"],
  items: StockLineItem[],
): Promise<void> {
  for (const item of items) {
    const updatedProduct = await tx
      .update(schema.products)
      .set({ stock: sql`GREATEST(${schema.products.stock} - ${item.quantity}, 0)` })
      .where(eq(schema.products.id, item.itemId))
      .returning({ id: schema.products.id });

    if (updatedProduct.length === 0) {
      await tx
        .update(schema.productVariations)
        .set({ stock: sql`GREATEST(${schema.productVariations.stock} - ${item.quantity}, 0)` })
        .where(eq(schema.productVariations.id, item.itemId));
    }
  }
}

/** Kebalikan decrementStockForInvoiceItems — dipakai saat invoice yang SUDAH paid dibatalkan. */
export async function restoreStockForInvoiceItems(
  tx: TenantTx,
  schema: TenantDb["schema"],
  items: StockLineItem[],
): Promise<void> {
  for (const item of items) {
    const updatedProduct = await tx
      .update(schema.products)
      .set({ stock: sql`${schema.products.stock} + ${item.quantity}` })
      .where(eq(schema.products.id, item.itemId))
      .returning({ id: schema.products.id });

    if (updatedProduct.length === 0) {
      await tx
        .update(schema.productVariations)
        .set({ stock: sql`${schema.productVariations.stock} + ${item.quantity}` })
        .where(eq(schema.productVariations.id, item.itemId));
    }
  }
}

/** Ambil item produk (itemType='product') dari sebuah invoice — dipakai pemanggil di atas. */
export async function getProductInvoiceItems(
  db: TenantDbOrTx,
  schema: TenantDb["schema"],
  invoiceId: string,
): Promise<StockLineItem[]> {
  const rows = await db
    .select({ itemId: schema.invoiceItems.itemId, quantity: schema.invoiceItems.quantity })
    .from(schema.invoiceItems)
    .where(and(
      eq(schema.invoiceItems.invoiceId, invoiceId),
      eq(schema.invoiceItems.itemType, "product"),
    ));

  return rows
    .filter((r): r is { itemId: string; quantity: number } => r.itemId !== null);
}
