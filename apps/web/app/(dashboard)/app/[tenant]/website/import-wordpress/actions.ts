"use server";

// Import Post/Page dari WordPress — docs/arsitektur-import-export-post-wordpress.md § 8 Fase 1.
// Pola file ini SAMA PERSIS dengan members/import/actions.ts (Importer Anggota): parse & simpan
// draft dulu (batch + rows di public.content_import_batches/_rows), admin review, baru commit
// per-chunk. Bedanya: dua metode SUMBER data (upload WXR vs pull REST API), dua action terpisah
// yang sama-sama menghasilkan bentuk penyimpanan draft yang identik.

import { db as publicDb, createTenantDb, contentImportBatches, contentImportBatchRows } from "@jalajogja/db";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { getTenantAccess, type TenantAccessResult } from "@/lib/tenant";
import { hasFullAccess } from "@/lib/permissions";
import { getTenantTimezone } from "@/lib/tenant-timezone.server";
import { parseWxrXml } from "@/lib/wordpress-xml-parser.server";
import { fetchWordPressContent } from "@/lib/wordpress-api-fetcher.server";
import { sanitizeGutenbergHtml, type ParsedWordPressItem, type ParsedWpAuthor } from "@/lib/wordpress-import-mapping";
import { downloadAndImportImage, rewriteInlineImages } from "@/lib/wordpress-image-import.server";
import { convertHtmlToTiptapJson } from "@/lib/wordpress-tiptap-convert.server";
import { resolvePostHrefs } from "@/lib/post-permalink.server";
import { createGuestPostAuthorAction } from "../post-authors-actions";

// ─── Ringkasan status batch — pola sama Importer Anggota's ImportSummary ────────────────────

export type WordPressImportSummary = {
  total: number;
  ready: number;
  reviewNeeded: number;
  duplicate: number;
};

function summarize(rows: ParsedWordPressItem[]): WordPressImportSummary {
  return {
    total: rows.length,
    ready: rows.filter((r) => r.status === "ready").length,
    reviewNeeded: rows.filter((r) => r.status === "review_needed").length,
    duplicate: rows.filter((r) => r.status === "duplicate").length,
  };
}

// ─── Simpan batch + rows sebagai draft (public.content_import_batches/_rows, § 14.2) ────────
// Pola SAMA PERSIS parseImportFileAction (Importer Anggota) — data JSONB simpan ParsedWordPressItem
// UTUH (dipakai lagi saat commit + untuk resume draft setelah reload).

async function persistDraftBatch(
  tenantId: string,
  importedByUserId: string,
  source: "wxr_upload" | "rest_api_pull",
  sourceLabel: { sourceUrl?: string; fileName?: string },
  rows: ParsedWordPressItem[],
): Promise<string> {
  const [batch] = await publicDb.insert(contentImportBatches).values({
    tenantId,
    source,
    sourceUrl: sourceLabel.sourceUrl ?? null,
    fileName: sourceLabel.fileName ?? null,
    importedByUserId,
    status: "draft",
    totalRows: rows.length,
  }).returning({ id: contentImportBatches.id });

  for (const row of rows) {
    await publicDb.insert(contentImportBatchRows).values({
      batchId: batch.id,
      rowNumber: row.rowNumber,
      contentType: row.contentType,
      title: row.title || null,
      wpPostId: row.wpPostId,
      status: row.status,
      data: row as unknown as Record<string, unknown>,
    });
  }

  return batch.id;
}

// ─── Metode 1: Upload File WXR (§ 2.1) ───────────────────────────────────────────────────────

export type ImportWxrResult =
  | { success: true; batchId: string; rows: ParsedWordPressItem[]; summary: WordPressImportSummary }
  | { success: false; error: string };

