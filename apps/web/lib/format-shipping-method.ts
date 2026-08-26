// Format label "Cara Pengiriman" dari satu baris invoice_shipping_lines — dipakai bersama
// halaman detail produk (daftar pembeli) dan export Excel pembeli, supaya labelnya konsisten
// di kedua tempat. Pickup SELALU prabayar (tidak ada COD untuk ambil sendiri, lihat komentar
// schema invoice_shipping_lines di packages/db/src/schema/tenant/billing.ts).
export type ShippingLineInfo = {
  deliveryMethod: string;
  courier:        string | null;
  service:        string | null;
  paymentMethod:  string;
} | null | undefined;

export function formatShippingMethod(line: ShippingLineInfo): string {
  if (!line) return "—";
  if (line.deliveryMethod === "pickup") return "Ambil Sendiri";
  const parts = [line.courier?.toUpperCase(), line.service].filter(Boolean);
  const base  = parts.length > 0 ? parts.join(" ") : "Kurir";
  return line.paymentMethod === "cod" ? `${base} (COD)` : base;
}
