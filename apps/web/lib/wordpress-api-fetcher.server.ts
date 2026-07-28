// Fetcher REST API WordPress — docs/arsitektur-import-export-post-wordpress.md § 2.2.
// Server-only: fetch eksternal WAJIB lewat safeFetch() (§ 11), plus 1 query DB per row untuk
// deteksi duplikat slug (query yang SAMA dengan parser WXR — reuse, tidak divergen).
//
// Scope SAMA PERSIS dengan parser WXR (§ 13): fungsi ini HANYA fetch+ekstrak+normalisasi jadi
// ParsedWordPressItem[], TIDAK mengunduh gambar, TIDAK memanggil processImage()/generateJSON(),
// TIDAK insert DB, TIDAK find-or-create post_authors. Itu semua tugas commitImportChunkAction.
//
// PERBEDAAN UTAMA dari parser WXR (§ 2.2/§ 15.2, terbukti dari fetch live forbis.id):
// - TIDAK ADA field SEO Yoast sama sekali (`yoast_head_json` tidak ada di respons) — seo diisi
//   default kosong, BUKAN error. Reposisi metode ini jadi "cepat, konten saja, tanpa SEO".
// - `_embedded.author` BISA 404 (rest_user_invalid_id) — fallback batch-level author terjadi
//   nanti di commit/UI review, di sini cukup catat via `notes` kalau penulis tidak ditemukan.

import "server-only";
import { safeFetch } from "./wordpress-import-security";
import { localDatetimeToUtcIso } from "@/lib/tenant-timezone";
import {
  decodeHtmlEntities, extractPathFromUrl, stripHtmlTags,
  type ParsedWordPressItem, type ParsedTaxonomyTerm, type ParsedWpAuthor, type WordPressSeoFields,
} from "@/lib/wordpress-import-mapping";
import type { TenantDb } from "@jalajogja/db";
import { findExistingContentBySlug } from "./wordpress-xml-parser.server";

const PER_PAGE = 100;
// Safety cap LOKAL untuk loop pagination fetcher ini SAJA — bukan pengganti "budget 5.000 fetch
// per batch" (§ 11 poin 3, sengaja ditunda ke commitImportChunkAction karena butuh counter
// lintas-sumber gambar+REST). 200 halaman × 100/halaman = 20.000 item per tipe konten — jauh
// melebihi skala realistis "ratusan-ribuan artikel", cuma mencegah loop tak berkesudahan kalau
// situs target melaporkan X-WP-TotalPages yang keliru/dimanipulasi.
const MAX_PAGES_PER_TYPE = 200;

function emptySeoFields(): WordPressSeoFields {
  // REST API TIDAK menyertakan Yoast SEO sama sekali (§ 2.2/§ 15.2, dikonfirmasi fetch live) —
  // ini BUKAN kegagalan ekstraksi, memang tidak ada datanya di sumber ini.
  return {
    metaTitle: null, metaDesc: null, focusKeyword: null,
    ogTitle: null, ogDescription: null, ogImageUrl: null,
    robots: "index,follow", schemaType: "Article",
    isFeatured: false, viewCount: 0, primaryCategoryWpId: null,
  };
}

export type RestFetchResult = {
  rows: ParsedWordPressItem[];
  fetchErrors: string[]; // error level REQUEST (per halaman/endpoint) — bukan per-row
};

