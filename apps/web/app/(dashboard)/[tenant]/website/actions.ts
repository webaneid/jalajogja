"use server";

import { eq, and, inArray, count } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { generateSlug } from "@/lib/seo";
import type { ContentStatus, PostTwitterCard, PostRobots, PostSchemaType, PageSchemaType } from "@jalajogja/db";

// ─── Types ─────────────────────────────────────────────────────────────────

type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export type PostFormData = {
  title: string;
  slug?: string;
  excerpt?: string;
  content?: string | null;
  coverId?: string | null;
  categoryId?: string | null;
  status?: ContentStatus;
  publishedAt?: string | null;        // ISO string atau null
  // Tags
  tagIds?: string[];                  // UUID[] — pivot dikelola action
  // SEO
  metaTitle?: string;
  metaDesc?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImageId?: string | null;
  twitterCard?: PostTwitterCard;
  focusKeyword?: string;
  canonicalUrl?: string;
  robots?: PostRobots;
  schemaType?: PostSchemaType;
  structuredData?: string | null;     // JSON string atau null
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Parse structuredData: JSON string → object, invalid/kosong → null */
function parseStructuredData(raw?: string | null): object | null {
  if (!raw || raw.trim() === "") return null;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

/** Slug unik: pakai user input jika ada, generate dari title, atau fallback UUID */
function resolveSlug(title: string, slugInput?: string): string {
  if (slugInput?.trim()) return generateSlug(slugInput.trim());
  if (title.trim()) return generateSlug(title.trim());
  return crypto.randomUUID().slice(0, 8);
}

// ─── CREATE DRAFT (pre-create) ───────────────────────────────────────────────

/**
 * Buat post draft kosong dengan slug temp → redirect ke halaman edit.
 * Judul sementara bisa dikirim dari client (dari dialog input), atau kosong.
 */
export async function createPostDraftAction(
  slug: string,
  title = "Judul Sementara"
): Promise<ActionResult<{ postId: string }>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };

  const { db, schema } = createTenantDb(slug);

  // Buat slug unik — tambah suffix UUID jika slug title sudah ada
  let postSlug = resolveSlug(title);
  const [existing] = await db
    .select({ id: schema.posts.id })
    .from(schema.posts)
    .where(eq(schema.posts.slug, postSlug))
    .limit(1);

  if (existing) {
    postSlug = `${postSlug}-${crypto.randomUUID().slice(0, 6)}`;
  }

  try {
    const [post] = await db
      .insert(schema.posts)
      .values({
        title: title.trim() || "Judul Sementara",
        slug:     postSlug,
        status:   "draft",
        authorId: access.tenantUser.id,
      })
      .returning({ id: schema.posts.id });

    revalidatePath(`/${slug}/website/posts`);
    return { success: true, data: { postId: post.id } };

  } catch (err) {
    console.error("[createPostDraftAction]", err);
    return { success: false, error: "Gagal membuat draft." };
  }
}

// ─── UPDATE POST ─────────────────────────────────────────────────────────────

