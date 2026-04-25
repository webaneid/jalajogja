export type PostCardData = {
  id:           string;
  title:        string;
  slug:         string;
  excerpt:      string | null;
  coverUrl:     string | null;
  categoryName: string | null;
  publishedAt:  Date | null;
  isFeatured:   boolean;
};

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
