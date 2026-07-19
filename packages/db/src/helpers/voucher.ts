/**
 * voucher.ts — Diskon & Voucher (Fase 1: berkode, target tenant-only).
 *
 * Lihat docs/arsitektur-voucher.md untuk arsitektur lengkap. Prinsip kunci:
 * - Diskon memotong harga PER ITEM (invoice_items.total), TIDAK PERNAH invoice keseluruhan.
 * - Resolver di sini TIDAK melakukan resolusi harga sendiri — dipanggil SETELAH unitPrice
 *   final sudah di-resolve oleh checkoutAction (produk/tiket di-re-fetch dari DB di sana).
 * - Dipecah jadi 3 fungsi kecil (bukan satu fungsi monolitik) supaya bisa dipakai baik untuk
 *   preview (cart page, baca saja, tanpa lock) maupun checkout sungguhan (dengan lock, di
 *   dalam transaction) tanpa duplikasi logic validasi/perhitungan.
 */

import { eq, and, or, sql, type ExtractTablesWithRelations } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import type { TenantDb } from "../tenant-client";

type TenantTx = PgTransaction<
  PostgresJsQueryResultHKT,
  Record<string, unknown>,
  ExtractTablesWithRelations<Record<string, unknown>>
>;

// db biasa ATAU tx — kedua tipe punya .select() dengan shape yang sama untuk keperluan di sini.
type TenantDbOrTx = TenantDb["db"] | TenantTx;

export type ResolvedCartItemForVoucher = {
  itemType:  string;
  itemId:    string | null;
  unitPrice: number;
  quantity:  number;
  mitraId:   string | null; // null = milik tenant, terisi = milik mitra (dikecualikan Fase 1)
};

export type VoucherRow = {
  id:                     string;
  code:                   string;
  name:                   string;
  discountType:           "percentage" | "fixed";
  discountValue:          number;
  targetType:             "product" | "ticket" | "donation";
  targetItemIds:          string[];
  usageLimit:             number | null;
  usageLimitPerCustomer:  number | null;
  usedCount:              number;
  restrictPhone:          string | null;
  restrictEmail:          string | null;
  validFrom:              Date | null;
  validUntil:             Date | null;
  isActive:               boolean;
};

export type VoucherApplicationResult = {
  voucher:         VoucherRow;
  perItemDiscount: Map<number, number>; // index di resolvedItems -> nominal potongan
  totalDiscount:   number;
};

// ─── findVoucherByCode ────────────────────────────────────────────────────────
// Cari voucher berdasar kode (case-insensitive — selalu dibandingkan UPPERCASE).
// `forUpdate=true` WAJIB dipakai di dalam transaction checkout sungguhan (kunci row supaya
// dua checkout bersamaan tidak sama-sama lolos cek usageLimit) — TIDAK dipakai untuk preview
// (preview boleh sedikit stale, checkout tetap re-validasi dari nol di dalam transaction-nya).

export async function findVoucherByCode(
  db: TenantDbOrTx,
  schema: TenantDb["schema"],
  code: string,
  forUpdate = false,
): Promise<VoucherRow | null> {
  const normalizedCode = code.trim().toUpperCase();
  if (!normalizedCode) return null;

  const rows = forUpdate
    ? await db.select().from(schema.vouchers)
        .where(eq(schema.vouchers.code, normalizedCode)).for("update").limit(1)
    : await db.select().from(schema.vouchers)
        .where(eq(schema.vouchers.code, normalizedCode)).limit(1);
  const [row] = rows;

  if (!row) return null;
  return {
    id:                    row.id,
    code:                  row.code,
    name:                  row.name,
    discountType:          row.discountType,
    discountValue:         parseFloat(String(row.discountValue)),
    targetType:            row.targetType,
    targetItemIds:         (row.targetItemIds as string[]) ?? [],
    usageLimit:            row.usageLimit,
    usageLimitPerCustomer: row.usageLimitPerCustomer,
    usedCount:             row.usedCount,
    restrictPhone:         row.restrictPhone,
    restrictEmail:         row.restrictEmail,
    validFrom:             row.validFrom,
    validUntil:            row.validUntil,
    isActive:              row.isActive,
  };
}