export async function updatePostAction(
  slug: string,
  postId: string,
  data: PostFormData
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };

  if (!data.title?.trim()) {
    return { success: false, error: "Judul post wajib diisi." };
  }

  const { db, schema } = createTenantDb(slug);

  // Pastikan post ada di tenant ini
  const [existing] = await db
    .select({ id: schema.posts.id, slug: schema.posts.slug })
    .from(schema.posts)
    .where(eq(schema.posts.id, postId))
    .limit(1);

  if (!existing) return { success: false, error: "Post tidak ditemukan." };

  // Tentukan slug baru — cek duplikasi hanya jika slug berubah
  const newSlug = resolveSlug(data.title, data.slug);
  if (newSlug !== existing.slug) {
    const [duplicate] = await db
      .select({ id: schema.posts.id })
      .from(schema.posts)
      .where(eq(schema.posts.slug, newSlug))
      .limit(1);

    if (duplicate && duplicate.id !== postId) {
      return { success: false, error: "Slug sudah dipakai post lain." };
    }
  }

  // publishedAt: set ke now() saat pertama publish, null saat unpublish/archive
  let publishedAt: Date | null = null;
  if (data.status === "published") {
    publishedAt = data.publishedAt ? new Date(data.publishedAt) : new Date();
  }

  try {
    // ── Update post ──────────────────────────────────────────────────────────
    await db
      .update(schema.posts)
      .set({
        title:    data.title.trim(),
        slug:     newSlug,
        excerpt:  data.excerpt?.trim() || null,
        content:  data.content ?? null,
        coverId:  data.coverId ?? null,
        categoryId: data.categoryId ?? null,
        status:   data.status ?? "draft",
        publishedAt,
        // SEO dasar
        metaTitle: data.metaTitle?.trim() || null,
        metaDesc:  data.metaDesc?.trim()  || null,
        // Open Graph
        ogTitle:       data.ogTitle?.trim()       || null,
        ogDescription: data.ogDescription?.trim() || null,
        ogImageId:     data.ogImageId ?? null,
        // Advanced
        twitterCard:    data.twitterCard    ?? "summary_large_image",
        focusKeyword:   data.focusKeyword?.trim()  || null,
        canonicalUrl:   data.canonicalUrl?.trim()  || null,
        robots:         data.robots         ?? "index,follow",
        schemaType:     data.schemaType     ?? "Article",
        structuredData: parseStructuredData(data.structuredData),
        updatedAt: new Date(),
      })
      .where(eq(schema.posts.id, postId));

    // ── Sync tags (replace-all diff) ─────────────────────────────────────────
    const incomingTagIds = data.tagIds ?? [];

    const currentPivots = await db
      .select({ tagId: schema.postTagPivot.tagId })
      .from(schema.postTagPivot)
      .where(eq(schema.postTagPivot.postId, postId));

    const currentTagIds = currentPivots.map((p) => p.tagId);
    const toRemove = currentTagIds.filter((id) => !incomingTagIds.includes(id));
    const toAdd    = incomingTagIds.filter((id) => !currentTagIds.includes(id));

    if (toRemove.length > 0) {
      await db
        .delete(schema.postTagPivot)
        .where(
          and(
            eq(schema.postTagPivot.postId, postId),
            inArray(schema.postTagPivot.tagId, toRemove)
          )
        );
    }

    if (toAdd.length > 0) {
      await db
        .insert(schema.postTagPivot)
        .values(toAdd.map((tagId) => ({ postId, tagId })));
    }

    revalidatePath(`/${slug}/website/posts`);
    revalidatePath(`/${slug}/website/posts/${postId}/edit`);
    return { success: true, data: undefined };

  } catch (err) {
    console.error("[updatePostAction]", err);
    const msg = err instanceof Error ? err.message : "Gagal menyimpan.";
    if (msg.includes("posts_slug_unique")) {
      return { success: false, error: "Slug sudah dipakai post lain." };
    }
    return { success: false, error: `Gagal: ${msg}` };
  }
}

// ─── UPDATE STATUS (quick publish / unpublish) ───────────────────────────────

export async function updatePostStatusAction(
  slug: string,
  postId: string,
  status: ContentStatus
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };

  const { db, schema } = createTenantDb(slug);

  const [existing] = await db
    .select({ id: schema.posts.id, publishedAt: schema.posts.publishedAt })
    .from(schema.posts)
    .where(eq(schema.posts.id, postId))
    .limit(1);

  if (!existing) return { success: false, error: "Post tidak ditemukan." };

  // Pertahankan tanggal publish pertama — jangan overwrite saat republish
  const publishedAt =
    status === "published"
      ? (existing.publishedAt ?? new Date())
      : null;

  try {
    await db
      .update(schema.posts)
      .set({ status, publishedAt, updatedAt: new Date() })
      .where(eq(schema.posts.id, postId));

    revalidatePath(`/${slug}/website/posts`);
    revalidatePath(`/${slug}/website/posts/${postId}/edit`);
    return { success: true, data: undefined };

  } catch (err) {
    console.error("[updatePostStatusAction]", err);
    return { success: false, error: "Gagal mengubah status." };
  }
}

