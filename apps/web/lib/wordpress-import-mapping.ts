// Helper murni (client-safe, tanpa DB) untuk Import WordPress — docs/arsitektur-import-export-
// post-wordpress.md. Pola file ini SAMA PERSIS dengan lib/import-anggota-mapping.ts: fungsi
// mapping/decode kecil + type preview di sini (BUKAN di file server-only), karena preview table
// di UI (belum dibangun) nanti butuh import type ini juga — lihat lesson CLAUDE.md soal client/
// server boundary (jangan pernah import dari file "server-only" di client component).

// ── Entity HTML di dalam CDATA (§ 16.4) ───────────────────────────────────────────────────
// WordPress menulis title/excerpt dengan HTML entity SUDAH di-encode DI DALAM CDATA (mis.
// "Summit &amp; Expo" — bukan bug fast-xml-parser, CDATA memang tidak pernah di-decode oleh
// spesifikasi XML manapun). Perlu decode manual terpisah — TIDAK menambah dependency baru
// (mis. package `he`) untuk kebutuhan sekecil ini, cukup regex untuk numeric entity + daftar
// pendek named entity yang umum dipakai WordPress.
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
  nbsp: " ",
  mdash: "—", ndash: "–", hellip: "…",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”",
};

export function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#\d+|#x[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, code: string) => {
    if (code.startsWith("#x") || code.startsWith("#X")) {
      const codePoint = parseInt(code.slice(2), 16);
      return Number.isNaN(codePoint) ? match : String.fromCodePoint(codePoint);
    }
    if (code.startsWith("#")) {
      const codePoint = parseInt(code.slice(1), 10);
      return Number.isNaN(codePoint) ? match : String.fromCodePoint(codePoint);
    }
    return NAMED_ENTITIES[code] ?? match; // entity tidak dikenal → biarkan apa adanya
  });
}

// ── Strip tag HTML (§ 2.2) — HANYA untuk excerpt REST API, yang SELALU dibungkus <p> oleh
// WordPress core (bahkan excerpt manual tetap dibungkus). WXR punya <excerpt:encoded> yang
// sudah plain text, jadi fungsi ini tidak dipakai untuk jalur WXR — dua metode import punya
// bentuk mentah yang berbeda, TIDAK dipaksa seragam kalau memang tidak perlu.
export function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

// ── Tahap A — Sanitasi HTML Gutenberg (§ 7.2) — dipanggil saat COMMIT, sebelum generateJSON() ──
// Strip komentar Gutenberg Block (<!-- wp:paragraph -->, <!-- /wp:gallery -->, dst). Pola
// bisa NESTED (dikonfirmasi § 15.3: wp:list-item di dalam <ol> yang belum ditutup, wp:image di
// dalam wp:gallery yang belum ditutup) — regex ini AMAN untuk kasus itu karena cuma cocokkan
// sampai karakter "-->" PERTAMA, mengabaikan isi payload JSON atribut sepenuhnya (JANGAN coba
// parse JSON balanced-braces-nya — tidak perlu, dan lebih rawan salah kalau payload JSON punya
// object nested seperti {"lightbox":{"enabled":true}}). Comment murni overlay di atas HTML yang
// sudah valid — menghapusnya tidak pernah merusak struktur tag <ol><li>/<figure><img> di baliknya.
export function sanitizeGutenbergHtml(html: string): string {
  return html.replace(/<!--\s*\/?wp:[\w-]+[^>]*-->/g, "");
}

// ── Ekstrak path dari URL lengkap (§ 5.5, untuk legacy_url_redirects nanti saat commit) ────
// WXR <link> / REST API "link" selalu URL lengkap (https://situs-lama.com/2024/05/slug/).
// Yang relevan buat redirect hanya PATH-nya (domain lama biasanya JADI custom domain baru).
export function extractPathFromUrl(fullUrl: string): string | null {
  try {
    const url = new URL(fullUrl);
    return url.pathname || "/";
  } catch {
    return null; // URL tidak valid — jangan crash, biarkan pemanggil putuskan fallback-nya
  }
}

// ── Pemetaan SEO Yoast (§ 4.1) — HANYA Yoast, TIDAK menebak Rank Math/AIOSEO (§ 4.3) ───────
// Sesuai rekomendasi eksplisit § 4.3: adapter plugin lain ditambahkan satu per satu begitu
// ada sample WXR sungguhan untuk diverifikasi — jangan menebak dari ingatan.
export type WordPressSeoFields = {
  metaTitle: string | null;
  metaDesc: string | null;
  focusKeyword: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImageUrl: string | null; // URL mentah — DIUNDUH+processImage() nanti saat commit, bukan di sini
  robots: "index,follow" | "noindex" | "noindex,nofollow";
  schemaType: "Article" | "NewsArticle" | "BlogPosting";
  isFeatured: boolean; // dari ane_news_utama (§ 4.1 tambahan, ACF plugin) — opsional
  viewCount: number;   // dari wpb_post_views_count / musi_views, ambil nilai TERBESAR — opsional, default 0
  primaryCategoryWpId: string | null; // dari _yoast_wpseo_primary_category — tie-breaker kategori
};

const SEO_SCHEMA_TYPES = new Set(["Article", "NewsArticle", "BlogPosting"]);

