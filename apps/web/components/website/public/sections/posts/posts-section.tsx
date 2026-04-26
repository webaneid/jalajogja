import { eq, desc, and, inArray, exists, sql } from "drizzle-orm";
import type { TenantDb } from "@jalajogja/db";
import { getImageUrl } from "@/lib/image-url";
import { publicUrl } from "@/lib/minio";
import type { PostsSectionData, PostsSectionDesignId, ColumnRenderData } from "@/lib/posts-section-designs";
import { POSTS_SECTION_DESIGNS } from "@/lib/posts-section-designs";
import type { PostCardData } from "@/lib/post-card-templates";
import { PostsDesign1 } from "./posts-design-1";
import { PostsDesign2 } from "./posts-design-2";
import { PostsDesign3 } from "./posts-design-3";
import { PostsDesign4 } from "./posts-design-4";
import { PostsDesign5 } from "./posts-design-5";

type Props = {
  data:         PostsSectionData;
  variant:      PostsSectionDesignId;
  tenantClient: TenantDb;
  tenantSlug:   string;
};

export async function PostsSection({ data, variant, tenantClient, tenantSlug }: Props) {
  const designMeta = POSTS_SECTION_DESIGNS[variant];
  const { db, schema } = tenantClient;
  const isHero = designMeta?.type === "hero";

  async function resolveFilterMeta(categoryId?: string | null, tagId?: string | null) {
    if (categoryId) {
      const [row] = await db
        .select({ name: schema.postCategories.name, slug: schema.postCategories.slug })
        .from(schema.postCategories)
        .where(eq(schema.postCategories.id, categoryId));
      return row
        ? { label: row.name as string | null, href: `/${tenantSlug}/post?category=${row.slug}` }
        : { label: null,                       href: `/${tenantSlug}/post` };
    }
    if (tagId) {
      const [row] = await db
        .select({ name: schema.postTags.name, slug: schema.postTags.slug })
        .from(schema.postTags)
        .where(eq(schema.postTags.id, tagId));
      return row
        ? { label: row.name as string | null, href: `/${tenantSlug}/post?tag=${row.slug}` }
        : { label: null,                       href: `/${tenantSlug}/post` };
    }
    return { label: null, href: `/${tenantSlug}/post` };
  }

  const columns = data.columns ?? [];

  const [posts, featuredPosts, filterMeta, ...columnResults] = await Promise.all([
    designMeta?.needsColumnData
      ? Promise.resolve([] as PostCardData[])
      : fetchRecentPosts(tenantClient, data, tenantSlug, { excludeFeatured: isHero }),
    designMeta?.needsFeatured
      ? fetchFeaturedPosts(tenantClient, data, tenantSlug)
      : Promise.resolve(undefined),
    resolveFilterMeta(data.categoryId, data.tagId),
    ...columns.map(async (col): Promise<ColumnRenderData> => {
      const [colPosts, meta] = await Promise.all([
        fetchRecentPosts(tenantClient, { ...data, categoryId: col.categoryId, tagId: col.tagId, count: col.count ?? 5 }, tenantSlug, {}),
        resolveFilterMeta(col.categoryId, col.tagId),
      ]);
      return { posts: colPosts, filterLabel: meta.label ?? undefined, filterHref: meta.href };
    }),
  ]);

  const sectionTitle = filterMeta.label ?? data.title ?? (isHero ? "" : "Berita Terbaru");
  const filterHref   = filterMeta.href;
  const columnData   = columnResults.length > 0 ? (columnResults as ColumnRenderData[]) : undefined;

  const props = { data, posts, featuredPosts, tenantSlug, sectionTitle, filterHref, columnData };

  switch (variant) {
    case "2": return <PostsDesign2 {...props} />;
    case "3": return <PostsDesign3 {...props} />;
    case "4": return <PostsDesign4 {...props} />;
    case "5": return <PostsDesign5 {...props} />;
    default:  return <PostsDesign1 {...props} />;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type CoverEntry = { url: string | null; variants: Record<string, string> | null };

async function resolveCovers(
  db: TenantDb["db"],
  schema: TenantDb["schema"],
  rows: { coverId: string | null }[],
  tenantSlug: string,
): Promise<Map<string, CoverEntry>> {
  const coverIds = [...new Set(rows.map(r => r.coverId).filter(Boolean))] as string[];
  if (!coverIds.length) return new Map();
  const media = await db
    .select({ id: schema.media.id, path: schema.media.path, variants: schema.media.variants })
    .from(schema.media)
    .where(inArray(schema.media.id, coverIds));
  return new Map(
    media.map(m => {
      const resolvedVariants = m.variants
        ? Object.fromEntries(
            Object.entries(m.variants)
              .filter(([, v]) => Boolean(v))
              .map(([k, v]) => [k, publicUrl(tenantSlug, v as string)]),
          )
        : null;
      return [m.id, { url: getImageUrl(m, tenantSlug, "large"), variants: resolvedVariants }];
    }),
  );
}

async function fetchRecentPosts(
  tenantClient: TenantDb,
  data: PostsSectionData,
  tenantSlug: string,
  opts: { excludeFeatured?: boolean } = {},
): Promise<PostCardData[]> {
  const { db, schema } = tenantClient;
  const count = data.count ?? 10;

  const clauses = [
    eq(schema.posts.status, "published"),
    ...(opts.excludeFeatured ? [eq(schema.posts.isFeatured, false)] : []),
    ...(data.categoryId ? [eq(schema.posts.categoryId, data.categoryId)] : []),
    ...(data.tagId
      ? [exists(
          db.select({ _: sql`1` })
            .from(schema.postTagPivot)
            .where(and(
              eq(schema.postTagPivot.postId, schema.posts.id),
              eq(schema.postTagPivot.tagId, data.tagId),
            )),
        )]
      : []),
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
  return rows.map(r => {
    const cover = r.coverId ? (mediaMap.get(r.coverId) ?? null) : null;
    return {
      id:             r.id,
      title:          r.title,
      slug:           r.slug,
      excerpt:        r.excerpt,
      coverUrl:       cover?.url ?? null,
      coverVariants:  cover?.variants ?? null,
      categoryName:   r.categoryName ?? null,
      publishedAt:    r.publishedAt ? r.publishedAt.toISOString() : null,
      isFeatured:     r.isFeatured,
    };
  });
}

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
  return rows.map(r => {
    const cover = r.coverId ? (mediaMap.get(r.coverId) ?? null) : null;
    return {
      id:             r.id,
      title:          r.title,
      slug:           r.slug,
      excerpt:        r.excerpt,
      coverUrl:       cover?.url ?? null,
      coverVariants:  cover?.variants ?? null,
      categoryName:   r.categoryName ?? null,
      publishedAt:    r.publishedAt ? r.publishedAt.toISOString() : null,
      isFeatured:     r.isFeatured,
    };
  });
}