// ─── DELETE ──────────────────────────────────────────────────────────────────

export async function deletePostAction(
  slug: string,
  postId: string
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };

  const { db, schema } = createTenantDb(slug);

  const [existing] = await db
    .select({ id: schema.posts.id })
    .from(schema.posts)
    .where(eq(schema.posts.id, postId))
    .limit(1);

  if (!existing) return { success: false, error: "Post tidak ditemukan." };

  try {
    // Hapus pivot dulu — FK tanpa CASCADE di Drizzle schema level
    await db
      .delete(schema.postTagPivot)
      .where(eq(schema.postTagPivot.postId, postId));

    await db
      .delete(schema.posts)
      .where(eq(schema.posts.id, postId));

    revalidatePath(`/${slug}/website/posts`);
    return { success: true, data: undefined };

  } catch (err) {
    console.error("[deletePostAction]", err);
    return { success: false, error: "Gagal menghapus post." };
  }
}

// ════════════════════════════════════════════════════════════════════════════
// PAGES — halaman statis (Tentang, Kontak, dll)
// ════════════════════════════════════════════════════════════════════════════

export type PageFormData = {
  title: string;
  slug?: string;
  content?: string | null;
  coverId?: string | null;
  order?: number;
  status?: ContentStatus;
  publishedAt?: string | null;
  // SEO
  metaTitle?: string;
  metaDesc?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImageId?: string | null;
  twitterCard?: "summary" | "summary_large_image";
  focusKeyword?: string;
  canonicalUrl?: string;
  robots?: "index,follow" | "noindex" | "noindex,nofollow";
  schemaType?: PageSchemaType;
  structuredData?: string | null;
};

// ─── CREATE PAGE DRAFT ───────────────────────────────────────────────────────

export async function createPageDraftAction(
  slug: string,
  title = "Halaman Baru"
): Promise<ActionResult<{ pageId: string }>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };

  const { db, schema } = createTenantDb(slug);

  let pageSlug = resolveSlug(title);
  const [existing] = await db
    .select({ id: schema.pages.id })
    .from(schema.pages)
    .where(eq(schema.pages.slug, pageSlug))
    .limit(1);

  if (existing) {
    pageSlug = `${pageSlug}-${crypto.randomUUID().slice(0, 6)}`;
  }

  try {
    const [page] = await db
      .insert(schema.pages)
      .values({
        title: title.trim() || "Halaman Baru",
        slug:     pageSlug,
        status:   "draft",
        authorId: access.tenantUser.id,
      })
      .returning({ id: schema.pages.id });

    revalidatePath(`/${slug}/website/pages`);
    return { success: true, data: { pageId: page.id } };

  } catch (err) {
    console.error("[createPageDraftAction]", err);
    return { success: false, error: "Gagal membuat halaman." };
  }
}

// ─── UPDATE PAGE ─────────────────────────────────────────────────────────────