export async function importWxrFileAction(slug: string, formData: FormData): Promise<ImportWxrResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "website")) return { success: false, error: "Akses ditolak." };

  const file = formData.get("file");
  if (!(file instanceof File)) return { success: false, error: "File tidak ditemukan." };

  // Cap ukuran (§ 12.1) — tolak SEBELUM file dibaca penuh ke memory.
  const MAX_SIZE = 200 * 1024 * 1024; // 200 MB
  if (file.size > MAX_SIZE) return { success: false, error: "File terlalu besar (maksimal 200 MB)." };

  let xmlText: string;
  try {
    xmlText = await file.text();
  } catch {
    return { success: false, error: "Gagal membaca file." };
  }

  const tenantClient = createTenantDb(slug);
  const tenantTimezone = await getTenantTimezone(tenantClient);

  const { rows, parseErrors } = await parseWxrXml(xmlText, { tenantDb: tenantClient, tenantTimezone });
  if (parseErrors.length > 0) return { success: false, error: parseErrors.join(" ") };
  if (rows.length === 0) return { success: false, error: "Tidak ada Post/Page yang ditemukan di file ini." };

  const batchId = await persistDraftBatch(access.tenant.id, access.userId, "wxr_upload", { fileName: file.name }, rows);
  return { success: true, batchId, rows, summary: summarize(rows) };
}

// ─── Mapping Penulis WordPress → post_authors (§ 2.4) ────────────────────────────────────────
// Dipakai commitImportChunkAction (langkah berikutnya, belum ditulis) — private helper, BUKAN
// server action sendiri (tidak di-export, jadi tidak jadi entry Server Action meski file ini
// "use server"). Prinsip yang WAJIB diikuti (§ 2.4): displayAuthorId SAJA yang diisi dari sini,
// posts.authorId (internal, admin yang import) TIDAK PERNAH disentuh fungsi ini, editorId
// SELALU null untuk konten hasil import WordPress.

async function resolveOrCreateAuthor(
  slug: string,
  parsedAuthor: ParsedWpAuthor,
  cache: Map<string, string>, // nama (lowercase) → post_authors.id, di-thread sepanjang SATU batch commit
): Promise<string | null> {
  const name = parsedAuthor.displayName?.trim();
  if (!name) return null; // biarkan null — byline publik jatuh ke fallback default sistem (§ 2.4)

  const cacheKey = name.toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  // Antar batch/upload berulang (§ 2.4) — cek dulu apakah post_authors dengan nama YANG SAMA
  // (case-insensitive EXACT match, bukan pattern — sengaja pakai lower()=lower() bukan ilike()
  // supaya karakter % / _ di nama penulis WP tidak disalahartikan sebagai wildcard SQL) dan
  // tanpa memberId (member_id IS NULL, WP author bukan anggota IKPM) sudah ada di tenant ini
  // dari import SEBELUMNYA.
  const { db, schema } = createTenantDb(slug);
  const [existing] = await db
    .select({ id: schema.postAuthors.id })
    .from(schema.postAuthors)
    .where(and(
      sql`lower(${schema.postAuthors.name}) = lower(${name})`,
      isNull(schema.postAuthors.memberId),
    ))
    .limit(1);

  if (existing) {
    cache.set(cacheKey, existing.id);
    return existing.id;
  }

  // Belum ada — buat baru, REUSE createGuestPostAuthorAction() yang sudah ada (§ 2.4, WAJIB
  // tidak reimplementasi logic insert post_authors di sini).
  const result = await createGuestPostAuthorAction(slug, {
    name,
    bio: parsedAuthor.bio,
    avatarUrl: parsedAuthor.avatarUrl,
  });
  if (!result.success) return null; // gagal buat — biarkan null, TIDAK menggagalkan seluruh baris commit

  cache.set(cacheKey, result.data.id);
  return result.data.id;
}

// ─── Metode 2: Pull via REST API (§ 2.2) ─────────────────────────────────────────────────────

export type ImportRestResult =
  | { success: true; batchId: string; rows: ParsedWordPressItem[]; summary: WordPressImportSummary; fetchErrors: string[] }
  | { success: false; error: string };