export async function fetchWordPressContent(
  siteUrl: string,
  opts: { tenantDb: TenantDb; tenantTimezone: string },
): Promise<RestFetchResult> {
  const baseUrl = normalizeSiteUrl(siteUrl);
  if (!baseUrl) {
    return { rows: [], fetchErrors: ["URL situs tidak valid — pastikan diawali http:// atau https://."] };
  }

  const fetchErrors: string[] = [];
  const rows: ParsedWordPressItem[] = [];
  let rowNumber = 0;

  // Loop 2 tipe konten (§ 14.2 — Pages ikut diimpor, infrastruktur sama, tanpa mapping penulis
  // — tapi tetap diekstrak di sini untuk konsistensi bentuk, cukup diabaikan downstream).
  // TIDAK panggil /categories atau /tags terpisah (§ 2.2 poin 2-3) — _embed=1's `wp:term`
  // SUDAH memberi taksonomi lengkap PER-ITEM yang jadi kebutuhan fungsi ini; endpoint terpisah
  // itu baru relevan untuk fitur lain (mis. UI pemetaan taksonomi situs-lebar), di luar scope.
  for (const contentType of ["post", "page"] as const) {
    const endpoint = contentType === "post" ? "posts" : "pages";
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages && page <= MAX_PAGES_PER_TYPE) {
      const url = `${baseUrl}/wp-json/wp/v2/${endpoint}?per_page=${PER_PAGE}&page=${page}&_embed=1`;

      let res: Response;
      try {
        res = await safeFetch(url);
      } catch (err) {
        fetchErrors.push(`Gagal mengambil ${endpoint} halaman ${page}: ${(err as Error).message}`);
        break;
      }

      if (!res.ok) {
        // WordPress balas 400 rest_post_invalid_page_number saat page > total halaman
        // sesungguhnya — ini akhir alami loop, bukan error yang perlu dilaporkan ke admin.
        if (page > 1 && res.status === 400) break;
        fetchErrors.push(`${endpoint} halaman ${page}: server merespons HTTP ${res.status}.`);
        break;
      }

      const totalPagesHeader = res.headers.get("x-wp-totalpages");
      if (totalPagesHeader) {
        const parsed = Number(totalPagesHeader);
        if (Number.isFinite(parsed) && parsed > 0) totalPages = parsed;
      }

      let items: unknown;
      try {
        items = await res.json();
      } catch {
        fetchErrors.push(`${endpoint} halaman ${page}: respons bukan JSON yang valid.`);
        break;
      }
      if (!Array.isArray(items) || items.length === 0) break;

      for (const item of items as Record<string, unknown>[]) {
        rowNumber += 1;
        rows.push(await mapRestItemToRow(item, contentType, rowNumber, opts));
      }

      page += 1;
    }
  }

  return { rows, fetchErrors };
}