export async function updatePageAction(
  slug: string,
  pageId: string,
  data: PageFormData
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };

  if (!data.title?.trim()) {
    return { success: false, error: "Judul halaman wajib diisi." };
  }

  const { db, schema } = createTenantDb(slug);

  const [existing] = await db
    .select({ id: schema.pages.id, slug: schema.pages.slug })
    .from(schema.pages)
    .where(eq(schema.pages.id, pageId))
    .limit(1);

  if (!existing) return { success: false, error: "Halaman tidak ditemukan." };

  const newSlug = resolveSlug(data.title, data.slug);
  if (newSlug !== existing.slug) {
    const [duplicate] = await db
      .select({ id: schema.pages.id })
      .from(schema.pages)
      .where(eq(schema.pages.slug, newSlug))
      .limit(1);

    if (duplicate && duplicate.id !== pageId) {
      return { success: false, error: "Slug sudah dipakai halaman lain." };
    }
  }

  let publishedAt: Date | null = null;
  if (data.status === "published") {
    publishedAt = data.publishedAt ? new Date(data.publishedAt) : new Date();
  }

  try {
    await db
      .update(schema.pages)
      .set({
        title:    data.title.trim(),
        slug:     newSlug,
        content:  data.content ?? null,
        coverId:  data.coverId ?? null,
        order:    data.order ?? 0,
        status:   data.status ?? "draft",
        publishedAt,
        metaTitle:      data.metaTitle?.trim()      || null,
        metaDesc:       data.metaDesc?.trim()       || null,
        ogTitle:        data.ogTitle?.trim()        || null,
        ogDescription:  data.ogDescription?.trim()  || null,
        ogImageId:      data.ogImageId              ?? null,
        twitterCard:    data.twitterCard            ?? "summary",
        focusKeyword:   data.focusKeyword?.trim()   || null,
        canonicalUrl:   data.canonicalUrl?.trim()   || null,
        robots:         data.robots                 ?? "index,follow",
        schemaType:     data.schemaType             ?? "WebPage",
        structuredData: parseStructuredData(data.structuredData),
        updatedAt: new Date(),
      })
      .where(eq(schema.pages.id, pageId));

    revalidatePath(`/${slug}/website/pages`);
    revalidatePath(`/${slug}/website/pages/${pageId}/edit`);
    return { success: true, data: undefined };

  } catch (err) {
    console.error("[updatePageAction]", err);
    const msg = err instanceof Error ? err.message : "Gagal menyimpan.";
    if (msg.includes("pages_slug_unique")) {
      return { success: false, error: "Slug sudah dipakai halaman lain." };
    }
    return { success: false, error: `Gagal: ${msg}` };
  }
}

// ─── UPDATE PAGE STATUS ───────────────────────────────────────────────────────

export async function updatePageStatusAction(
  slug: string,
  pageId: string,
  status: ContentStatus
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };

  const { db, schema } = createTenantDb(slug);

  const [existing] = await db
    .select({ id: schema.pages.id, publishedAt: schema.pages.publishedAt })
    .from(schema.pages)
    .where(eq(schema.pages.id, pageId))
    .limit(1);

  if (!existing) return { success: false, error: "Halaman tidak ditemukan." };

  const publishedAt =
    status === "published"
      ? (existing.publishedAt ?? new Date())
      : null;

  try {
    await db
      .update(schema.pages)
      .set({ status, publishedAt, updatedAt: new Date() })
      .where(eq(schema.pages.id, pageId));

    revalidatePath(`/${slug}/website/pages`);
    revalidatePath(`/${slug}/website/pages/${pageId}/edit`);
    return { success: true, data: undefined };

  } catch (err) {
    console.error("[updatePageStatusAction]", err);
    return { success: false, error: "Gagal mengubah status." };
  }
}

// ─── DELETE PAGE ──────────────────────────────────────────────────────────────

export async function deletePageAction(
  slug: string,
  pageId: string
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };

  const { db, schema } = createTenantDb(slug);

  const [existing] = await db
    .select({ id: schema.pages.id })
    .from(schema.pages)
    .where(eq(schema.pages.id, pageId))
    .limit(1);

  if (!existing) return { success: false, error: "Halaman tidak ditemukan." };

  try {
    await db.delete(schema.pages).where(eq(schema.pages.id, pageId));
    revalidatePath(`/${slug}/website/pages`);
    return { success: true, data: undefined };

  } catch (err) {
    console.error("[deletePageAction]", err);
    return { success: false, error: "Gagal menghapus halaman." };
  }
}

// ════════════════════════════════════════════════════════════════════════════
// CATEGORIES — taksonomi hierarkis untuk posts (satu level parent → children)
// ════════════════════════════════════════════════════════════════════════════

export type CategoryFormData = {
  name: string;
  slug?: string;
  parentId?: string | null;
};

// ─── CREATE CATEGORY ──────────────────────────────────────────────────────────

