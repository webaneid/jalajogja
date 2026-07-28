// Parser WXR (WordPress eXtended RSS) XML — docs/arsitektur-import-export-post-wordpress.md
// § 2.1. Server-only: pakai fast-xml-parser + 1 query DB untuk deteksi duplikat slug.
//
// Scope SENGAJA dibatasi (§ 13 — "parse murni CPU, tidak ada I/O eksternal"): fungsi ini HANYA
// mengekstrak+menormalisasi data jadi ParsedWordPressItem[], TIDAK mengunduh gambar, TIDAK
// memanggil processImage()/generateJSON(), TIDAK insert ke posts/pages/media, TIDAK
// find-or-create post_authors. Semua itu terjadi nanti di commitImportChunkAction (§ 7.1/7.2,
// § 2.4 — belum ditulis, langkah roadmap terpisah).

import "server-only";
import { XMLParser } from "fast-xml-parser";
import { eq } from "drizzle-orm";
import type { TenantDb } from "@jalajogja/db";
import { localDatetimeToUtcIso } from "@/lib/tenant-timezone";
import {
  decodeHtmlEntities, extractPathFromUrl, mapYoastSeo, resolvePrimaryCategory,
  type ParsedWordPressItem, type ParsedTaxonomyTerm, type ParsedWpAuthor,
} from "@/lib/wordpress-import-mapping";

// ── Validasi root element — version-tolerant (§ 2.1/§ 12.1) ───────────────────────────────
// Cek prefix namespace SAJA, jangan cocokkan versi persis (1.0/1.1/1.2) — dikonfirmasi sample
// real forbis.id pakai 1.2, hardcode 1.0 akan menolak file WXR modern manapun.
const WXR_NAMESPACE_PREFIX = "http://wordpress.org/export/";

export function isLikelyWxrFile(xmlText: string): boolean {
  // Cek cepat pada beberapa KB pertama SAJA (§ 12.1) — tolak dini sebelum full parse kalau
  // file yang diupload jelas bukan WXR.
  const head = xmlText.slice(0, 4000);
  return head.includes(WXR_NAMESPACE_PREFIX) && head.includes("<rss");
}

type XmlItem = Record<string, unknown>;

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function asString(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value);
}

// ── Hasil parsing ────────────────────────────────────────────────────────────────────────
export type WxrParseResult = {
  rows: ParsedWordPressItem[];
  parseErrors: string[]; // error level FILE (bukan per-baris) — mis. bukan WXR sama sekali
};

