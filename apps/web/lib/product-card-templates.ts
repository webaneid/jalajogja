export type ProductCardData = {
  id:             string;
  name:           string;
  slug:           string;
  description:    string | null;
  price:          string;          // numeric dari DB
  coverUrl:       string | null;   // dari images[0] → resolved MinIO URL
  coverVariants?: Record<string, string> | null;
  categoryName:   string | null;
  // Mitra fields — null untuk produk tenant internal
  sellerType:   "tenant" | "mitra";
  memberPrice:  string | null;     // harga khusus anggota IKPM (mitra only)
  businessName: string | null;     // nama usaha mitra
  mitraId:      string | null;
};

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
