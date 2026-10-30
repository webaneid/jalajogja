// Integrasi pelacakan & verifikasi webmaster per tenant — docs/arsitektur-seo.md § 3.
// Admin hanya menempel ID, BUKAN script mentah. Setiap ID divalidasi regex ketat di titik
// simpan DAN di titik render (defense in depth) — nilai yang lolos aman disisipkan ke template
// script tetap tanpa risiko XSS. Jangan longgarkan regex tanpa review keamanan.

export const TRACKING_SETTING_KEYS = {
  gtm:    "seo_gtm_id",
  ga4:    "seo_ga4_id",
  pixel:  "seo_meta_pixel_id",
  google: "seo_google_verification",
  bing:   "seo_bing_verification",
} as const;

export type TrackingField = keyof typeof TRACKING_SETTING_KEYS;

export type TrackingConfig = Record<TrackingField, string>;

const PATTERNS: Record<TrackingField, RegExp> = {
  gtm:    /^GTM-[A-Z0-9]{4,12}$/,
  ga4:    /^G-[A-Z0-9]{6,14}$/,
  pixel:  /^\d{8,20}$/,
  google: /^[A-Za-z0-9_-]{20,100}$/,
  bing:   /^[A-Fa-f0-9]{16,64}$/,
};

export const TRACKING_FIELD_ERRORS: Record<TrackingField, string> = {
  gtm:    "ID Tag Manager tidak valid. Format: GTM-XXXXXXX.",
  ga4:    "ID Google Analytics 4 tidak valid. Format: G-XXXXXXXXXX.",
  pixel:  "ID Meta Pixel tidak valid. Isi dengan angka saja (8–20 digit).",
  google: "Kode verifikasi Google tidak valid.",
  bing:   "Kode verifikasi Bing tidak valid.",
};

// Ekstrak kode `content` kalau admin menempel seluruh tag <meta ...> (atau awalan
// "google-site-verification="); kalau bukan, kembalikan teks apa adanya (di-trim).
function extractVerificationCode(raw: string): string {
  const v = raw.trim();
  const m = v.match(/content\s*=\s*["']([^"']+)["']/i);
  const code = m ? m[1]! : v;
  return code.replace(/^google-site-verification=/i, "").replace(/^msvalidate\.01=/i, "").trim();
}

// Normalisasi input mentah → nilai bersih, atau null kalau tidak valid. "" = kosong (valid, hapus).
export function normalizeTrackingValue(field: TrackingField, raw: string | undefined | null): string | null {
  const v = (raw ?? "").trim();
  if (v === "") return "";
  if (v.length > 500) return null; // tempelan tag <meta> wajar < 500 karakter
  const candidate =
    field === "google" || field === "bing" ? extractVerificationCode(v)
    : field === "pixel" ? v
    : v.toUpperCase();
  return PATTERNS[field].test(candidate) ? candidate : null;
}

// Pakai di titik render: nilai dari DB tetap divalidasi ulang; yang tak lolos dianggap kosong.
export function readTrackingConfig(settings: Record<string, unknown>): TrackingConfig {
  const out = {} as TrackingConfig;
  for (const field of Object.keys(TRACKING_SETTING_KEYS) as TrackingField[]) {
    const raw = settings[TRACKING_SETTING_KEYS[field]];
    out[field] = typeof raw === "string" && PATTERNS[field].test(raw) ? raw : "";
  }
  return out;
}