export async function importRestApiAction(slug: string, siteUrl: string): Promise<ImportRestResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "website")) return { success: false, error: "Akses ditolak." };

  if (!siteUrl.trim()) return { success: false, error: "URL situs wajib diisi." };

  const tenantClient = createTenantDb(slug);
  const tenantTimezone = await getTenantTimezone(tenantClient);

  const { rows, fetchErrors } = await fetchWordPressContent(siteUrl.trim(), { tenantDb: tenantClient, tenantTimezone });
  if (rows.length === 0) {
    return {
      success: false,
      error: fetchErrors.length > 0 ? fetchErrors.join(" ") : "Tidak ada Post/Page yang ditemukan di situs ini.",
    };
  }

  const batchId = await persistDraftBatch(access.tenant.id, access.userId, "rest_api_pull", { sourceUrl: siteUrl.trim() }, rows);
  return { success: true, batchId, rows, summary: summarize(rows), fetchErrors };
}

// ─── Commit per-chunk (§ 13) — dipanggil berulang oleh client sampai done:true ──────────────
// Setiap panggilan: klaim atomic N baris 'ready', proses satu-satu (gambar+Sharp+Tiptap —
// BERAT, karena itu chunkSize KECIL), update status baris + counter batch, kembalikan progress.

// ─── Ambil status TERKINI seluruh baris batch (untuk laporan akhir per-baris di UI) ──────────

export type BatchRowStatus = {
  rowNumber: number;
  title: string | null;
  contentType: "post" | "page";
  status: string;
  errorMessage: string | null;
  createdContentId: string | null;
};

export type GetBatchRowsResult =
  | { success: true; rows: BatchRowStatus[] }
  | { success: false; error: string };

export async function getBatchRowsAction(slug: string, batchId: string): Promise<GetBatchRowsResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "website")) return { success: false, error: "Akses ditolak." };

  const [batch] = await publicDb.select({ id: contentImportBatches.id }).from(contentImportBatches)
    .where(and(eq(contentImportBatches.id, batchId), eq(contentImportBatches.tenantId, access.tenant.id)))
    .limit(1);
  if (!batch) return { success: false, error: "Batch tidak ditemukan." };

  const rows = await publicDb.select({
    rowNumber: contentImportBatchRows.rowNumber,
    title: contentImportBatchRows.title,
    contentType: contentImportBatchRows.contentType,
    status: contentImportBatchRows.status,
    errorMessage: contentImportBatchRows.errorMessage,
    createdContentId: contentImportBatchRows.createdContentId,
  }).from(contentImportBatchRows)
    .where(eq(contentImportBatchRows.batchId, batchId))
    .orderBy(contentImportBatchRows.rowNumber);

  return { success: true, rows };
}

export type CommitChunkResult =
  | { success: true; processed: number; total: number; done: boolean }
  | { success: false; error: string };

