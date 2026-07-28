// Fase 3 (docs/arsitektur-import-export-post-wordpress.md § 2.3, § 8) — Export Post Jalakarta
// ke format WordPress WXR (WordPress eXtended RSS) XML, agar tenant tidak merasa terkunci
// (vendor lock-in) dan bisa migrasi balik ke WordPress kapan saja via Tools -> Import ->
// WordPress. Scope SENGAJA hanya Posts (bukan Pages/Produk/Donasi/Event) — sama persis scope
// § 2.3 dokumen, dan sama dengan fokus keseluruhan fitur import (dikonfirmasi user).
//
// Struktur XML diverifikasi terhadap 2 sample WXR real (docs/template/contoh-xml.xml,
// wordpress-xml-forbis.xml) yang sudah dipakai sepanjang Fase 0/1 untuk membangun importer —
// exporter ini pada dasarnya adalah cermin terbalik dari `wordpress-xml-parser.server.ts`.
//
// Keputusan desain yang dikunci:
// - Semua status post (draft/published/archived) diikutkan (bukan cuma published) — konsisten
//   prinsip "anti vendor lock-in": admin harus bisa membawa SEMUA datanya, bukan cuma yang live.
//   archived -> dipetakan ke WP "draft" (WordPress tidak punya status "archived" native).
// - `<dc:creator>` SELALU dari `post_authors.name` (via displayAuthorId) — TIDAK PERNAH dari
//   `posts.authorId` (internal/immutable, admin yang membuat draft, tidak relevan untuk
//   konsumsi eksternal). Post tanpa displayAuthorId -> fallback username sintetis "admin".
// - `posts.editorId` TIDAK diekspor sama sekali — WordPress tidak punya konsep Editor byline
//   yang setara via WXR (keputusan sama seperti docs/arsitektur-seo.md § 6b.4).
// - `posts.canonicalUrl` TIDAK diekspor ke `_yoast_wpseo_canonical` — canonical lama menunjuk ke
//   situs Jalakarta asal, bukan situs WordPress tujuan; membiarkan Yoast di situs baru
//   menghitung canonical-nya sendiri lebih aman daripada mewariskan nilai yang salah konteks.
// - Featured image (`coverId`) diekspor sebagai <item post_type="attachment"> terpisah +
//   postmeta `_thumbnail_id` menunjuk ke situ (pola WXR standar). OG image (`ogImageId`, kalau
//   beda dari coverId) diekspor sebagai URL string di `_yoast_wpseo_opengraph-image` saja
//   (Yoast's key ini memang berisi URL, bukan attachment ID) — tidak perlu attachment terpisah.
// - Tag TIDAK dideklarasikan sebagai <wp:tag> di level channel (dikonfirmasi: WordPress sendiri
//   tidak selalu melakukan ini di sample real kita) — cukup inline
//   <category domain="post_tag" nicename="..."> per item, importer WordPress standar otomatis
//   membuat term baru dari deklarasi inline ini.
// - Link internal "Baca Juga" (RelatedLinkBlock) yang tersimpan path-mode ("/{slug}/post/...")
//   TIDAK di-absolute-kan saat render body (RenderContext tidak diberi tenantSlug/baseUrl) —
//   keterbatasan yang diterima untuk V1, konten utama (isi artikel + gambar) tetap benar.

import "server-only";
import { createTenantDb } from "@jalajogja/db";
import { asc, inArray } from "drizzle-orm";
import { getTenantSeoBase } from "./tenant-seo";
import { getTenantTimezone } from "./tenant-timezone.server";
import { resolvePostHrefs } from "./post-permalink.server";
import { renderBody } from "./letter-render";
import { resolveMediaUrl } from "./minio";

// ── Helpers murni: escaping, tanggal, format WXR ────────────────────────────

