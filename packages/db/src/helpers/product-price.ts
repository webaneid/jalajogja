// Resolusi harga produk — SATU sumber kebenaran untuk tampilan (client+server) DAN checkout.
// MURNI: nol import (tidak boleh menarik drizzle/postgres) karena dipakai juga oleh komponen
// client via subpath `@jalajogja/db/product-price`.
//
// Model harga (keputusan user 2026-10-09, lihat docs/arsitektur-product.md § "Model Harga Baru"):
//   price        = Harga Dasar/modal — TIDAK pernah ditagih ke pembeli (kecuali fallback produk lama)
//   public_price = Harga Publik — harga jual untuk SEMUA orang (login atau tidak)
//   member_price = Harga Anggota — khusus anggota; memberPriceTenantOnly menentukan cakupannya
// Variasi: tiap field = nilai variasi kalau diisi, kalau kosong ikut produk utama (per field).

// Tier pembeli. "tenant" ⊂ "ikpm": anggota tenant ini juga anggota IKPM.
export type ViewerTier = "public" | "ikpm" | "tenant";

export type PriceSet = {
  price:       unknown;   // Harga Dasar
  publicPrice: unknown;   // Harga Publik
  memberPrice?: unknown;  // Harga Anggota (opsional — pemanggil yang hanya butuh harga publik boleh tak menyertakan)
};

const num = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
};

// Variasi opsional: kosong (null) per field → ambil dari produk utama.
export function mergeVariationPrices(parent: PriceSet, variation: PriceSet): PriceSet {
  return {
    price:       variation.price       ?? parent.price,
    publicPrice: variation.publicPrice ?? parent.publicPrice,
    memberPrice: variation.memberPrice ?? parent.memberPrice,
  };
}

// Harga Publik efektif. Produk LAMA yang belum punya public_price jatuh ke `price` (dibiarkan
// apa adanya sampai admin mengubah sendiri — laba tampil nol, bukan error).
export function publicSellingPrice(set: PriceSet): number {
  return num(set.publicPrice) ?? num(set.price) ?? 0;
}

// Anggota berhak Harga Anggota? flag tenantOnly=true → hanya anggota tenant ini.
export function isMemberPriceEligible(viewer: ViewerTier, memberPriceTenantOnly: boolean): boolean {
  return viewer === "tenant" || (viewer === "ikpm" && !memberPriceTenantOnly);
}

// Harga yang DITAGIH/DITAMPILKAN untuk pembeli ini. Anggota tidak pernah membayar LEBIH dari
// harga publik (jaga-jaga data tak konsisten — form admin juga memblokir member > publik).
export function resolveSellingPrice(
  set:                   PriceSet,
  viewer:                ViewerTier,
  memberPriceTenantOnly: boolean,
): number {
  const pub    = publicSellingPrice(set);
  const member = num(set.memberPrice);
  if (member != null && isMemberPriceEligible(viewer, memberPriceTenantOnly)) {
    return Math.min(member, pub);
  }
  return pub;
}

// Untuk rentang harga produk variabel / info admin: nilai min-max dari beberapa harga jual.
export function minMax(values: number[]): { min: number; max: number } | null {
  if (values.length === 0) return null;
  return { min: Math.min(...values), max: Math.max(...values) };
}

// Bentuk harga yang BOLEH dikirim ke komponen client publik / payload RSC. Harga Dasar (modal)
// TIDAK BOLEH ikut — props komponen client ter-serialize ke HTML/flight data dan terbaca siapa
// pun lewat view-source, walau tidak dirender di layar. `price` DIGANTI harga publik efektif
// (bukan dihapus: tipe ProductCardData mewajibkannya, dan fallback produk lama tetap benar).
// Pakai di SEMUA pembangun ProductCardData / ProductVariationData untuk halaman publik.
export function toPublicPriceFields(set: PriceSet): { price: string; publicPrice: string; memberPrice: string | null } {
  const pub = String(publicSellingPrice(set));
  const m   = num(set.memberPrice);
  return { price: pub, publicPrice: pub, memberPrice: m != null ? String(m) : null };
}