export async function commitImportChunkAction(
  slug: string,
  batchId: string,
  chunkSize = 10,
): Promise<CommitChunkResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "website")) return { success: false, error: "Akses ditolak." };

  const [batch] = await publicDb.select().from(contentImportBatches)
    .where(and(eq(contentImportBatches.id, batchId), eq(contentImportBatches.tenantId, access.tenant.id)))
    .limit(1);
  if (!batch) return { success: false, error: "Batch tidak ditemukan." };

  // 1. Cari kandidat baris 'ready' ATAU 'review_needed' — KEDUANYA aman di-commit (review_needed
  // cuma berarti tanggal publish tidak valid, notes-nya eksplisit bilang "perlu diisi manual
  // SETELAH import" — bukan blocker, commitOneRow sudah fallback ke NOW() untuk publishedAt).
  // HANYA 'duplicate' yang sengaja TIDAK PERNAH diklaim di sini — tidak ada strategi "merge"
  // untuk konten (beda dari member), slug yang sama artinya genuinely sudah ada, biarkan admin
  // yang putuskan manual (di luar scope MVP). 2-langkah (bukan raw SQL FOR UPDATE SKIP LOCKED):
  // SELECT kandidat dulu, lalu UPDATE dengan guard status masih salah satu dari dua nilai itu —
  // atomic per-row via MVCC Postgres biasa (UPDATE yang menabrak baris sama akan menunggu lalu
  // menemukan status sudah berubah, affecting 0 rows untuk baris itu). Cukup untuk skenario
  // realistis (satu admin, progress bar sekuensial) tanpa perlu SQL mentah.
  const claimableStatuses = ["ready", "review_needed"] as const;
  const candidates = await publicDb.select({ id: contentImportBatchRows.id })
    .from(contentImportBatchRows)
    .where(and(eq(contentImportBatchRows.batchId, batchId), inArray(contentImportBatchRows.status, claimableStatuses)))
    .orderBy(contentImportBatchRows.rowNumber)
    .limit(chunkSize);

  if (candidates.length > 0) {
    const candidateIds = candidates.map((c) => c.id);
    const claimedRows = await publicDb.update(contentImportBatchRows)
      .set({ status: "processing" })
      .where(and(inArray(contentImportBatchRows.id, candidateIds), inArray(contentImportBatchRows.status, claimableStatuses)))
      .returning();

    // Cache penulis di-thread SEPANJANG chunk ini (§ 2.4) — dedup dalam 1 chunk; dedup ANTAR
    // chunk/batch ditangani resolveOrCreateAuthor() sendiri via lookup cross-batch di DB.
    const authorCache = new Map<string, string>();

    for (const row of claimedRows) {
      try {
        const createdContentId = await commitOneRow(slug, access, row, batchId, authorCache);
        await publicDb.update(contentImportBatchRows)
          .set({ status: "inserted", createdContentId })
          .where(eq(contentImportBatchRows.id, row.id));
      } catch (err) {
        await publicDb.update(contentImportBatchRows)
          .set({ status: "error", errorMessage: err instanceof Error ? err.message : "Gagal memproses baris." })
          .where(eq(contentImportBatchRows.id, row.id));
      }
    }
  }

  // 2. Hitung ulang counter dari status TERKINI seluruh baris batch ini
  const [counts] = await publicDb.select({
    total: sql<number>`count(*)`,
    remaining: sql<number>`count(*) FILTER (WHERE status IN ('ready', 'review_needed', 'processing'))`,
    inserted: sql<number>`count(*) FILTER (WHERE status = 'inserted')`,
    errored: sql<number>`count(*) FILTER (WHERE status = 'error')`,
  }).from(contentImportBatchRows).where(eq(contentImportBatchRows.batchId, batchId));

  const total = Number(counts.total);
  const remaining = Number(counts.remaining);
  const processed = total - remaining;
  const done = remaining === 0;

  await publicDb.update(contentImportBatches).set({
    processedRows: processed,
    insertedRows: Number(counts.inserted),
    errorRows: Number(counts.errored),
    status: done ? "committed" : "committing",
    ...(done ? { committedAt: new Date() } : {}),
  }).where(eq(contentImportBatches.id, batchId));

  return { success: true, processed, total, done };
}