export async function parseWxrXml(
  xmlText: string,
  opts: { tenantDb: TenantDb; tenantTimezone: string },
): Promise<WxrParseResult> {
  if (!isLikelyWxrFile(xmlText)) {
    return { rows: [], parseErrors: ["File bukan format WXR WordPress yang dikenali."] };
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    isArray: (name) =>
      ["item", "wp:postmeta", "category", "wp:author", "wp:category"].includes(name),
  });

  let parsed: XmlItem;
  try {
    parsed = parser.parse(xmlText);
  } catch (err) {
    return { rows: [], parseErrors: [`Gagal parse XML: ${(err as Error).message}`] };
  }

  const channel = (parsed.rss as XmlItem | undefined)?.channel as XmlItem | undefined;
  if (!channel) {
    return { rows: [], parseErrors: ["Struktur XML tidak punya elemen <channel>."] };
  }

  const items = asArray<XmlItem>(channel.item as XmlItem[] | undefined);

  // ── Tahap 1 — index SEMUA attachment ke Map<wp_post_id, {url, alt}> (§ 2.1, WAJIB dua-tahap,
  // wp:post_parent TERBUKTI tidak bisa diandalkan dari sample real) ──────────────────────────
  const attachmentIndex = new Map<string, { url: string; alt: string | null }>();
  for (const item of items) {
    if (asString(item["wp:post_type"]) !== "attachment") continue;
    const wpPostId = asString(item["wp:post_id"]);
    const url = asString(item["wp:attachment_url"]).trim();
    if (!wpPostId || !url) continue;
    const postmetaArr = asArray<XmlItem>(item["wp:postmeta"] as XmlItem[] | undefined);
    const altMeta = postmetaArr.find((m) => asString(m["wp:meta_key"]) === "_wp_attachment_image_alt");
    attachmentIndex.set(wpPostId, { url, alt: asString(altMeta?.["wp:meta_value"]).trim() || null });
  }

  // ── Channel-level <wp:author> — resolve username → display name (§ 2.4, WXR hanya kasih
  // username per-item via <dc:creator>, nama tampilan cuma ada di daftar channel) ───────────
  const authorByUsername = new Map<string, ParsedWpAuthor>();
  for (const author of asArray<XmlItem>(channel["wp:author"] as XmlItem[] | undefined)) {
    const username = asString(author["wp:author_login"]);
    if (!username) continue;
    authorByUsername.set(username, {
      username,
      displayName: asString(author["wp:author_display_name"]).trim() || username,
      bio: null,       // tidak tersedia via WXR standar (§ 2.4)
      avatarUrl: null, // tidak tersedia via WXR standar (§ 2.4)
    });
  }

  // ── Channel-level <wp:category> — term_id → nama, untuk tie-breaker primary category ─────
  const termNameByWpTermId = new Map<string, string>();
  for (const cat of asArray<XmlItem>(channel["wp:category"] as XmlItem[] | undefined)) {
    const termId = asString(cat["wp:term_id"]);
    const name = asString(cat["wp:cat_name"]).trim();
    if (termId && name) termNameByWpTermId.set(termId, name);
  }

  // ── Tahap 2 — proses tiap item post/page ──────────────────────────────────────────────────
  const rows: ParsedWordPressItem[] = [];
  let rowNumber = 0;

  for (const item of items) {
    const wpPostType = asString(item["wp:post_type"]);
    if (wpPostType !== "post" && wpPostType !== "page") continue; // abaikan attachment/nav_menu_item/dll

    rowNumber += 1;
    const notes: string[] = [];

    const title = decodeHtmlEntities(asString(item.title).trim());
    const slugRaw = asString(item["wp:post_name"]).trim();
    const slug = slugRaw || title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    if (!slugRaw) notes.push("Slug tidak ada di WXR, dibuat otomatis dari judul.");

    const excerptRaw = asString(item["excerpt:encoded"]).trim();
    const excerpt = excerptRaw ? decodeHtmlEntities(excerptRaw) : null;

    const rawContentHtml = asString(item["content:encoded"]);

    // Tanggal (§ 6.2) — utamakan post_date_gmt (sudah UTC), fallback ke post_date lokal + timezone tenant
    const publishedAtIso = resolvePublishedAt(
      asString(item["wp:post_date_gmt"]),
      asString(item["wp:post_date"]),
      opts.tenantTimezone,
    );
    if (!publishedAtIso) notes.push("Tanggal publish tidak valid — perlu diisi manual setelah import.");

    // Taksonomi
    const categories: ParsedTaxonomyTerm[] = [];
    const tags: ParsedTaxonomyTerm[] = [];
    for (const cat of asArray<XmlItem>(item.category as XmlItem[] | undefined)) {
      const domain = asString(cat["@_domain"]);
      const nicename = asString(cat["@_nicename"]) || null;
      const name = decodeHtmlEntities(asString(cat["#text"] ?? cat).trim());
      if (!name) continue;
      if (domain === "category") categories.push({ name, slug: nicename });
      else if (domain === "post_tag") tags.push({ name, slug: nicename });
    }

    // Postmeta — Yoast SEO + isFeatured + viewCount + _thumbnail_id
    const postmetaArr = asArray<XmlItem>(item["wp:postmeta"] as XmlItem[] | undefined);
    const postmeta: Record<string, string> = {};
    for (const m of postmetaArr) {
      const key = asString(m["wp:meta_key"]);
      if (key) postmeta[key] = asString(m["wp:meta_value"]);
    }
    const seo = mapYoastSeo(postmeta);

    // Resolusi kategori utama (§ 4.1 tambahan) — HARUS dilakukan DI SINI (saat termNameByWpTermId
    // masih tersedia dari channel-level <wp:category>, Tahap 1) — bukan ditunda ke commit, karena
    // map ini tidak pernah di-return/persist ke luar fungsi ini. Kategori primary ditaruh di
    // index 0 — commitImportChunkAction cukup pakai categories[0] tanpa perlu tahu soal term map.
    const primary = resolvePrimaryCategory(categories, seo.primaryCategoryWpId, termNameByWpTermId);
    if (primary && categories[0] !== primary) {
      const idx = categories.indexOf(primary);
      categories.splice(idx, 1);
      categories.unshift(primary);
    }

    // Featured image — cross-reference _thumbnail_id ke attachment index (Tahap 1)
    const thumbnailId = postmeta["_thumbnail_id"];
    const featuredImage = thumbnailId ? attachmentIndex.get(thumbnailId) : undefined;

    // Penulis — <dc:creator> (username) → resolve ke channel-level <wp:author>
    const creatorUsername = asString(item["dc:creator"]).trim();
    const author: ParsedWpAuthor = authorByUsername.get(creatorUsername) ?? {
      username: creatorUsername || null,
      displayName: creatorUsername || null,
      bio: null,
      avatarUrl: null,
    };

    // Legacy URL (§ 5.5) — path dari <link>, untuk redirect nanti saat commit
    const legacyPath = extractPathFromUrl(asString(item.link).trim());

    // Deteksi duplikat slug (§ 3 Gap 3) — 1 query per row, tabel tergantung contentType
    const contentType: ParsedWordPressItem["contentType"] = wpPostType;
    const existingContentId = await findExistingContentBySlug(opts.tenantDb, contentType, slug);

    const status: ParsedWordPressItem["status"] = existingContentId
      ? "duplicate"
      : (publishedAtIso ? "ready" : "review_needed");

    rows.push({
      rowNumber,
      contentType,
      status,
      notes,
      wpPostId: Number(asString(item["wp:post_id"])) || null,
      title,
      slug,
      excerpt,
      rawContentHtml,
      publishedAtIso,
      categories,
      tags,
      author,
      featuredImageUrl: featuredImage?.url ?? null,
      featuredImageAlt: featuredImage?.alt ?? null,
      seo,
      legacyPath,
      existingContentId,
    });
  }

  return { rows, parseErrors: [] };
}

