import { resolveSellingPrice, publicSellingPrice, isMemberPriceEligible, type ViewerTier } from "@jalajogja/db/product-price";

export type ProductCardData = {
  id:             string;
  name:           string;
  slug:           string;
  description:    string | null;
  // Harga — untuk simple product; variable product pakai priceMin/priceMax
  // Model harga baru (docs/arsitektur-product.md § "Model Harga Baru"): `price` = Harga Dasar
  // (MODAL — JANGAN PERNAH ditampilkan ke pembeli, jangan dicoret sebagai "harga asli"),
  // `publicPrice` = harga jual semua orang, `memberPrice` = Harga Anggota (cakupan ditentukan
  // `memberPriceTenantOnly`). Harga tampil WAJIB lewat priceDisplay()/resolvePrice().
  price:          string;
  publicPrice:    string | null;
  memberPrice:    string | null;
  memberPriceTenantOnly: boolean;
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
  // Stok tersedia (fisik dikurangi reservasi invoice pending) — HANYA diisi di halaman detail
  // produk (produk/[productSlug]/page.tsx) untuk produk simple. Card grid/list/related TIDAK
  // mengisi ini (undefined) — tidak perlu tampilan stok di situ. null = produk variable (stok
  // per-variasi dipakai, bukan field ini). Lihat docs/arsitektur-stok.md.
  availableStock?: number | null;
  // Gratis ongkir — HANYA diisi di halaman detail produk (sama pola availableStock di atas),
  // card grid/list/related TIDAK mengisi (undefined = tidak tahu/tidak relevan di situ). Produk
  // mitra TIDAK PERNAH mengisi ini (selalu "none" kalau ada mitraId). Lihat
  // docs/arsitektur-addon-ongkir.md § "Badge Gratis Ongkir di Halaman Produk Publik".
  freeShippingMode?:      "none" | "all" | "regions";
  freeShippingProvinces?: { id: number; name: string }[];
  freeShippingCities?:    { id: number; name: string }[];
};

// Tier pembeli: "public" (tamu/non-anggota) | "ikpm" (anggota IKPM) | "tenant" (anggota tenant ini).
export type SessionType = ViewerTier;

export type PriceDisplay = {
  display:       string;          // harga yang DITAGIH untuk pembeli ini
  original:      string | null;   // Harga Publik — hanya diisi (untuk dicoret) kalau Harga Anggota berlaku
  isMemberPrice: boolean;
};

// Satu-satunya pintu harga tampil. Produk variabel: priceMin sudah di-resolve per pembeli di
// server (resolveVariantPriceRanges); diskon per variasi tampil di halaman detail.
export function priceDisplay(product: ProductCardData, viewer: SessionType): PriceDisplay {
  if (product.productType === "variable") {
    return { display: product.priceMin, original: null, isMemberPrice: false };
  }
  const display = String(resolveSellingPrice(product, viewer, product.memberPriceTenantOnly));
  const pub     = String(publicSellingPrice(product));
  const isMemberPrice =
    product.memberPrice != null
    && isMemberPriceEligible(viewer, product.memberPriceTenantOnly)
    && parseFloat(display) < parseFloat(pub);
  return { display, original: isMemberPrice ? pub : null, isMemberPrice };
}

export function resolvePrice(product: ProductCardData, sessionType: SessionType): string {
  return priceDisplay(product, sessionType).display;
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