export async function createCategoryAction(
  slug: string,
  data: CategoryFormData
): Promise<ActionResult<{ categoryId: string }>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };

  if (!data.name?.trim()) return { success: false, error: "Nama kategori wajib diisi." };

  const { db, schema } = createTenantDb(slug);

  const catSlug = resolveSlug(data.name, data.slug);

  // Cek slug duplikat
  const [dup] = await db
    .select({ id: schema.postCategories.id })
    .from(schema.postCategories)
    .where(eq(schema.postCategories.slug, catSlug))
    .limit(1);
  if (dup) return { success: false, error: "Slug sudah dipakai kategori lain." };

  try {
    const [cat] = await db
      .insert(schema.postCategories)
      .values({
        name:     data.name.trim(),
        slug:     catSlug,
        parentId: data.parentId ?? null,
      })
      .returning({ id: schema.postCategories.id });

    revalidatePath(`/${slug}/website/categories`);
    return { success: true, data: { categoryId: cat.id } };

  } catch (err) {
    console.error("[createCategoryAction]", err);
    return { success: false, error: "Gagal membuat kategori." };
  }
}

// ─── UPDATE CATEGORY ──────────────────────────────────────────────────────────

export async function updateCategoryAction(
  slug: string,
  categoryId: string,
  data: CategoryFormData
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };

  if (!data.name?.trim()) return { success: false, error: "Nama kategori wajib diisi." };

  const { db, schema } = createTenantDb(slug);

  const [existing] = await db
    .select({ id: schema.postCategories.id, slug: schema.postCategories.slug })
    .from(schema.postCategories)
    .where(eq(schema.postCategories.id, categoryId))
    .limit(1);
  if (!existing) return { success: false, error: "Kategori tidak ditemukan." };

  const catSlug = resolveSlug(data.name, data.slug);

  // Cek slug duplikat hanya jika slug berubah
  if (catSlug !== existing.slug) {
    const [dup] = await db
      .select({ id: schema.postCategories.id })
      .from(schema.postCategories)
      .where(eq(schema.postCategories.slug, catSlug))
      .limit(1);
    if (dup) return { success: false, error: "Slug sudah dipakai kategori lain." };
  }

  // Cegah kategori jadi parent dirinya sendiri
  if (data.parentId === categoryId) {
    return { success: false, error: "Kategori tidak bisa jadi parent dirinya sendiri." };
  }

  try {
    await db
      .update(schema.postCategories)
      .set({
        name:     data.name.trim(),
        slug:     catSlug,
        parentId: data.parentId ?? null,
      })
      .where(eq(schema.postCategories.id, categoryId));

    revalidatePath(`/${slug}/website/categories`);
    return { success: true, data: undefined };

  } catch (err) {
    console.error("[updateCategoryAction]", err);
    return { success: false, error: "Gagal mengupdate kategori." };
  }
}

// ─── DELETE CATEGORY ──────────────────────────────────────────────────────────
// Ditolak jika masih ada posts yang menggunakan kategori ini.

export async function deleteCategoryAction(
  slug: string,
  categoryId: string
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };

  const { db, schema } = createTenantDb(slug);

  // Hitung posts yang pakai kategori ini
  const [{ postCount }] = await db
    .select({ postCount: count() })
    .from(schema.posts)
    .where(eq(schema.posts.categoryId, categoryId));

  if (Number(postCount) > 0) {
    return {
      success: false,
      error: `Tidak bisa dihapus — ${postCount} post masih menggunakan kategori ini.`,
    };
  }

  // Cegah hapus kategori yang masih punya anak
  const [{ childCount }] = await db
    .select({ childCount: count() })
    .from(schema.postCategories)
    .where(eq(schema.postCategories.parentId, categoryId));

  if (Number(childCount) > 0) {
    return {
      success: false,
      error: `Tidak bisa dihapus — kategori ini masih punya ${childCount} sub-kategori.`,
    };
  }

  try {
    await db
      .delete(schema.postCategories)
      .where(eq(schema.postCategories.id, categoryId));

    revalidatePath(`/${slug}/website/categories`);
    return { success: true, data: undefined };

  } catch (err) {
    console.error("[deleteCategoryAction]", err);
    return { success: false, error: "Gagal menghapus kategori." };
  }
}

