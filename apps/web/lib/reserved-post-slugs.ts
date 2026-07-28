// Slug post/page yang TIDAK BOLEH dipakai saat permalink structure tenant = "post_name"
// (docs/arsitektur-import-export-post-wordpress.md § 5, Fase 2.7) — kalau permalink="post_name",
// post hidup di path 1-segmen `/{slug}` PERSIS sama seperti Page — kalau slug post kebetulan
// sama dengan nama folder statis publik ("post", "produk", dst), post itu jadi TIDAK PERNAH
// bisa diakses (folder statis SELALU menang atas catch-all di Next.js App Router).
//
// Daftar ini dibangun dari folder RIIL saat ini di app/(public)/[tenant]/ — bukan disalin dari
// draft dokumen lama. WAJIB diupdate kalau ada folder statis publik BARU ditambahkan ke
// app/(public)/[tenant]/ ke depan (jalankan `find "app/(public)/[tenant]" -maxdepth 1 -type d`
// untuk verifikasi ulang sebelum menambah folder baru).
//
// TIDAK termasuk "app"/"platform"/"api"/"admin" — itu reserved untuk TENANT SLUG (middleware.ts's
// TENANT_SLUG regex), beda konsep sama sekali dari POST SLUG di dalam satu tenant. Post slug
// "app" di tenant manapun (mis. /pc-ikpm-jogjakarta/app) tidak collide dengan /app/[tenant]/...
// (admin dashboard) karena segmen pertama URL itu tenant slug, bukan "app".
export const RESERVED_POST_SLUGS = [
  "agenda", "akun", "akun-error", "anggota", "campaign", "cart", "checkout", "dokumen",
  "event", "forgot-password", "gabung", "invite", "invoice", "keranjang", "login",
  "pesantren", "post", "produk", "profesional", "register", "reset-password", "sign",
  "statistik", "usaha", "verify",
] as const;

export function isReservedPostSlug(slug: string): boolean {
  return (RESERVED_POST_SLUGS as readonly string[]).includes(slug);
}