export function mapYoastSeo(postmeta: Record<string, string>): WordPressSeoFields {
  const noindex = postmeta["_yoast_wpseo_meta-robots-noindex"] === "1";
  const nofollow = postmeta["_yoast_wpseo_meta-robots-nofollow"] === "1";
  const robots: WordPressSeoFields["robots"] = noindex
    ? (nofollow ? "noindex,nofollow" : "noindex")
    : "index,follow";

  const rawSchemaType = postmeta["_yoast_wpseo_schema_article_type"] ?? "";
  const schemaType: WordPressSeoFields["schemaType"] = SEO_SCHEMA_TYPES.has(rawSchemaType)
    ? (rawSchemaType as WordPressSeoFields["schemaType"])
    : "Article";

  // Views: ambil key yang dikenal, pakai nilai TERBESAR kalau lebih dari satu ada (§ 4.1)
  const viewCandidates = ["wpb_post_views_count", "musi_views"]
    .map((k) => Number(postmeta[k]))
    .filter((n) => Number.isFinite(n) && n >= 0);
  const viewCount = viewCandidates.length > 0 ? Math.max(...viewCandidates) : 0;

  return {
    metaTitle:    postmeta["_yoast_wpseo_title"]?.trim() || null,
    metaDesc:     postmeta["_yoast_wpseo_metadesc"]?.trim() || null,
    focusKeyword: postmeta["_yoast_wpseo_focuskw"]?.trim() || null,
    ogTitle:          postmeta["_yoast_wpseo_opengraph-title"]?.trim() || null,
    ogDescription:    postmeta["_yoast_wpseo_opengraph-description"]?.trim() || null,
    ogImageUrl:       postmeta["_yoast_wpseo_opengraph-image"]?.trim() || null,
    robots,
    schemaType,
    isFeatured: postmeta["ane_news_utama"] === "1",
    viewCount,
    primaryCategoryWpId: postmeta["_yoast_wpseo_primary_category"]?.trim() || null,
  };
}

// ── Bentuk satu baris preview lengkap ──────────────────────────────────────────────────────
// Sama untuk WXR maupun REST API — parser masing-masing metode mengisi field ini secara
// SETARA, downstream (commit, UI preview) tidak perlu tahu asal sumbernya.
export type ImportContentStatus = "ready" | "review_needed" | "duplicate" | "error";

export type ParsedTaxonomyTerm = {
  name: string;
  slug: string | null; // WXR selalu punya nicename; REST API bisa beda struktur
};

export type ParsedWpAuthor = {
  username: string | null;
  displayName: string | null; // fallback ke username kalau nama tampilan tidak tersedia
  bio: string | null;
  avatarUrl: string | null;
};

export type ParsedWordPressItem = {
  rowNumber: number;
  contentType: "post" | "page";
  status: ImportContentStatus;
  notes: string[]; // penjelasan informasional, tidak mengubah status (pola sama Importer Anggota)

  wpPostId: number | null;
  title: string;
  slug: string;
  excerpt: string | null;
  rawContentHtml: string; // Gutenberg HTML MENTAH — konversi ke Tiptap JSON terjadi saat commit (§ 7.2 Tahap B), bukan di sini
  publishedAtIso: string | null; // sudah dikonversi ke UTC ISO via tenantTimezone (§ 6.2)

  categories: ParsedTaxonomyTerm[]; // domain="category" — resolusi jadi post_categories.id terjadi saat commit
  tags: ParsedTaxonomyTerm[];       // domain="post_tag"

  author: ParsedWpAuthor; // resolusi jadi post_authors.id (find-or-create) terjadi saat commit (§ 2.4)

  featuredImageUrl: string | null; // dari _thumbnail_id → attachment index (dua-tahap, § 2.1)
  featuredImageAlt: string | null;

  seo: WordPressSeoFields;

  legacyPath: string | null; // path dari <link>/REST "link" (§ 5.5), untuk legacy_url_redirects saat commit

  existingContentId: string | null; // terisi kalau status="duplicate" — id posts/pages yang slug-nya sudah dipakai
};

// ── Tie-breaker kategori utama (§ 4.1 tambahan) ────────────────────────────────────────────
// `_yoast_wpseo_primary_category` di postmeta ITEM cuma kasih wp_term_id (mis. "19") — tapi
// <category domain="category" nicename="kabar">Kabar</category> di ITEM itu sendiri TIDAK
// menyertakan term_id sama sekali, cuma nama+nicename. Perlu tabel lookup term_id→nama dari
// blok <wp:category> di level CHANNEL (WordPress menulis daftar kategori lengkap sekali di
// awal file, terpisah dari tiap <item> — pola sama <wp:author> untuk penulis, § 2.4) untuk
// menjembatani ID → nama sebelum bisa dicocokkan ke `categories` milik item ini.
// Kalau primary category tidak ada/tidak cocok → fallback ke kategori PERTAMA di urutan
// <category> item (bukan error, bukan kosong).
export function resolvePrimaryCategory(
  categories: ParsedTaxonomyTerm[],
  primaryCategoryWpId: string | null,
  termNameByWpTermId: Map<string, string>, // wp_term_id (channel-level <wp:category>) → nama kategori
): ParsedTaxonomyTerm | null {
  if (categories.length === 0) return null;
  if (primaryCategoryWpId) {
    const matchedName = termNameByWpTermId.get(primaryCategoryWpId);
    if (matchedName) {
      const found = categories.find((c) => c.name === matchedName);
      if (found) return found;
    }
  }
  return categories[0];
}
