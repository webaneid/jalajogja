// Registri semua URL front-end publik — statis + builder untuk konten dinamis

export type PublicLinkType =
  | "static"
  | "page"
  | "post"
  | "post-category"
  | "post-tag"
  | "product"
  | "product-category"
  | "campaign"
  | "pesantren"
  | "usaha"
  | "profesional";

export type PublicLink = {
  label: string;
  url:   string;
  group: string;
  type:  PublicLinkType;
  meta?: string;  // info tambahan: tanggal, jumlah post, dll
};

// ── Rute statis ────────────────────────────────────────────────────────────────

type StaticRoute = {
  label: string;
  path:  (slug: string) => string;
  group: string;
  icon:  string;  // nama ikon lucide (untuk referensi komponen)
};

export const STATIC_ROUTES: StaticRoute[] = [
  // Halaman Utama
  { label: "Beranda",             path: s => `/${s}/`,              group: "Halaman Utama", icon: "Home" },
  { label: "Arsip Postingan",     path: s => `/${s}/post`,          group: "Halaman Utama", icon: "Newspaper" },
  { label: "Agenda / Event",      path: s => `/${s}/agenda`,        group: "Halaman Utama", icon: "Calendar" },
  { label: "Direktori Produk",    path: s => `/${s}/produk`,        group: "Halaman Utama", icon: "ShoppingBag" },
  { label: "Donasi & Campaign",   path: s => `/${s}/campaign`,      group: "Halaman Utama", icon: "Heart" },
  // Direktori
  { label: "Direktori Anggota",   path: s => `/${s}/anggota`,       group: "Direktori",     icon: "Users" },
  { label: "Direktori Pesantren", path: s => `/${s}/pesantren`,     group: "Direktori",     icon: "School" },
  { label: "Direktori Usaha",     path: s => `/${s}/usaha`,         group: "Direktori",     icon: "Briefcase" },
  { label: "Direktori Profesional", path: s => `/${s}/profesional`, group: "Direktori",     icon: "Briefcase" },
  { label: "Statistik",           path: s => `/${s}/statistik`,     group: "Direktori",     icon: "BarChart2" },
  // Transaksi
  { label: "Keranjang Belanja",   path: s => `/${s}/keranjang`,     group: "Transaksi",     icon: "ShoppingCart" },
  // Akun
  { label: "Login",               path: s => `/${s}/login`,         group: "Akun",          icon: "LogIn" },
  { label: "Register",            path: s => `/${s}/register`,      group: "Akun",          icon: "UserPlus" },
  { label: "Dashboard Akun",      path: s => `/${s}/akun`,          group: "Akun",          icon: "LayoutDashboard" },
  { label: "Riwayat Transaksi",   path: s => `/${s}/akun/transaksi`,group: "Akun",          icon: "Receipt" },
];

// Resolve rute statis ke PublicLink[] dengan tenant slug
export function getStaticLinks(slug: string, q?: string): PublicLink[] {
  const query = q?.toLowerCase().trim() ?? "";
  return STATIC_ROUTES
    .filter(r => !query || r.label.toLowerCase().includes(query))
    .map(r => ({
      label: r.label,
      url:   r.path(slug),
      group: r.group,
      type:  "static" as PublicLinkType,
    }));
}

// ── Builder URL konten dinamis ──────────────────────────────────────────────────

export function buildPageUrl(slug: string, pageSlug: string) {
  return `/${slug}/${pageSlug}`;
}
export function buildPostUrl(slug: string, postSlug: string) {
  return `/${slug}/post/${postSlug}`;
}
export function buildPostCategoryUrl(slug: string, catSlug: string) {
  return `/${slug}/post?category=${catSlug}`;
}
export function buildPostTagUrl(slug: string, tagSlug: string) {
  return `/${slug}/post?tag=${tagSlug}`;
}
export function buildProductUrl(slug: string, productSlug: string) {
  return `/${slug}/produk/${productSlug}`;
}
export function buildProductCategoryUrl(slug: string, catSlug: string) {
  return `/${slug}/produk/kategori/${catSlug}`;
}
export function buildCampaignUrl(slug: string, campaignSlug: string) {
  return `/${slug}/campaign/${campaignSlug}`;
}
export function buildPesantrenUrl(slug: string, id: string) {
  return `/${slug}/pesantren/${id}`;
}
export function buildUsahaUrl(slug: string, id: string) {
  return `/${slug}/usaha/${id}`;
}
export function buildProfesionalUrl(slug: string, id: string) {
  return `/${slug}/profesional/${id}`;
}

// ── Label grup yang konsisten ───────────────────────────────────────────────────

export const LINK_GROUP_LABELS: Record<string, string> = {
  "Halaman Utama":    "Halaman Utama",
  "Direktori":        "Direktori",
  "Transaksi":        "Transaksi",
  "Akun":             "Akun",
  "Halaman":          "Halaman",
  "Postingan":        "Postingan",
  "Kategori Post":    "Kategori Post",
  "Tag Post":         "Tag Post",
  "Produk":           "Produk",
  "Kategori Produk":  "Kategori Produk",
  "Donasi":           "Donasi",
};
