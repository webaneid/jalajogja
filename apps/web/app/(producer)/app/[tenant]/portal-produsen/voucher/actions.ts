"use server";
// Server Actions voucher PRODUSEN ("Promo Produsen", K23) — docs/arsitektur-produk-produsen.md § 4, § 12.
// Penjaga getProducerAccess (fail-closed). Pemilik voucher = produsen dari SESI; target/batas diperiksa ulang di server.
import { revalidatePath } from "next/cache";
import { getProducerAccess } from "@/lib/producer-access.server";
import { checkRateLimit } from "@/lib/rate-limit";
import { isValidUuid } from "@/lib/is-uuid";
import { parseVoucherInput } from "@/lib/producer-vouchers";
import { createProducerVoucher, updateProducerVoucher, setProducerVoucherActive, deleteProducerVoucher } from "@/lib/producer-vouchers.server";

export type VoucherActionResult = { success: true; voucherId?: string } | { success: false; error: string };
const HOUR = 60 * 60_000;
const refresh = (slug: string) => revalidatePath(`/app/${slug}/portal-produsen/voucher`);

export async function createProducerVoucherAction(slug: string, input: unknown): Promise<VoucherActionResult> {
  const access = await getProducerAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!checkRateLimit(`prodvoucher-create:${access.producer.id}`, 30, HOUR).allowed) return { success: false, error: "Terlalu banyak percobaan. Coba lagi nanti." };
  const parsed = parseVoucherInput(input);
  if (!parsed.ok) return { success: false, error: parsed.error };
  try {
    const res = await createProducerVoucher(access, parsed.value);
    if (!res.ok) return { success: false, error: res.error };
    refresh(access.tenant.slug);
    return { success: true, voucherId: res.voucherId };
  } catch (e) {
    console.error("[createProducerVoucherAction]", e instanceof Error ? e.message : "unknown");
    return { success: false, error: "Gagal membuat voucher." };
  }
}

export async function updateProducerVoucherAction(slug: string, voucherId: string, input: unknown): Promise<VoucherActionResult> {
  const access = await getProducerAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (typeof voucherId !== "string" || !isValidUuid(voucherId)) return { success: false, error: "Voucher tidak ditemukan." };
  if (!checkRateLimit(`prodvoucher-update:${access.producer.id}`, 120, HOUR).allowed) return { success: false, error: "Terlalu banyak perubahan. Coba lagi nanti." };
  const parsed = parseVoucherInput(input, { requireCode: false });   // kode tidak bisa diubah → diabaikan
  if (!parsed.ok) return { success: false, error: parsed.error };
  try {
    const res = await updateProducerVoucher(access, voucherId, parsed.value);
    if (!res.ok) return { success: false, error: res.error };
    refresh(access.tenant.slug);
    return { success: true, voucherId };
  } catch (e) {
    console.error("[updateProducerVoucherAction]", e instanceof Error ? e.message : "unknown");
    return { success: false, error: "Gagal menyimpan voucher." };
  }
}

export async function setProducerVoucherActiveAction(slug: string, voucherId: string, isActive: boolean): Promise<VoucherActionResult> {
  const access = await getProducerAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (typeof voucherId !== "string" || !isValidUuid(voucherId) || typeof isActive !== "boolean") return { success: false, error: "Permintaan tidak valid." };
  try {
    const res = await setProducerVoucherActive(access, voucherId, isActive);
    if (!res.ok) return { success: false, error: res.error };
    refresh(access.tenant.slug);
    return { success: true };
  } catch (e) {
    console.error("[setProducerVoucherActiveAction]", e instanceof Error ? e.message : "unknown");
    return { success: false, error: "Gagal mengubah status voucher." };
  }
}

export async function deleteProducerVoucherAction(slug: string, voucherId: string): Promise<VoucherActionResult> {
  const access = await getProducerAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (typeof voucherId !== "string" || !isValidUuid(voucherId)) return { success: false, error: "Voucher tidak ditemukan." };
  try {
    const res = await deleteProducerVoucher(access, voucherId);
    if (!res.ok) return { success: false, error: res.error };
    refresh(access.tenant.slug);
    return { success: true };
  } catch (e) {
    console.error("[deleteProducerVoucherAction]", e instanceof Error ? e.message : "unknown");
    return { success: false, error: "Gagal menghapus voucher." };
  }
}
