// Daftar tetap "pageKey" untuk sistem SEO Page Overrides (Fase 3, docs/arsitektur-seo.md § 3.3).
// pageKey BUKAN URL — identifier stabil yang hidup di kode, pola sama STATIC_TOP_SEGMENTS di
// lib/mobile-route-checks.ts. File ini murni data (tanpa DB) — aman diimpor client component.
//
// Kalau menambah halaman Kelas C baru ke sistem override: (1) tambah entry di sini, (2) panggil
// getPageSeoOverride() di generateMetadata halaman itu — lihat pola di app/(public)/[tenant]/post/page.tsx.

export type SeoPageKey =
  | "login" | "register" | "forgot-password" | "reset-password"
  | "keranjang" | "checkout"
  | "post-archive" | "produk-archive" | "campaign-archive" | "agenda-archive" | "dokumen-archive"
  | "anggota-archive" | "usaha-archive" | "pesantren-archive" | "profesional-archive" | "statistik";

export type SeoPageKeyEntry = {
  key:   SeoPageKey;
  label: string;
  group: string;
  path:  (slug: string) => string;
};

export const SEO_PAGE_KEYS: SeoPageKeyEntry[] = [
  { key: "login",              label: "Login",               group: "Akun",      path: s => `/${s}/login` },
  { key: "register",           label: "Registrasi",          group: "Akun",      path: s => `/${s}/register` },
  { key: "forgot-password",    label: "Lupa Password",       group: "Akun",      path: s => `/${s}/forgot-password` },
  { key: "reset-password",     label: "Reset Password",      group: "Akun",      path: s => `/${s}/reset-password` },
  { key: "keranjang",          label: "Keranjang Belanja",   group: "Transaksi", path: s => `/${s}/keranjang` },
  { key: "checkout",           label: "Checkout",            group: "Transaksi", path: s => `/${s}/checkout` },
  { key: "post-archive",       label: "Arsip Postingan",     group: "Arsip",     path: s => `/${s}/post` },
  { key: "produk-archive",     label: "Arsip Produk",        group: "Arsip",     path: s => `/${s}/produk` },
  { key: "campaign-archive",   label: "Donasi & Campaign",   group: "Arsip",     path: s => `/${s}/campaign` },
  { key: "agenda-archive",     label: "Agenda / Event",      group: "Arsip",     path: s => `/${s}/agenda` },
  { key: "dokumen-archive",    label: "Arsip Dokumen",       group: "Arsip",     path: s => `/${s}/dokumen` },
  { key: "anggota-archive",    label: "Direktori Anggota",   group: "Direktori", path: s => `/${s}/anggota` },
  { key: "usaha-archive",      label: "Direktori Usaha",     group: "Direktori", path: s => `/${s}/usaha` },
  { key: "pesantren-archive",  label: "Direktori Pesantren", group: "Direktori", path: s => `/${s}/pesantren` },
  { key: "profesional-archive", label: "Direktori Profesional", group: "Direktori", path: s => `/${s}/profesional` },
  { key: "statistik",          label: "Statistik",           group: "Direktori", path: s => `/${s}/statistik` },
];