function resolvePublishedAt(postDateGmt: string, postDateLocal: string, tenantTimezone: string): string | null {
  const isValidGmt = postDateGmt && postDateGmt !== "0000-00-00 00:00:00";
  if (isValidGmt) {
    const iso = postDateGmt.replace(" ", "T") + "Z";
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  if (postDateLocal && postDateLocal !== "0000-00-00 00:00:00") {
    const truncated = postDateLocal.replace(" ", "T").slice(0, 16); // "YYYY-MM-DDTHH:mm"
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

// Diekspor (bukan private) — dipakai juga oleh wordpress-api-fetcher.server.ts. Query ke
// posts/pages tenant HARUS identik untuk kedua metode import (WXR & REST), tidak boleh
// divergen jadi 2 implementasi terpisah untuk hal yang sama.
export async function findExistingContentBySlug(
  tenantDb: TenantDb,
  contentType: "post" | "page",
  slug: string,
): Promise<string | null> {
  const { db, schema } = tenantDb;
  if (contentType === "post") {
    const [existing] = await db.select({ id: schema.posts.id }).from(schema.posts)
      .where(eq(schema.posts.slug, slug)).limit(1);
    return existing?.id ?? null;
  }
  const [existing] = await db.select({ id: schema.pages.id }).from(schema.pages)
    .where(eq(schema.pages.slug, slug)).limit(1);
  return existing?.id ?? null;
}
