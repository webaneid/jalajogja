// Validasi URL sebelum dipakai sebagai `href` — cegah `javascript:`/`data:` URI scheme dari
// input yang tidak sepenuhnya dipercaya (mis. pickupMapsUrl yang mengalir dari checkout publik
// tanpa auth, lihat docs/arsitektur-billing.md § 14.5). Pakai konstruktor `URL` (bukan
// `startsWith` string) supaya normalisasi protokol konsisten dengan cara browser mem-parsing —
// tidak mudah dilewati trik whitespace/karakter kontrol di awal string.
export function isSafeExternalUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
