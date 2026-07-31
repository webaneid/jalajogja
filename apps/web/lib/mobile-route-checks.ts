// Helper pathname-based dipakai bersama oleh beberapa komponen mobile shell publik
// (header-visibility.tsx, footer-bottom-nav.tsx) — satu sumber kebenaran supaya definisi
// "halaman single" dan "halaman dengan bar aksi sendiri" tidak drift antar file.
// Arsitektur lengkap + aturan spacer/sticky-bar: docs/arsitektur-mobile-shell.md.

// Top-level route folder di app/(public)/[tenant]/ yang BUKAN halaman single generik.
// WAJIB diupdate kalau ada folder static baru ditambah ke app/(public)/[tenant]/ — lihat
// docs/arsitektur-mobile-shell.md § 2.
export const STATIC_TOP_SEGMENTS = new Set([
  "agenda", "akun", "akun-error", "anggota", "campaign", "cart", "checkout",
  "dokumen", "event", "forgot-password", "invite", "invoice", "keranjang",
  "login", "pesantren", "post", "produk", "profesional", "register",
  "reset-password", "sign", "statistik", "usaha", "verify",
]);

function segmentsOf(pathname: string, baseUrl: string): string[] {
  const rest = baseUrl !== "" && pathname.startsWith(baseUrl) ? pathname.slice(baseUrl.length) : pathname;
  return rest.split("/").filter(Boolean);
}

// Halaman single mobile (post/agenda/campaign/produk detail + halaman generik) menyembunyikan
// header situs di layar mobile — diganti overlay back+menu yang melekat di gambar fitur
// (lihat SingleMobileTopBar). Header tetap tampil normal di tablet/desktop (≥768px) dan di
// semua halaman lain (arsip, homepage, dashboard akun, dll).
export function isSingleMobileRoute(pathname: string, baseUrl: string): boolean {
  const segments = segmentsOf(pathname, baseUrl);

  if (segments.length === 2) {
    if (segments[0] === "post" || segments[0] === "agenda" || segments[0] === "campaign") return true;
    if (segments[0] === "produk" && segments[1] !== "kategori") return true;
    if (segments[0] === "usaha" || segments[0] === "pesantren" || segments[0] === "profesional") return true;
  }
  if (segments.length === 1 && !STATIC_TOP_SEGMENTS.has(segments[0])) return true;
  return false;
}

// Halaman yang punya bar aksi sendiri nempel di bawah layar (Total+Checkout di /keranjang,
// Voucher+Buat Invoice di /checkout) — BottomNav generik (FlexHeader) TIDAK dirender di sini
// supaya tidak rebutan ruang bottom-0 dengan bar aksi milik halaman. Header (topbar/logo/
// cart-icon/user-menu) TETAP tampil normal — hanya tab nav bawah yang diganti.
const PAGES_WITH_OWN_MOBILE_ACTION_BAR = new Set(["keranjang", "checkout"]);

export function hasOwnMobileActionBar(pathname: string, baseUrl: string): boolean {
  const segments = segmentsOf(pathname, baseUrl);
  return segments.length === 1 && PAGES_WITH_OWN_MOBILE_ACTION_BAR.has(segments[0]);
}

// Skema KETIGA (beda dari isSingleMobileRoute yang khusus "detail+gambar" dan
// hasOwnMobileActionBar yang cuma sembunyikan BottomNav) — SELURUH /akun/* (semua kedalaman:
// /akun, /akun/profil, /akun/mitra/pesanan, dst) jadi "app mode" sendiri di mobile: header
// situs DAN BottomNav situs disembunyikan total, diganti header+bottom-nav milik akun sendiri
// (lihat components/akun/mobile/). docs/arsitektur-mobile-shell.md § 2.
export function isAkunAppMode(pathname: string, baseUrl: string): boolean {
  const segments = segmentsOf(pathname, baseUrl);
  return segments[0] === "akun";
}
