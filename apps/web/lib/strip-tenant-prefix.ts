// Strip prefix "/${slug}" dari sebuah href yang disimpan dengan asumsi path-mode
// (jalakarta.com/{slug}/...) — dipakai saat merender href tsb di custom domain aktif
// (di mana slug tidak pernah muncul di URL). Pure function, aman dipakai client MAUPUN
// server — tidak ada dependency Node/DB. Lihat docs/arsitektur-public-link-picker.md § 9.
export function stripTenantPrefix(href: string, slug: string): string {
  if (href === `/${slug}`) return "/";
  if (href.startsWith(`/${slug}/`)) return href.slice(`/${slug}`.length);
  return href; // anchor "#...", URL eksternal, atau path tanpa prefix — dibiarkan apa adanya
}