// ════════════════════════════════════════════════════════════════════════════
// TAGS — label flat untuk posts (tanpa hierarki)
// ════════════════════════════════════════════════════════════════════════════

export type TagFormData = {
  name: string;
  slug?: string;
};

// ─── CREATE TAG ───────────────────────────────────────────────────────────────

export async function createTagAction(
  slug: string,
  data: TagFormData
): Promise<ActionResult<{ tagId: string }>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };

  if (!data.name?.trim()) return { success: false, error: "Nama tag wajib diisi." };

  const { db, schema } = createTenantDb(slug);

  const tagSlug = resolveSlug(data.name, data.slug);

  const [dup] = await db
    .select({ id: schema.postTags.id })
    .from(schema.postTags)
    .where(eq(schema.postTags.slug, tagSlug))
    .limit(1);
  if (dup) return { success: false, error: "Tag dengan nama ini sudah ada." };

  try {
    const [tag] = await db
      .insert(schema.postTags)
      .values({ name: data.name.trim(), slug: tagSlug })
      .returning({ id: schema.postTags.id });

    revalidatePath(`/${slug}/website/categories`);
    return { success: true, data: { tagId: tag.id } };

  } catch (err) {
    console.error("[createTagAction]", err);
    return { success: false, error: "Gagal membuat tag." };
  }
}

// ─── UPDATE TAG ───────────────────────────────────────────────────────────────

export async function updateTagAction(
  slug: string,
  tagId: string,
  data: TagFormData
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };

  if (!data.name?.trim()) return { success: false, error: "Nama tag wajib diisi." };

  const { db, schema } = createTenantDb(slug);

  const [existing] = await db
    .select({ id: schema.postTags.id, slug: schema.postTags.slug })
    .from(schema.postTags)
    .where(eq(schema.postTags.id, tagId))
    .limit(1);
  if (!existing) return { success: false, error: "Tag tidak ditemukan." };

  const tagSlug = resolveSlug(data.name, data.slug);

  if (tagSlug !== existing.slug) {
    const [dup] = await db
      .select({ id: schema.postTags.id })
      .from(schema.postTags)
      .where(eq(schema.postTags.slug, tagSlug))
      .limit(1);
    if (dup) return { success: false, error: "Tag dengan nama ini sudah ada." };
  }

  try {
    await db
      .update(schema.postTags)
      .set({ name: data.name.trim(), slug: tagSlug })
      .where(eq(schema.postTags.id, tagId));

    revalidatePath(`/${slug}/website/categories`);
    return { success: true, data: undefined };

  } catch (err) {
    console.error("[updateTagAction]", err);
    return { success: false, error: "Gagal mengupdate tag." };
  }
}

// ─── DELETE TAG ───────────────────────────────────────────────────────────────
// Hapus pivot dulu (post_tag_pivot), baru tag-nya.

export async function deleteTagAction(
  slug: string,
  tagId: string
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };

  const { db, schema } = createTenantDb(slug);

  const [existing] = await db
    .select({ id: schema.postTags.id })
    .from(schema.postTags)
    .where(eq(schema.postTags.id, tagId))
    .limit(1);
  if (!existing) return { success: false, error: "Tag tidak ditemukan." };

  try {
    // Hapus pivot dulu
    await db
      .delete(schema.postTagPivot)
      .where(eq(schema.postTagPivot.tagId, tagId));

    await db
      .delete(schema.postTags)
      .where(eq(schema.postTags.id, tagId));

    revalidatePath(`/${slug}/website/categories`);
    return { success: true, data: undefined };

  } catch (err) {
    console.error("[deleteTagAction]", err);
    return { success: false, error: "Gagal menghapus tag." };
  }
}
