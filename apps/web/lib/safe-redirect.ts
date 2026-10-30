// Tujuan redirect pasca-login yang boleh diikuti: HANYA path internal situs ini.
// Menolak: URL absolut (https://evil), protocol-relative (//evil), backslash (/\evil — browser menafsirkannya
// sebagai //evil), dan karakter kontrol/CRLF. `searchParams.get()` sudah men-decode %2F, jadi "/%2Fevil" yang
// terdecode menjadi "//evil" ikut tertolak. Murni (tanpa import) → aman dipakai di server maupun client.
export function safeInternalPath(raw: string | null | undefined, fallback: string): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return fallback;
  return raw;
}
