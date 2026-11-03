// Voucher produsen ("Promo Produsen", K23) — SISI SERVER. docs/arsitektur-produk-produsen.md § 4, § 12.
//  - Pemilik = produsen dari SESI (vouchers.owner_producer_id). Produsen hanya menyentuh barisnya sendiri.
//  - Target = produk MILIK produsen itu (divalidasi dari DB, bukan dipercaya dari klien); produk bervariasi belum bisa jadi target.
//  - Batas potongan = persentase bagian tenant (checkVoucherCap) — ditegakkan juga saat checkout (computeVoucherDiscount).
import "server-only";
import { and, desc, eq, inArray, isNull, count } from "drizzle-orm";
import { createTenantDb } from "@jalajogja/db";
import { getTenantTimezone, localDatetimeToUtcIso } from "@/lib/tenant-timezone.server";
import { pgErrorCode } from "@/lib/pg-error";
import { isValidUuid } from "@/lib/is-uuid";
import { getProducerCommercials, type ProducerAccessLite } from "@/lib/producer-products.server";
import { checkVoucherCap, type ProducerVoucherInput } from "@/lib/producer-vouchers";

type TenantDb = ReturnType<typeof createTenantDb>;
type Fail = { ok: false; error: string };

async function validateTargetsAndCap(tc: TenantDb, producerId: string, input: ProducerVoucherInput): Promise<{ ok: true; sharePercent: number } | Fail> {
  const com = await getProducerCommercials(tc, producerId);
  if (!com || !com.isActive) return { ok: false, error: "Akun produsen tidak aktif." };
  if (com.sharePercent === null) return { ok: false, error: "Persentase bagi hasil Anda belum ditetapkan pengurus. Hubungi pengurus." };

  const P = tc.schema.products;
  const rows = await tc.db.select({ id: P.id, type: P.productType, pub: P.publicPrice, member: P.memberPrice }).from(P)
    .where(and(inArray(P.id, input.targetItemIds), eq(P.producerId, producerId), isNull(P.mitraId)));
  if (rows.length !== input.targetItemIds.length) return { ok: false, error: "Ada produk target yang bukan milik Anda." };
  if (rows.some((r) => r.type === "variable")) return { ok: false, error: "Produk bervariasi belum bisa dijadikan target voucher." };

  const prices = rows.flatMap((r) => [r.pub, r.member]).map((v) => (v === null || v === undefined ? NaN : parseFloat(String(v)))).filter((n) => Number.isFinite(n) && n > 0);
  if (prices.length === 0) return { ok: false, error: "Produk target belum memiliki harga." };
  const capErr = checkVoucherCap(input, com.sharePercent, Math.min(...prices));
  return capErr ? { ok: false, error: capErr } : { ok: true, sharePercent: com.sharePercent };
}

async function dateRange(tc: TenantDb, input: ProducerVoucherInput) {
  const tz = await getTenantTimezone(tc);
  return {
    validFrom:  input.validFrom  ? new Date(localDatetimeToUtcIso(`${input.validFrom}T00:00`,  tz)) : null,
    validUntil: input.validUntil ? new Date(localDatetimeToUtcIso(`${input.validUntil}T23:59`, tz)) : null,
  };
}

export async function createProducerVoucher(access: ProducerAccessLite, input: ProducerVoucherInput): Promise<{ ok: true; voucherId: string } | Fail> {
  const tc = createTenantDb(access.tenant.slug);
  const v = await validateTargetsAndCap(tc, access.producer.id, input);
  if (!v.ok) return v;
  const { validFrom, validUntil } = await dateRange(tc, input);
  try {
    const [row] = await tc.db.insert(tc.schema.vouchers).values({
      code: input.code, name: input.name, description: input.description || null,
      discountType: input.discountType, discountValue: input.discountValue.toFixed(2),
      targetType: "product", targetItemIds: input.targetItemIds,
      usageLimit: input.usageLimit, usageLimitPerCustomer: input.usageLimitPerCustomer,
      restrictPhone: input.restrictPhone, restrictEmail: input.restrictEmail,
      validFrom, validUntil, isActive: input.isActive,
      ownerProducerId: access.producer.id,     // dari SESI
    }).returning({ id: tc.schema.vouchers.id });
    return { ok: true, voucherId: row.id };
  } catch (e) {
    if (pgErrorCode(e) === "23505") return { ok: false, error: "Kode voucher sudah dipakai — gunakan kode lain." };
    throw e;
  }
}