function normalizeSiteUrl(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

async function mapRestItemToRow(
  item: Record<string, unknown>,
  contentType: "post" | "page",
  rowNumber: number,
  opts: { tenantDb: TenantDb; tenantTimezone: string },
): Promise<ParsedWordPressItem> {
  const notes: string[] = [];

  const title = decodeHtmlEntities(
    String((item.title as { rendered?: string } | undefined)?.rendered ?? "").trim(),
  );
  const slugRaw = String(item.slug ?? "").trim();
  const slug = slugRaw || title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!slugRaw) notes.push("Slug tidak ada di respons REST, dibuat otomatis dari judul.");

  // excerpt.rendered SELALU dibungkus <p> oleh WordPress core (bahkan excerpt manual) — strip
  // dulu supaya jadi plain text yang konsisten dengan <excerpt:encoded> WXR.
  const excerptRendered = String((item.excerpt as { rendered?: string } | undefined)?.rendered ?? "").trim();
  const excerpt = excerptRendered ? decodeHtmlEntities(stripHtmlTags(excerptRendered)) : null;

  const rawContentHtml = String((item.content as { rendered?: string } | undefined)?.rendered ?? "");

  const publishedAtIso = resolveRestPublishedAt(
    String(item.date_gmt ?? ""),
    String(item.date ?? ""),
    opts.tenantTimezone,
  );
  if (!publishedAtIso) notes.push("Tanggal publish tidak valid — perlu diisi manual setelah import.");

  const embedded = (item._embedded ?? {}) as Record<string, unknown>;

  // Taksonomi — _embedded['wp:term'] array-of-array, bucket per field `taxonomy` tiap entry
  // (bukan positional index) supaya tahan kalau urutan berubah/salah satu taksonomi kosong
  // (Pages umumnya tidak punya taksonomi sama sekali di WP core — array kosong, bukan crash).
  const categories: ParsedTaxonomyTerm[] = [];
  const tags: ParsedTaxonomyTerm[] = [];
  const termGroups = (embedded["wp:term"] ?? []) as unknown[];
  for (const group of termGroups) {
    if (!Array.isArray(group)) continue;
    for (const term of group as Record<string, unknown>[]) {
      const name = decodeHtmlEntities(String(term.name ?? "").trim());
      if (!name) continue;
      const entry: ParsedTaxonomyTerm = { name, slug: String(term.slug ?? "").trim() || null };
      const taxonomy = String(term.taxonomy ?? "");
      if (taxonomy === "category") categories.push(entry);
      else if (taxonomy === "post_tag") tags.push(entry);
    }
  }

  // Penulis — _embedded.author BISA 404 (§ 2.2/§ 15.2, error-shaped object bukan array valid
  // author) → author.name tidak akan ada, terdeteksi via typeof check di bawah, bukan crash.
  const authorEmbed = embedded.author;
  const authorEntry = Array.isArray(authorEmbed) ? (authorEmbed[0] as Record<string, unknown> | undefined) : undefined;
  const authorName = typeof authorEntry?.name === "string" ? authorEntry.name.trim() : "";
  const author: ParsedWpAuthor = authorName
    ? {
        username: null, // REST API kasih nama tampilan langsung, tidak perlu resolve dari username
        displayName: decodeHtmlEntities(authorName),
        bio: typeof authorEntry?.description === "string" && authorEntry.description.trim()
          ? decodeHtmlEntities(authorEntry.description.trim())
          : null,
        // Catatan (§ 2.4): avatar_urls selalu ada meski cuma Gravatar placeholder generik —
        // deteksi "asli vs placeholder" butuh request tambahan ke Gravatar, di luar scope
        // fetch/parse ini (foto BARU diunduh saat commit — putuskan di sana apakah worth diunduh).
        avatarUrl: extractAvatarUrl(authorEntry),
      }
    : { username: null, displayName: null, bio: null, avatarUrl: null };
  if (!authorName) {
    notes.push("Penulis tidak ditemukan dari REST API (author endpoint privat/404) — akan pakai fallback batch-level saat commit.");
  }

  // Featured image — _embedded['wp:featuredmedia'] bisa juga error-shaped kalau featured_media=0
  const mediaEmbed = embedded["wp:featuredmedia"];
  const mediaEntry = Array.isArray(mediaEmbed) ? (mediaEmbed[0] as Record<string, unknown> | undefined) : undefined;
  const featuredImageUrl = typeof mediaEntry?.source_url === "string" ? mediaEntry.source_url : null;
  const featuredImageAlt = typeof mediaEntry?.alt_text === "string" && mediaEntry.alt_text.trim()
    ? mediaEntry.alt_text.trim()
    : null;

  const legacyPath = extractPathFromUrl(String(item.link ?? "").trim());

  const existingContentId = await findExistingContentBySlug(opts.tenantDb, contentType, slug);
  const status: ParsedWordPressItem["status"] = existingContentId
    ? "duplicate"
    : (publishedAtIso ? "ready" : "review_needed");

  return {
    rowNumber,
    contentType,
    status,
    notes,
    wpPostId: Number(item.id) || null,
    title,
    slug,
    excerpt,
    rawContentHtml,
    publishedAtIso,
    categories,
    tags,
    author,
    featuredImageUrl,
    featuredImageAlt,
    seo: emptySeoFields(),
    legacyPath,
    existingContentId,
  };
}

function extractAvatarUrl(authorEntry: Record<string, unknown> | undefined): string | null {
  const avatarUrls = authorEntry?.avatar_urls as Record<string, unknown> | undefined;
  if (!avatarUrls) return null;
  const preferred = avatarUrls["96"] ?? avatarUrls["48"] ?? avatarUrls["24"];
  return typeof preferred === "string" ? preferred : null;
}

function resolveRestPublishedAt(dateGmt: string, dateLocal: string, tenantTimezone: string): string | null {
  // date_gmt REST API: "2026-07-18T11:01:21" — ISO-like tapi tanpa suffix Z eksplisit (§ 15.2).
  if (dateGmt) {
    const iso = dateGmt.endsWith("Z") ? dateGmt : `${dateGmt}Z`;
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  if (dateLocal) {
    const truncated = dateLocal.slice(0, 16); // "YYYY-MM-DDTHH:mm"
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(truncated)) {
      try {
        return localDatetimeToUtcIso(truncated, tenantTimezone);
      } catch {
        return null;
      }
    }
  }
  return null;
}
