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