/** Ubah voucher MILIK produsen ini (kode tidak berubah). Voucher yang sudah dipakai boleh diubah (pesanan lama memakai potongan saat checkout). */
export async function updateProducerVoucher(access: ProducerAccessLite, voucherId: string, input: ProducerVoucherInput): Promise<{ ok: true } | Fail> {
  if (!isValidUuid(voucherId)) return { ok: false, error: "Voucher tidak ditemukan." };
  const tc = createTenantDb(access.tenant.slug);
  const V = tc.schema.vouchers;
  const v = await validateTargetsAndCap(tc, access.producer.id, input);
  if (!v.ok) return v;
  const { validFrom, validUntil } = await dateRange(tc, input);
  const upd = await tc.db.update(V).set({
    name: input.name, description: input.description || null,
    discountType: input.discountType, discountValue: input.discountValue.toFixed(2),
    targetItemIds: input.targetItemIds, usageLimit: input.usageLimit, usageLimitPerCustomer: input.usageLimitPerCustomer,
    restrictPhone: input.restrictPhone, restrictEmail: input.restrictEmail, validFrom, validUntil, isActive: input.isActive,
    updatedAt: new Date(),
  }).where(and(eq(V.id, voucherId), eq(V.ownerProducerId, access.producer.id))).returning({ id: V.id });
  return upd.length ? { ok: true } : { ok: false, error: "Voucher tidak ditemukan." };
}

export async function setProducerVoucherActive(access: ProducerAccessLite, voucherId: string, isActive: boolean): Promise<{ ok: true } | Fail> {
  if (!isValidUuid(voucherId)) return { ok: false, error: "Voucher tidak ditemukan." };
  const tc = createTenantDb(access.tenant.slug);
  const V = tc.schema.vouchers;
  const upd = await tc.db.update(V).set({ isActive, updatedAt: new Date() })
    .where(and(eq(V.id, voucherId), eq(V.ownerProducerId, access.producer.id))).returning({ id: V.id });
  return upd.length ? { ok: true } : { ok: false, error: "Voucher tidak ditemukan." };
}

/** Hapus hanya bila belum pernah dipakai (riwayat pemakaian harus utuh) — selain itu cukup nonaktifkan. */
export async function deleteProducerVoucher(access: ProducerAccessLite, voucherId: string): Promise<{ ok: true } | Fail> {
  if (!isValidUuid(voucherId)) return { ok: false, error: "Voucher tidak ditemukan." };
  const tc = createTenantDb(access.tenant.slug);
  const V = tc.schema.vouchers, R = tc.schema.voucherRedemptions;
  return tc.db.transaction(async (tx) => {
    const [own] = await tx.select({ id: V.id }).from(V).where(and(eq(V.id, voucherId), eq(V.ownerProducerId, access.producer.id))).for("update").limit(1);
    if (!own) return { ok: false as const, error: "Voucher tidak ditemukan." };
    const [{ n }] = await tx.select({ n: count() }).from(R).where(eq(R.voucherId, voucherId));
    if (Number(n) > 0) return { ok: false as const, error: "Voucher ini sudah pernah dipakai sehingga tidak bisa dihapus. Nonaktifkan saja." };
    await tx.delete(V).where(and(eq(V.id, voucherId), eq(V.ownerProducerId, access.producer.id)));
    return { ok: true as const };
  });
}

export type ProducerVoucherRow = {
  id: string; code: string; name: string; description: string | null; discountType: "percentage" | "fixed"; discountValue: number;
  targetItemIds: string[]; usageLimit: number | null; usageLimitPerCustomer: number | null; usedCount: number;
  restrictPhone: string | null; restrictEmail: string | null; validFrom: string | null; validUntil: string | null; isActive: boolean;
};

export async function listProducerVouchers(tc: TenantDb, producerId: string): Promise<ProducerVoucherRow[]> {
  const V = tc.schema.vouchers;
  const rows = await tc.db.select().from(V).where(eq(V.ownerProducerId, producerId)).orderBy(desc(V.createdAt)).limit(200);
  return rows.map((r) => ({
    id: r.id, code: r.code, name: r.name, description: r.description, discountType: r.discountType, discountValue: parseFloat(String(r.discountValue)),
    targetItemIds: (r.targetItemIds as string[]) ?? [], usageLimit: r.usageLimit, usageLimitPerCustomer: r.usageLimitPerCustomer, usedCount: r.usedCount,
    restrictPhone: r.restrictPhone, restrictEmail: r.restrictEmail,
    validFrom: r.validFrom?.toISOString() ?? null, validUntil: r.validUntil?.toISOString() ?? null, isActive: r.isActive,
  }));
}

export async function getProducerVoucher(tc: TenantDb, producerId: string, voucherId: string): Promise<ProducerVoucherRow | null> {
  if (!isValidUuid(voucherId)) return null;
  const all = await listProducerVouchers(tc, producerId);
  return all.find((v) => v.id === voucherId) ?? null;
}
