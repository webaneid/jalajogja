import { eq, desc, and, inArray } from "drizzle-orm";
import type { TenantDb } from "@jalajogja/db";
import { publicUrl } from "@/lib/minio";
import type { PostsSectionData, PostsSectionDesignId } from "@/lib/posts-section-designs";
import { POSTS_SECTION_DESIGNS } from "@/lib/posts-section-designs";
import type { PostCardData } from "@/lib/post-card-templates";
import { PostsDesign1 } from "./posts-design-1";

type Props = {
  data:         PostsSectionData;
  variant:      PostsSectionDesignId;
  tenantClient: TenantDb;
  tenantSlug:   string;
};

export async function PostsSection({ data, variant, tenantClient, tenantSlug }: Props) {
  const designMeta = POSTS_SECTION_DESIGNS[variant];

  const [posts, featuredPosts] = await Promise.all([
    fetchRecentPosts(tenantClient, data, tenantSlug),
    designMeta?.needsFeatured
      ? fetchFeaturedPosts(tenantClient, data, tenantSlug)
      : Promise.resolve(undefined),
  ]);

  const props = { data, posts, featuredPosts, tenantSlug };

  switch (variant) {
    case "2": return <PostsDesign1 {...props} />;  // placeholder sampai design 2 selesai
    case "3": return <PostsDesign1 {...props} />;  // placeholder sampai design 3 selesai
    case "4": return <PostsDesign1 {...props} />;  // placeholder sampai design 4 selesai
    case "5": return <PostsDesign1 {...props} />;  // placeholder sampai design 5 selesai
    default:  return <PostsDesign1 {...props} />;
  }
}

// ── Helper: resolve coverUrl dari MinIO path ──────────────────────────────────

async function resolveCovers(
  db: TenantDb["db"],
  schema: TenantDb["schema"],
  rows: { coverId: string | null }[],
  tenantSlug: string,
): Promise<Map<string, string>> {
  const coverIds = [...new Set(rows.map(r => r.coverId).filter(Boolean))] as string[];
  if (!coverIds.length) return new Map();
  const media = await db
    .select({ id: schema.media.id, path: schema.media.path })
    .from(schema.media)
    .where(inArray(schema.media.id, coverIds));
  return new Map(media.map(m => [m.id, publicUrl(tenantSlug, m.path)]));
}

// ── Fetch recent posts (is_featured = false) ──────────────────────────────────

async function fetchRecentPosts(
  tenantClient: TenantDb,
  data: PostsSectionData,
  tenantSlug: string,
): Promise<PostCardData[]> {
  const { db, schema } = tenantClient;
  const count = data.count ?? 10;

  const clauses = [
    eq(schema.posts.status, "published"),
    eq(schema.posts.isFeatured, false),
    ...(data.categoryId ? [eq(schema.posts.categoryId, data.categoryId)] : []),
  ];

  const rows = await db
    .select({
      id:           schema.posts.id,
      title:        schema.posts.title,
      slug:         schema.posts.slug,
      excerpt:      schema.posts.excerpt,
      coverId:      schema.posts.coverId,
      isFeatured:   schema.posts.isFeatured,
      categoryName: schema.postCategories.name,
      publishedAt:  schema.posts.publishedAt,
    })
    .from(schema.posts)
    .leftJoin(schema.postCategories, eq(schema.postCategories.id, schema.posts.categoryId))
    .where(and(...clauses))
    .orderBy(desc(schema.posts.publishedAt))
    .limit(count);

  const mediaMap = await resolveCovers(db, schema, rows, tenantSlug);
  return rows.map(r => ({
    id:           r.id,
    title:        r.title,
    slug:         r.slug,
    excerpt:      r.excerpt,
    coverUrl:     r.coverId ? (mediaMap.get(r.coverId) ?? null) : null,
    categoryName: r.categoryName ?? null,
    publishedAt:  r.publishedAt,
    isFeatured:   r.isFeatured,
  }));
}

// ── Fetch featured posts (is_featured = true) ─────────────────────────────────

async function fetchFeaturedPosts(
  tenantClient: TenantDb,
  data: PostsSectionData,
  tenantSlug: string,
): Promise<PostCardData[]> {
  const { db, schema } = tenantClient;

  const clauses = [
    eq(schema.posts.status, "published"),
    eq(schema.posts.isFeatured, true),
    ...(data.categoryId ? [eq(schema.posts.categoryId, data.categoryId)] : []),
  ];

  const rows = await db
    .select({
      id:           schema.posts.id,
      title:        schema.posts.title,
      slug:         schema.posts.slug,
      excerpt:      schema.posts.excerpt,
      coverId:      schema.posts.coverId,
      isFeatured:   schema.posts.isFeatured,
      categoryName: schema.postCategories.name,
      publishedAt:  schema.posts.publishedAt,
    })
    .from(schema.posts)
    .leftJoin(schema.postCategories, eq(schema.postCategories.id, schema.posts.categoryId))
    .where(and(...clauses))
    .orderBy(desc(schema.posts.publishedAt))
    .limit(5);

  const mediaMap = await resolveCovers(db, schema, rows, tenantSlug);
  return rows.map(r => ({
    id:           r.id,
    title:        r.title,
    slug:         r.slug,
    excerpt:      r.excerpt,
    coverUrl:     r.coverId ? (mediaMap.get(r.coverId) ?? null) : null,
    categoryName: r.categoryName ?? null,
    publishedAt:  r.publishedAt,
    isFeatured:   r.isFeatured,
  }));
}
