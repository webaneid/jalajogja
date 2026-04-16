// Konstanta SEO untuk seluruh aplikasi jalajogja

// ── Batas panjang teks ────────────────────────────────────────────────────────
export const TITLE_MAX_LENGTH   = 60;
export const DESC_MAX_LENGTH    = 160;
export const TITLE_SEPARATOR    = " | ";

// ── Nilai default ─────────────────────────────────────────────────────────────
export const DEFAULT_TWITTER_CARD = "summary_large_image" as const;
export const DEFAULT_ROBOTS       = "index,follow" as const;
export const DEFAULT_LOCALE       = "id_ID";
export const DEFAULT_OG_TYPE      = "website" as const;

// ── Dimensi OG image standar ──────────────────────────────────────────────────
export const OG_IMAGE_WIDTH  = 1200;
export const OG_IMAGE_HEIGHT = 630;

// ── AI-friendly crawlers — izinkan semua (konten organisasi bersifat publik) ──
// List ini dipakai saat membangun robots.txt agar AI dapat mengindex konten
export const AI_FRIENDLY_CRAWLERS = [
  "Googlebot",
  "Bingbot",
  "GPTBot",          // OpenAI
  "ClaudeBot",       // Anthropic
  "anthropic-ai",    // Anthropic API crawler
  "Google-Extended", // Google AI training
  "PerplexityBot",
  "YouBot",
  "CCBot",           // Common Crawl
] as const;

// ── Preset robots.txt ─────────────────────────────────────────────────────────

/** Izinkan semua bot termasuk AI */
export const ROBOTS_ALLOW_ALL = {
  rules: [{ userAgent: "*", allow: "/" }],
} as const;

/** Blokir semua crawler (mode private / under construction) */
export const ROBOTS_BLOCK_ALL = {
  rules: [{ userAgent: "*", disallow: "/" }],
} as const;

/** Blokir AI training bots, tapi tetap izinkan search engine standar */
export const ROBOTS_BLOCK_AI_TRAINING = {
  rules: [
    { userAgent: "*", allow: "/" },
    { userAgent: "GPTBot",          disallow: "/" },
    { userAgent: "Google-Extended", disallow: "/" },
    { userAgent: "CCBot",           disallow: "/" },
    { userAgent: "anthropic-ai",    disallow: "/" },
  ],
} as const;

// ── Schema.org types yang tersedia per konten ─────────────────────────────────
export const SCHEMA_ORG_TYPES = {
  post:     ["Article", "NewsArticle", "BlogPosting"] as const,
  page:     ["WebPage", "AboutPage", "ContactPage", "FAQPage"] as const,
  product:  ["Product", "SoftwareApplication"] as const,
  campaign: ["WebPage", "Event", "DonateAction"] as const,
  event:    ["Event", "WebPage"] as const,
} as const;