// Proses SATU baris — dipanggil dari loop di atas, error di sini di-tangkap pemanggil (tandai
// baris 'error', TIDAK menggagalkan baris lain dalam chunk yang sama).
async function commitOneRow(
  slug: string,
  access: TenantAccessResult,
  row: { id: string; rowNumber: number; contentType: "post" | "page"; data: unknown },
  importBatchId: string,
  authorCache: Map<string, string>,
): Promise<string> {
  const parsed = row.data as ParsedWordPressItem;
  const tenantClient = createTenantDb(slug);
  const { db, schema } = tenantClient;

  // 1. Featured image (§ 7.1) — kegagalan unduh TIDAK menggagalkan baris, coverId jadi null.
  let coverId: string | null = null;
  if (parsed.featuredImageUrl) {
    const imported = await downloadAndImportImage(slug, parsed.featuredImageUrl, parsed.featuredImageAlt, importBatchId);
    coverId = imported?.mediaId ?? null;
  }

  // 2. OG image (§ 4.1, dari Yoast _yoast_wpseo_opengraph-image) — ASET TERPISAH dari featured
  // image (dikonfirmasi § 15.2: bisa 2 gambar berbeda di post real).
  let ogImageId: string | null = null;
  if (parsed.seo.ogImageUrl) {
    const imported = await downloadAndImportImage(slug, parsed.seo.ogImageUrl, null, importBatchId);
    ogImageId = imported?.mediaId ?? null;
  }

  // 3. Tahap A (sanitasi) → rewrite gambar inline (§ 15.3, WAJIB sebelum Tahap B) → Tahap B (Tiptap)
  const sanitized = sanitizeGutenbergHtml(parsed.rawContentHtml);
  const rewritten = await rewriteInlineImages(slug, sanitized, importBatchId);
  const tiptapJson = await convertHtmlToTiptapJson(rewritten);
  if (!tiptapJson) {
    throw new Error("Gagal konversi konten ke format editor — perlu review manual.");
  }

  // 4. Kategori (post saja — pages tidak punya taksonomi, § 14.2) — categories[0] SUDAH primary
  // (parseWxrXml() sudah reorder saat parse, lihat wordpress-xml-parser.server.ts).
  let categoryId: string | null = null;
  let categorySlug: string | null = null;
  if (parsed.contentType === "post" && parsed.categories.length > 0) {
    const cat = await findOrCreateTaxonomy(slug, "category", parsed.categories[0].name, parsed.categories[0].slug);
    categoryId = cat.id;
    categorySlug = cat.slug;
  }

  // 5. Penulis (post saja, § 2.4) — reuse resolveOrCreateAuthor via cache per-chunk.
  let displayAuthorId: string | null = null;
  if (parsed.contentType === "post") {
    displayAuthorId = await resolveOrCreateAuthor(slug, parsed.author, authorCache);
  }

  // 6. URL final + canonicalUrl (§ 4.1/§ 5.5) — dihitung SEBELUM insert. Page selalu /{slug}
  // (tidak ada permalink variability untuk page, § 5.1). Post WAJIB ikut permalink structure
  // tenant SAAT INI (Fase 2.8) — resolvePostHrefs sama persis dipakai semua halaman publik
  // lain, supaya canonicalUrl/legacyUrlRedirects hasil import benar-benar sesuai mode yang
  // tenant pilih (mis. category_date_name — motivasi utama seluruh fitur import ini).
  const publishedAt = parsed.publishedAtIso ? new Date(parsed.publishedAtIso) : new Date();
  let finalPath: string;
  if (parsed.contentType === "post") {
    const [withHref] = await resolvePostHrefs(tenantClient, [{ slug: parsed.slug, categorySlug, publishedAt }]);
    finalPath = withHref.href;
  } else {
    finalPath = `/${parsed.slug}`;
  }

  let createdContentId: string;
  if (parsed.contentType === "post") {
    const [created] = await db.insert(schema.posts).values({
      slug: parsed.slug,
      title: parsed.title,
      excerpt: parsed.excerpt,
      content: tiptapJson,
      coverId,
      metaTitle: parsed.seo.metaTitle,
      metaDesc: parsed.seo.metaDesc,
      ogTitle: parsed.seo.ogTitle,
      ogDescription: parsed.seo.ogDescription,
      ogImageId,
      focusKeyword: parsed.seo.focusKeyword,
      canonicalUrl: finalPath,
      robots: parsed.seo.robots,
      schemaType: parsed.seo.schemaType,
      isFeatured: parsed.seo.isFeatured,
      viewCount: parsed.seo.viewCount,
      status: "published",
      authorId: access.tenantUser.id, // WAJIB admin yang import — internal, immutable (§ 2.4)
      displayAuthorId,
      editorId: null, // SELALU null untuk hasil import (§ 2.4)
      categoryId,
      publishedAt,
      importBatchId,
    }).returning({ id: schema.posts.id });
    createdContentId = created.id;

    for (const tag of parsed.tags) {
      const { id: tagId } = await findOrCreateTaxonomy(slug, "tag", tag.name, tag.slug);
      await db.insert(schema.postTagPivot).values({ postId: createdContentId, tagId }).onConflictDoNothing();
    }
  } else {
    const [created] = await db.insert(schema.pages).values({
      slug: parsed.slug,
      title: parsed.title,
      content: tiptapJson,
      coverId,
      metaTitle: parsed.seo.metaTitle,
      metaDesc: parsed.seo.metaDesc,
      ogTitle: parsed.seo.ogTitle,
      ogDescription: parsed.seo.ogDescription,
      ogImageId,
      focusKeyword: parsed.seo.focusKeyword,
      canonicalUrl: finalPath,
      robots: parsed.seo.robots,
      schemaType: "WebPage", // Page schema_type enum beda dari Post — hardcode default (§ 14.2)
      viewCount: parsed.seo.viewCount,
      status: "published",
      authorId: access.tenantUser.id, // Pages TIDAK dapat displayAuthorId/editorId (§ 14.2)
      publishedAt,
      importBatchId,
    }).returning({ id: schema.pages.id });
    createdContentId = created.id;
  }

  // 7. Legacy redirect (§ 5.5) — skip kalau path lama == path baru (hindari redirect loop percuma)
  if (parsed.legacyPath && parsed.legacyPath !== finalPath) {
    await db.insert(schema.legacyUrlRedirects).values({
      oldPath: parsed.legacyPath,
      redirectTo: finalPath,
      postId: createdContentId,
    }).onConflictDoNothing(); // old_path UNIQUE — aman diulang kalau retry
  }

  return createdContentId;
}

