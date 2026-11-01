// Pencocokan gratis-ongkir per-produk — dipakai checkout (diskon proporsional-berat) DAN badge
// di halaman produk publik. Dicocokkan by NAMA provinsi/kabupaten (bukan ID) — search kelurahan
// tujuan customer tidak pernah balikin ID provinsi/kabupaten numerik, cuma nama string. Aman
// karena dua-duanya dari dataset RajaOngkir yang sama. Lihat docs/arsitektur-addon-ongkir.md.
//
// Diekstrak (2026-09-15) dari duplikat identik di checkout-form.tsx dan order-create-client.tsx
// — menambah pemakaian ke-3 (badge produk) tanpa konsolidasi akan jadi duplikat ke-3, pola yang
// sudah pernah bermasalah di project ini (lihat docs/arsitektur-voucher.md § 16-18).

export type FreeShippingRegionConfig = {
  freeShippingMode:      "none" | "all" | "regions";
  freeShippingProvinces: { id: number; name: string }[];
  freeShippingCities:    { id: number; name: string }[];
};

export function isFreeShippingMatch(
  config: FreeShippingRegionConfig,
  dest:   { provinceName: string; cityName: string },
): boolean {
  if (config.freeShippingMode === "all") return true;
  if (config.freeShippingMode !== "regions") return false;
  const up = (s: string) => s.trim().toUpperCase();
  return config.freeShippingProvinces.some((p) => up(p.name) === up(dest.provinceName))
      || config.freeShippingCities.some((c) => up(c.name) === up(dest.cityName));
}

/**
 * Proporsi berat item gratis-ongkir di satu paket (0..1). Kalau SEMUA item gratis → 1 (ongkir Rp0) dari rumus yang sama.
 * Dipakai form checkout (tampilan) DAN verifikasi ongkir server — satu rumus, supaya angka yang ditagih = yang ditampilkan.
 */
export function freeShippingRatio(
  group: { totalWeightGram: number; items: (FreeShippingRegionConfig & { weightGram: number; quantity: number })[] },
  dest: { provinceName: string; cityName: string },
): number {
  if (group.totalWeightGram <= 0) return 0;
  const freeWeight = group.items.reduce((s, it) =>
    s + (isFreeShippingMatch(it, dest) ? it.weightGram * it.quantity : 0), 0);
  return freeWeight / group.totalWeightGram;
}

/** Ongkir akhir setelah diskon gratis-ongkir proporsional-berat. `discount` = base − cost. */
export function applyFreeShipping(base: number, ratio: number): { cost: number; discount: number } {
  const cost = ratio > 0 ? Math.round(base * (1 - ratio)) : base;
  return { cost, discount: base - cost };
}
