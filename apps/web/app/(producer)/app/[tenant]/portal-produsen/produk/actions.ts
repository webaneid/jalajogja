"use server";
// Server Actions produk milik PRODUSEN — docs/arsitektur-produk-produsen.md § 12 (K21–K29).
// Penjaga: getProducerAccess (fail-closed bila syarat belum ditandatangani). producerId + tenant dari SESI, tidak pernah dari input.
// Isi input diparse ulang di server (parseProductInput menerima `unknown`); harga dasar, status, produsen, asal kirim TIDAK dari klien.
import { revalidatePath } from "next/cache";
import { getProducerAccess } from "@/lib/producer-access.server";
import { checkRateLimit } from "@/lib/rate-limit";
import { parseProductInput } from "@/lib/producer-products";
import { isValidUuid } from "@/lib/is-uuid";
import { createProducerProduct, updateProducerProduct, setProducerProductStatus, deleteProducerProduct } from "@/lib/producer-products.server";

export type ProductActionResult = { success: true; productId: string } | { success: false; error: string };

const HOUR = 60 * 60_000;

function refresh(slug: string) {
  revalidatePath(`/app/${slug}/portal-produsen/produk`);
  revalidatePath(`/${slug}/produk`);
}

export async function createProducerProductAction(slug: string, input: unknown): Promise<ProductActionResult> {
  const access = await getProducerAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!checkRateLimit(`prodproduct-create:${access.producer.id}`, 30, HOUR).allowed) return { success: false, error: "Terlalu banyak percobaan. Coba lagi nanti." };

  const parsed = parseProductInput(input);
  if (!parsed.ok) return { success: false, error: parsed.error };
  try {
    const res = await createProducerProduct(access, parsed.value);
    if (!res.ok) return { success: false, error: res.error };
    refresh(access.tenant.slug);
    return { success: true, productId: res.productId };
  } catch (e) {
    console.error("[createProducerProductAction]", e instanceof Error ? e.message : "unknown");
    return { success: false, error: "Gagal menyimpan produk." };
  }
}

export type SimpleResult = { success: true } | { success: false; error: string };

export async function updateProducerProductAction(slug: string, productId: string, input: unknown): Promise<ProductActionResult> {
  const access = await getProducerAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (typeof productId !== "string" || !isValidUuid(productId)) return { success: false, error: "Produk tidak ditemukan." };
  if (!checkRateLimit(`prodproduct-update:${access.producer.id}`, 120, HOUR).allowed) return { success: false, error: "Terlalu banyak perubahan. Coba lagi nanti." };
  const parsed = parseProductInput(input);
  if (!parsed.ok) return { success: false, error: parsed.error };
  try {
    const res = await updateProducerProduct(access, productId, parsed.value);
    if (!res.ok) return { success: false, error: res.error };
    refresh(access.tenant.slug);
    return { success: true, productId };
  } catch (e) {
    console.error("[updateProducerProductAction]", e instanceof Error ? e.message : "unknown");
    return { success: false, error: "Gagal menyimpan perubahan." };
  }
}

export async function setProducerProductStatusAction(slug: string, productId: string, status: string): Promise<SimpleResult> {
  const access = await getProducerAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (typeof productId !== "string" || !isValidUuid(productId)) return { success: false, error: "Produk tidak ditemukan." };
  if (status !== "active" && status !== "archived") return { success: false, error: "Status tidak valid." };
  try {
    const res = await setProducerProductStatus(access, productId, status);
    if (!res.ok) return { success: false, error: res.error };
    refresh(access.tenant.slug);
    return { success: true };
  } catch (e) {
    console.error("[setProducerProductStatusAction]", e instanceof Error ? e.message : "unknown");
    return { success: false, error: "Gagal mengubah status." };
  }
}

export async function deleteProducerProductAction(slug: string, productId: string): Promise<SimpleResult> {
  const access = await getProducerAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (typeof productId !== "string" || !isValidUuid(productId)) return { success: false, error: "Produk tidak ditemukan." };
  if (!checkRateLimit(`prodproduct-delete:${access.producer.id}`, 30, HOUR).allowed) return { success: false, error: "Terlalu banyak penghapusan. Coba lagi nanti." };
  try {
    const res = await deleteProducerProduct(access, productId);
    if (!res.ok) return { success: false, error: res.error };
    refresh(access.tenant.slug);
    return { success: true };
  } catch (e) {
    console.error("[deleteProducerProductAction]", e instanceof Error ? e.message : "unknown");
    return { success: false, error: "Gagal menghapus produk." };
  }
}
