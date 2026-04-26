export type PostCardData = {
  id:             string;
  title:          string;
  slug:           string;
  excerpt:        string | null;
  coverUrl:       string | null;                       // large atau path asli — backward compat
  coverVariants?: Record<string, string> | null;       // semua variant resolved URLs
  coverAlt?:      string | null;                       // dari media.alt_text
  coverTitle?:    string | null;                       // dari media.title
  categoryName:   string | null;
  publishedAt:    string | null;
  isFeatured:     boolean;
};

/** Pilih URL gambar variant terbaik, fallback ke coverUrl jika variant belum ada */
export function pickCover(post: PostCardData, variant: string): string | null {
  return post.coverVariants?.[variant] ?? post.coverUrl;
}

export const POST_CARD_VARIANTS = ["klasik", "list", "overlay", "ringkas", "judul", "ticker"] as const;
export type PostCardVariant = typeof POST_CARD_VARIANTS[number];

export const POST_CARD_VARIANT_LABELS: Record<PostCardVariant, string> = {
  klasik:  "Klasik",
  list:    "List",
  overlay: "Overlay",
  ringkas: "Ringkas",
  judul:   "Judul",
  ticker:  "Ticker",
};

export const POST_CARD_VARIANT_DESCRIPTIONS: Record<PostCardVariant, string> = {
  klasik:  "Gambar di atas, judul dan ringkasan di bawah. Cocok untuk grid.",
  list:    "Horizontal: teks kiri, gambar kanan. Cocok untuk arsip panjang.",
  overlay: "Gambar penuh dengan teks overlay di bawah. Cocok untuk hero/featured.",
  ringkas: "Gambar di atas, judul dan tanggal saja. Tanpa ringkasan. Cocok untuk grid padat.",
  judul:   "Teks saja, tanpa gambar. Kategori + judul + tanggal. Cocok untuk sidebar.",
  ticker:  "Judul sebagai link saja. Untuk running text / marquee berita.",
};