// Find-or-create kategori/tag by slug (WordPress nicename, fallback slug dari nama) — sengaja
// TANPA cache per-chunk (beda dari penulis) — jumlah kategori/tag biasanya sedikit, query per
// baris cukup murah, dan pemrosesan SEKUENSIAL (bukan Promise.all) di loop atas mencegah race
// antar-baris dalam satu chunk yang sama.
async function findOrCreateTaxonomy(
  slug: string,
  kind: "category" | "tag",
  name: string,
  wpSlug: string | null,
): Promise<{ id: string; slug: string }> {
  const { db, schema } = createTenantDb(slug);
  const table = kind === "category" ? schema.postCategories : schema.postTags;
  const taxonomySlug = wpSlug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

  const [existing] = await db.select({ id: table.id }).from(table)
    .where(eq(table.slug, taxonomySlug)).limit(1);
  if (existing) return { id: existing.id, slug: taxonomySlug };

  const [created] = await db.insert(table).values({ slug: taxonomySlug, name }).returning({ id: table.id });
  return { id: created.id, slug: taxonomySlug };
}

// ─── Rollback via soft bulk-archive (§ 14.1) ─────────────────────────────────────────────────
// TIDAK PERNAH hard-delete — set status='archived' untuk SEMUA post/page yang berasal dari
// batch ini (via import_batch_id). post_authors yang di-find-or-create SELAMA batch TIDAK
// PERNAH disentuh (resource shared, bisa dipakai post lain di luar batch ini). Media juga
// TIDAK disentuh — tidak ada konsep status di tabel media, dan file tetap valid dipakai post
// yang sekarang archived (bisa di-published lagi manual tanpa kehilangan gambar).

export type ArchiveBatchResult =
  | { success: true; archivedPosts: number; archivedPages: number }
  | { success: false; error: string };

export async function archiveImportBatchAction(slug: string, batchId: string): Promise<ArchiveBatchResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "website")) return { success: false, error: "Akses ditolak." };

  const [batch] = await publicDb.select().from(contentImportBatches)
    .where(and(eq(contentImportBatches.id, batchId), eq(contentImportBatches.tenantId, access.tenant.id)))
    .limit(1);
  if (!batch) return { success: false, error: "Batch tidak ditemukan." };
  if (batch.status !== "committed") {
    return { success: false, error: "Batch ini belum selesai di-commit — tidak ada yang bisa diarsipkan." };
  }

  const { db, schema } = createTenantDb(slug);

  const archivedPostRows = await db.update(schema.posts)
    .set({ status: "archived" })
    .where(and(eq(schema.posts.importBatchId, batchId), sql`${schema.posts.status} != 'archived'`))
    .returning({ id: schema.posts.id });

  const archivedPageRows = await db.update(schema.pages)
    .set({ status: "archived" })
    .where(and(eq(schema.pages.importBatchId, batchId), sql`${schema.pages.status} != 'archived'`))
    .returning({ id: schema.pages.id });

  await publicDb.update(contentImportBatches)
    .set({ archivedAt: new Date() })
    .where(eq(contentImportBatches.id, batchId));

  return { success: true, archivedPosts: archivedPostRows.length, archivedPages: archivedPageRows.length };
}