function cdata(value: string | null | undefined): string {
  const v = (value ?? "").toString();
  // WordPress convention untuk literal "]]>" di dalam CDATA: pecah jadi 2 CDATA section.
  return `<![CDATA[${v.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}

function xmlAttrEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// "YYYY-MM-DD HH:MM:SS" di timezone tenant — untuk <wp:post_date>/<wp:post_modified>.
function formatWxrLocal(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

// "YYYY-MM-DD HH:MM:SS" UTC — untuk <wp:post_date_gmt>/<wp:post_modified_gmt>.
function formatWxrGmt(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

// RFC 2822, selalu GMT+0000 — untuk <pubDate> (konvensi RSS, dikonfirmasi dari sample real).
function formatWxrPubDate(date: Date): string {
  return date.toUTCString().replace("GMT", "+0000");
}

const STATUS_TO_WP: Record<string, string> = {
  published: "publish",
  draft:     "draft",
  archived:  "draft",
};

// Username sintetis stabil per post_authors.id — WXR hanya butuh <dc:creator> berupa
// username yang bisa di-resolve via <wp:author><wp:author_login> di level channel; kita
// kontrol kedua ujung referensi ini sendiri jadi aman memakai skema penamaan sendiri.
function slugifyAuthorUsername(name: string, index: number): string {
  const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return base ? `${base}-${index}` : `penulis-${index}`;
}

// ── Generator utama ──────────────────────────────────────────────────────────

export async function generateWxrExport(slug: string): Promise<string> {
  const tenantClient = createTenantDb(slug);
  const { db, schema } = tenantClient;

  const [seoBase, timezone] = await Promise.all([
    getTenantSeoBase(slug),
    getTenantTimezone(tenantClient),
  ]);

  const [categories, tags, authorsRows, posts] = await Promise.all([
    db.select().from(schema.postCategories).orderBy(asc(schema.postCategories.name)),
    db.select().from(schema.postTags).orderBy(asc(schema.postTags.name)),
    db.select().from(schema.postAuthors),
    db.select().from(schema.posts).orderBy(asc(schema.posts.createdAt)),
  ]);

  const postIds = posts.map((p) => p.id);
  const pivotRows = postIds.length > 0
    ? await db.select().from(schema.postTagPivot).where(inArray(schema.postTagPivot.postId, postIds))
    : [];
  const tagsByPost = new Map<string, string[]>();
  for (const row of pivotRows) {
    const arr = tagsByPost.get(row.postId) ?? [];
    arr.push(row.tagId);
    tagsByPost.set(row.postId, arr);
  }

  const mediaIds = [...new Set(
    posts.flatMap((p) => [p.coverId, p.ogImageId]).filter((x): x is string => !!x),
  )];
  const mediaRows = mediaIds.length > 0
    ? await db.select().from(schema.media).where(inArray(schema.media.id, mediaIds))
    : [];
  const mediaMap = new Map(mediaRows.map((m) => [m.id, m]));

  // href relatif per post (menghormati permalink_structure tenant) -> dijadikan <link> absolut.
  const postsWithHref = await resolvePostHrefs(
    tenantClient,
    posts.map((p) => ({
      slug:         p.slug,
      categorySlug: categories.find((c) => c.id === p.categoryId)?.slug ?? null,
      publishedAt:  p.publishedAt,
    })),
  );

  // ── Mapping sintetis: author username + term_id kategori + post_id (shared counter posts+media) ──
  const authorUsernameMap = new Map<string, string>(); // post_authors.id -> username sintetis
  authorsRows.forEach((a, i) => authorUsernameMap.set(a.id, slugifyAuthorUsername(a.name, i + 1)));
  const needsFallbackAdmin = posts.some((p) => !p.displayAuthorId);

  const categoryTermId = new Map<string, number>();
  categories.forEach((c, i) => categoryTermId.set(c.id, i + 1));

  let postIdCounter = 1000;
  const postSyntheticId = new Map<string, number>();
  for (const p of posts) postSyntheticId.set(p.id, postIdCounter++);
  const mediaSyntheticId = new Map<string, number>();
  for (const m of mediaRows) mediaSyntheticId.set(m.id, postIdCounter++);

  const imageBaseUrl = `${process.env.MINIO_PUBLIC_URL ?? "https://minio.jalakarta.com"}/tenant-${slug}`;

  // ── <wp:author> blocks ──
  const authorBlockList = authorsRows.map((a) => {
    const username = authorUsernameMap.get(a.id)!;
    const parts     = a.name.trim().split(/\s+/).filter(Boolean);
    const firstName = parts[0] ?? a.name;
    const lastName  = parts.slice(1).join(" ");
    return [
      `\t<wp:author>`,
      `<wp:author_id>${authorsRows.indexOf(a) + 1}</wp:author_id>`,
      `<wp:author_login>${cdata(username)}</wp:author_login>`,
      `<wp:author_email>${cdata(`${username}@imported.invalid`)}</wp:author_email>`,
      `<wp:author_display_name>${cdata(a.name)}</wp:author_display_name>`,
      `<wp:author_first_name>${cdata(firstName)}</wp:author_first_name>`,
      `<wp:author_last_name>${cdata(lastName)}</wp:author_last_name>`,
      `</wp:author>`,
    ].join("");
  });
  if (needsFallbackAdmin) {
    authorBlockList.push([
      `\t<wp:author>`,
      `<wp:author_id>0</wp:author_id>`,
      `<wp:author_login>${cdata("admin")}</wp:author_login>`,
      `<wp:author_email>${cdata("admin@imported.invalid")}</wp:author_email>`,
      `<wp:author_display_name>${cdata(seoBase.siteName)}</wp:author_display_name>`,
      `<wp:author_first_name>${cdata("")}</wp:author_first_name>`,
      `<wp:author_last_name>${cdata("")}</wp:author_last_name>`,
      `</wp:author>`,
    ].join(""));
  }
  const authorBlocks = authorBlockList.join("\n");

  // ── <wp:category> blocks ──
  const categoryBlocks = categories.map((c) => {
    const parentSlug = c.parentId ? categories.find((x) => x.id === c.parentId)?.slug ?? "" : "";
    return [
      `\t<wp:category>`,
      `\n\t\t<wp:term_id>${categoryTermId.get(c.id)}</wp:term_id>`,
      `\n\t\t<wp:category_nicename>${cdata(c.slug)}</wp:category_nicename>`,
      `\n\t\t<wp:category_parent>${cdata(parentSlug)}</wp:category_parent>`,
      `\n\t\t<wp:cat_name>${cdata(c.name)}</wp:cat_name>`,
      `\n\t</wp:category>`,
    ].join("");
  }).join("\n");

  // ── <item> post blocks ──
  const postItems = posts.map((p, idx) => {
    const withHref = postsWithHref[idx];
    const link      = `${seoBase.baseUrl}${withHref.href}`;
    const wpStatus  = STATUS_TO_WP[p.status] ?? "draft";
    const published = p.publishedAt ? new Date(p.publishedAt) : new Date(p.createdAt);
    const modified  = new Date(p.updatedAt);

    const contentHtml = renderBody(p.content, { imageBaseUrl });

    const authorUsername = p.displayAuthorId
      ? authorUsernameMap.get(p.displayAuthorId) ?? "admin"
      : "admin";

    const category = p.categoryId ? categories.find((c) => c.id === p.categoryId) : undefined;
    const categoryTag = category
      ? `\t\t<category domain="category" nicename="${xmlAttrEscape(category.slug)}">${cdata(category.name)}</category>\n`
      : "";

    const tagIds  = tagsByPost.get(p.id) ?? [];
    const tagTags = tagIds.map((tid) => {
      const tag = tags.find((t) => t.id === tid);
      if (!tag) return "";
      return `\t\t<category domain="post_tag" nicename="${xmlAttrEscape(tag.slug)}">${cdata(tag.name)}</category>\n`;
    }).join("");

    const metaEntries: [string, string][] = [];
    if (p.metaTitle)      metaEntries.push(["_yoast_wpseo_title", p.metaTitle]);
    if (p.metaDesc)        metaEntries.push(["_yoast_wpseo_metadesc", p.metaDesc]);
    if (p.ogTitle)         metaEntries.push(["_yoast_wpseo_opengraph-title", p.ogTitle]);
    if (p.ogDescription)  metaEntries.push(["_yoast_wpseo_opengraph-description", p.ogDescription]);
    if (p.focusKeyword)   metaEntries.push(["_yoast_wpseo_focuskw", p.focusKeyword]);
    if (p.categoryId && categoryTermId.has(p.categoryId)) {
      metaEntries.push(["_yoast_wpseo_primary_category", String(categoryTermId.get(p.categoryId))]);
    }
    if (p.robots.includes("noindex")) metaEntries.push(["_yoast_wpseo_meta-robots-noindex", "1"]);
    if (p.robots === "noindex,nofollow") metaEntries.push(["_yoast_wpseo_meta-robots-nofollow", "1"]);
    metaEntries.push(["wpb_post_views_count", String(p.viewCount)]);
    if (p.coverId && mediaSyntheticId.has(p.coverId)) {
      metaEntries.push(["_thumbnail_id", String(mediaSyntheticId.get(p.coverId))]);
    }
    if (p.ogImageId) {
      const ogMedia = mediaMap.get(p.ogImageId);
      if (ogMedia) {
        metaEntries.push([
          "_yoast_wpseo_opengraph-image",
          resolveMediaUrl(slug, ogMedia.path, ogMedia.variants, ["large", "original"]),
        ]);
      }
    }
    const postMetaBlocks = metaEntries.map(([k, v]) =>
      `\t\t<wp:postmeta>\n\t\t\t<wp:meta_key>${cdata(k)}</wp:meta_key>\n\t\t\t<wp:meta_value>${cdata(v)}</wp:meta_value>\n\t\t</wp:postmeta>\n`,
    ).join("");

    return [
      `\t<item>`,
      `\n\t\t<title>${cdata(p.title)}</title>`,
      `\n\t\t<link>${xmlAttrEscape(link)}</link>`,
      `\n\t\t<pubDate>${formatWxrPubDate(published)}</pubDate>`,
      `\n\t\t<dc:creator>${cdata(authorUsername)}</dc:creator>`,
      `\n\t\t<guid isPermaLink="false">${xmlAttrEscape(link)}</guid>`,
      `\n\t\t<description></description>`,
      `\n\t\t<content:encoded>${cdata(contentHtml)}</content:encoded>`,
      `\n\t\t<excerpt:encoded>${cdata(p.excerpt ?? "")}</excerpt:encoded>`,
      `\n\t\t<wp:post_id>${postSyntheticId.get(p.id)}</wp:post_id>`,
      `\n\t\t<wp:post_date>${cdata(formatWxrLocal(published, timezone))}</wp:post_date>`,
      `\n\t\t<wp:post_date_gmt>${cdata(formatWxrGmt(published))}</wp:post_date_gmt>`,
      `\n\t\t<wp:post_modified>${cdata(formatWxrLocal(modified, timezone))}</wp:post_modified>`,
      `\n\t\t<wp:post_modified_gmt>${cdata(formatWxrGmt(modified))}</wp:post_modified_gmt>`,
      `\n\t\t<wp:comment_status>${cdata("closed")}</wp:comment_status>`,
      `\n\t\t<wp:ping_status>${cdata("closed")}</wp:ping_status>`,
      `\n\t\t<wp:post_name>${cdata(p.slug)}</wp:post_name>`,
      `\n\t\t<wp:status>${cdata(wpStatus)}</wp:status>`,
      `\n\t\t<wp:post_parent>0</wp:post_parent>`,
      `\n\t\t<wp:menu_order>0</wp:menu_order>`,
      `\n\t\t<wp:post_type>${cdata("post")}</wp:post_type>`,
      `\n\t\t<wp:post_password>${cdata("")}</wp:post_password>`,
      `\n\t\t<wp:is_sticky>${p.isFeatured ? 1 : 0}</wp:is_sticky>`,
      `\n${categoryTag}${tagTags}${postMetaBlocks}\t</item>`,
    ].join("");
  }).join("\n");

  // ── <item post_type="attachment"> blocks (hanya media yang jadi featured image / coverId) ──
  const coverMediaIds = new Set(posts.map((p) => p.coverId).filter((x): x is string => !!x));
  const attachmentItems = mediaRows
    .filter((m) => coverMediaIds.has(m.id))
    .map((m) => {
      const url     = resolveMediaUrl(slug, m.path, m.variants, ["original", "large"]);
      const created = new Date(m.createdAt);
      const altMeta = m.altText
        ? `\n\t\t<wp:postmeta>\n\t\t\t<wp:meta_key>${cdata("_wp_attachment_image_alt")}</wp:meta_key>\n\t\t\t<wp:meta_value>${cdata(m.altText)}</wp:meta_value>\n\t\t</wp:postmeta>`
        : "";
      return [
        `\t<item>`,
        `\n\t\t<title>${cdata(m.title || m.originalName)}</title>`,
        `\n\t\t<link>${xmlAttrEscape(url)}</link>`,
        `\n\t\t<pubDate>${formatWxrPubDate(created)}</pubDate>`,
        `\n\t\t<dc:creator>${cdata("admin")}</dc:creator>`,
        `\n\t\t<guid isPermaLink="false">${xmlAttrEscape(url)}</guid>`,
        `\n\t\t<description></description>`,
        `\n\t\t<content:encoded>${cdata("")}</content:encoded>`,
        `\n\t\t<excerpt:encoded>${cdata("")}</excerpt:encoded>`,
        `\n\t\t<wp:post_id>${mediaSyntheticId.get(m.id)}</wp:post_id>`,
        `\n\t\t<wp:post_date>${cdata(formatWxrLocal(created, timezone))}</wp:post_date>`,
        `\n\t\t<wp:post_date_gmt>${cdata(formatWxrGmt(created))}</wp:post_date_gmt>`,
        `\n\t\t<wp:post_modified>${cdata(formatWxrLocal(created, timezone))}</wp:post_modified>`,
        `\n\t\t<wp:post_modified_gmt>${cdata(formatWxrGmt(created))}</wp:post_modified_gmt>`,
        `\n\t\t<wp:comment_status>${cdata("closed")}</wp:comment_status>`,
        `\n\t\t<wp:ping_status>${cdata("closed")}</wp:ping_status>`,
        `\n\t\t<wp:post_name>${cdata(m.filename.replace(/\.[^.]+$/, ""))}</wp:post_name>`,
        `\n\t\t<wp:status>${cdata("inherit")}</wp:status>`,
        `\n\t\t<wp:post_parent>0</wp:post_parent>`,
        `\n\t\t<wp:menu_order>0</wp:menu_order>`,
        `\n\t\t<wp:post_type>${cdata("attachment")}</wp:post_type>`,
        `\n\t\t<wp:post_password>${cdata("")}</wp:post_password>`,
        `\n\t\t<wp:is_sticky>0</wp:is_sticky>`,
        `\n\t\t<wp:attachment_url>${cdata(url)}</wp:attachment_url>${altMeta}`,
        `\n\t</item>`,
      ].join("");
    });

  const now = new Date();
  const channelDescription = seoBase.tagline ?? seoBase.description ?? "";

  return `<?xml version="1.0" encoding="UTF-8" ?>
<!-- This is a WordPress eXtended RSS file generated by Jalakarta as an export of your site's Posts. -->
<!-- You may use this file to transfer content from Jalakarta to a WordPress site. -->

<rss version="2.0"
\txmlns:excerpt="http://wordpress.org/export/1.2/excerpt/"
\txmlns:content="http://purl.org/rss/1.0/modules/content/"
\txmlns:wfw="http://wellformedweb.org/CommentAPI/"
\txmlns:dc="http://purl.org/dc/elements/1.1/"
\txmlns:wp="http://wordpress.org/export/1.2/"
>

<channel>
\t<title>${cdata(seoBase.siteName)}</title>
\t<link>${xmlAttrEscape(seoBase.baseUrl)}</link>
\t<description>${cdata(channelDescription)}</description>
\t<pubDate>${formatWxrPubDate(now)}</pubDate>
\t<language>id</language>
\t<wp:wxr_version>1.2</wp:wxr_version>
\t<wp:base_site_url>${cdata(seoBase.baseUrl)}</wp:base_site_url>
\t<wp:base_blog_url>${cdata(seoBase.baseUrl)}</wp:base_blog_url>

${authorBlocks}

${categoryBlocks}

${postItems}${attachmentItems.length > 0 ? "\n" + attachmentItems.join("\n") : ""}
</channel>
</rss>
`;
}