// ─── countCustomerRedemptions ─────────────────────────────────────────────────
// Berapa kali voucher ini SUDAH dipakai oleh nomor HP/email tertentu (redemption yang batal
// via cancelInvoiceAction TIDAK dihitung — cancelledAt IS NULL).

export async function countCustomerRedemptions(
  db: TenantDbOrTx,
  schema: TenantDb["schema"],
  voucherId: string,
  customer: { phone: string | null; email: string | null },
): Promise<number> {
  if (!customer.phone && !customer.email) return 0;

  const identityConditions = [
    customer.phone ? eq(schema.voucherRedemptions.customerPhone, customer.phone) : null,
    customer.email ? eq(schema.voucherRedemptions.customerEmail, customer.email) : null,
  ].filter((c): c is NonNullable<typeof c> => c !== null);

  const [{ cnt }] = await db
    .select({ cnt: sql<number>`count(*)` })
    .from(schema.voucherRedemptions)
    .where(and(
      eq(schema.voucherRedemptions.voucherId, voucherId),
      sql`${schema.voucherRedemptions.cancelledAt} IS NULL`,
      or(...identityConditions),
    ));

  return Number(cnt);
}

// ─── computeVoucherDiscount ───────────────────────────────────────────────────
// Fungsi PURE (tidak akses DB) — diberi voucher row + jumlah pemakaian existing customer ini,
// hitung diskon per item. Dipanggil sama persis oleh preview maupun checkout sungguhan.

export function computeVoucherDiscount(
  voucher: VoucherRow,
  customer: { phone: string | null; email: string | null },
  existingCustomerRedemptions: number,
  resolvedItems: ResolvedCartItemForVoucher[],
): VoucherApplicationResult | { error: string } {
  if (!voucher.isActive) return { error: "Voucher tidak aktif." };

  const now = new Date();
  if (voucher.validFrom && now < voucher.validFrom) return { error: "Voucher belum berlaku." };
  if (voucher.validUntil && now > voucher.validUntil) return { error: "Voucher sudah kadaluarsa." };

  if (voucher.usageLimit !== null && voucher.usedCount >= voucher.usageLimit) {
    return { error: "Voucher sudah mencapai batas penggunaan." };
  }

  if (voucher.restrictPhone && voucher.restrictPhone !== customer.phone) {
    return { error: "Voucher ini hanya berlaku untuk nomor HP tertentu." };
  }
  if (voucher.restrictEmail && voucher.restrictEmail !== customer.email) {
    return { error: "Voucher ini hanya berlaku untuk email tertentu." };
  }

  if (
    voucher.usageLimitPerCustomer !== null &&
    existingCustomerRedemptions >= voucher.usageLimitPerCustomer
  ) {
    return { error: "Anda sudah mencapai batas pemakaian voucher ini." };
  }

  const perItemDiscount = new Map<number, number>();
  let totalDiscount = 0;

  resolvedItems.forEach((item, index) => {
    if (item.itemType !== voucher.targetType) return;
    if (item.mitraId) return; // produk mitra dikecualikan Fase 1 — lihat docs/arsitektur-voucher.md
    if (voucher.targetItemIds.length > 0 && !item.itemId) return;
    if (voucher.targetItemIds.length > 0 && item.itemId && !voucher.targetItemIds.includes(item.itemId)) return;

    const lineTotal = item.unitPrice * item.quantity;
    const rawDiscount = voucher.discountType === "percentage"
      ? lineTotal * (voucher.discountValue / 100)
      : voucher.discountValue;
    const discount = Math.min(lineTotal, Math.max(0, rawDiscount)); // clamp: tidak minus, tidak melebihi harga baris

    if (discount > 0) {
      perItemDiscount.set(index, discount);
      totalDiscount += discount;
    }
  });

  if (perItemDiscount.size === 0) {
    return { error: "Voucher tidak berlaku untuk item di keranjang Anda." };
  }

  return { voucher, perItemDiscount, totalDiscount };
}
