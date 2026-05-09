export type ProductCardData = {
  id:             string;
  name:           string;
  slug:           string;
  description:    string | null;
  // Harga — untuk simple product; variable product pakai priceMin/priceMax
  price:          string;          // tier 1: harga dasar (tidak login)
  publicPrice:    string | null;   // tier 2: harga untuk akun login
  memberPrice:    string | null;   // tier 3: harga anggota IKPM seluruh dunia
  // Variasi
  productType:    "simple" | "variable";
  priceMin:       string;          // simple → price; variable → MIN(variation.price)
  priceMax:       string | null;   // null jika simple atau semua variasi sama harganya
  coverUrl:       string | null;
  coverVariants?: Record<string, string> | null;
  categoryName:   string | null;
  // Mitra fields
  sellerType:   "tenant" | "mitra";
  businessName: string | null;
  mitraId:      string | null;
};

export type SessionType = "none" | "public" | "member";

// Resolve harga display — untuk variable product pakai priceMin sebagai base
export function resolvePrice(product: ProductCardData, sessionType: SessionType): string {
  if (product.productType === "variable") {
    // Variable product: tampilkan priceMin (harga terendah variasi)
    // Diskon per variasi ditampilkan di halaman detail saat user pilih variasi
    return product.priceMin;
  }
  if (sessionType === "member" && product.memberPrice) return product.memberPrice;
  if (sessionType !== "none"   && product.publicPrice)  return product.publicPrice;
  return product.price;
}

// Label harga untuk card — variable product tampil "Mulai dari"
export function priceLabel(product: ProductCardData, sessionType: SessionType): string {
  if (product.productType === "variable") {
    const hasRange = product.priceMax && product.priceMax !== product.priceMin;
    return hasRange
      ? `${formatPrice(product.priceMin)} – ${formatPrice(product.priceMax)}`
      : `Mulai dari ${formatPrice(product.priceMin)}`;
  }
  return formatPrice(resolvePrice(product, sessionType));
}

export const PRODUCT_CARD_VARIANTS = ["grid", "list", "ringkas"] as const;
export type ProductCardVariant = typeof PRODUCT_CARD_VARIANTS[number];

export const PRODUCT_CARD_VARIANT_LABELS: Record<ProductCardVariant, string> = {
  grid:    "Grid",
  list:    "List",
  ringkas: "Ringkas",
};

export const PRODUCT_CARD_VARIANT_DESCRIPTIONS: Record<ProductCardVariant, string> = {
  grid:    "Gambar atas, nama + harga + kategori. Cocok untuk grid produk.",
  list:    "Horizontal: thumbnail kiri, info kanan. Cocok untuk arsip padat.",
  ringkas: "Gambar + nama + harga saja. Cocok untuk carousel.",
};

// Pilih URL cover sesuai variant — fallback ke coverUrl
export function pickProductCover(product: ProductCardData, variant: "square" | "square-large"): string | null {
  return product.coverVariants?.[variant] ?? product.coverUrl;
}

// Format harga Rupiah: "150000" → "Rp 150.000"
export function formatPrice(price: string | null): string {
  if (!price) return "";
  return `Rp ${Number(price).toLocaleString("id-ID")}`;
}
