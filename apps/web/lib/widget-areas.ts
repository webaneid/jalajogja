import { eq, desc, and, inArray, exists, sql } from "drizzle-orm";
import { getSetting, upsertSetting } from "@jalajogja/db";
import type { TenantDb } from "@jalajogja/db";
import { getImageUrl } from "@/lib/image-url";
import { publicUrl } from "@/lib/minio";
import type { PostCardData } from "@/lib/post-card-templates";

// ── Types ──────────────────────────────────────────────────────────────────────

export type SidebarSectionFilter =
  | { by: "recent" | "popular" }
  | { by: "category"; categoryId: string }
  | { by: "tag";      tagId:      string };

export type SidebarSection = {
  id:     string;         // nanoid — stable key untuk DnD + React key
  type:   "posts";        // extensible ke depan: "html" | "banner" | dll
  label:  string;
  filter: SidebarSectionFilter;
  limit:  number;         // 1–10
};

export type WidgetAreas = Record<string, SidebarSection[]>;

// ── Storage constants ──────────────────────────────────────────────────────────

const SETTINGS_KEY   = "widget_areas";
const SETTINGS_GROUP = "website" as const;

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Ambil semua widget areas dari settings. Return {} jika belum ada. */
export async function getWidgetAreas(tenantClient: TenantDb): Promise<WidgetAreas> {
  const raw = await getSetting<WidgetAreas>(tenantClient, SETTINGS_KEY, SETTINGS_GROUP);
  return raw ?? {};
}

/** Ambil sections untuk satu named area. Return null jika belum dikonfigurasi / kosong. */
export async function fetchWidgetArea(
  id:           string,
  tenantClient: TenantDb,
): Promise<SidebarSection[] | null> {
  const areas    = await getWidgetAreas(tenantClient);
  const sections = areas[id];
  return sections && sections.length > 0 ? sections : null;
}

/** Simpan sections untuk satu area — tidak overwrite area lain. */
export async function saveWidgetArea(
  id:           string,
  sections:     SidebarSection[],
  tenantClient: TenantDb,
): Promise<void> {
  const areas = await getWidgetAreas(tenantClient);
  areas[id]   = sections;
  await upsertSetting(tenantClient, SETTINGS_KEY, SETTINGS_GROUP, areas);
}

// ── Post fetcher ───────────────────────────────────────────────────────────────

type CoverEntry = {
  url:      string | null;
  variants: Record<string, string> | null;
  altText:  string | null;
  title:    string | null;
};

async function resolveCovers(
  db:         TenantDb["db"],
  schema:     TenantDb["schema"],
  rows:       { coverId: string | null }[],
  tenantSlug: string,
): Promise<Map<string, CoverEntry>> {
  const ids = [...new Set(rows.map(r => r.coverId).filter(Boolean))] as string[];
  if (!ids.length) return new Map();

  const media = await db
    .select({
      id:       schema.media.id,
      path:     schema.media.path,
      variants: schema.media.variants,
      altText:  schema.media.altText,
      title:    schema.media.title,
    })
    .from(schema.media)
    .where(inArray(schema.media.id, ids));

  return new Map(
    media.map(m => {
      const resolvedVariants = m.variants
        ? Object.fromEntries(
            Object.entries(m.variants)
              .filter(([, v]) => Boolean(v))
              .map(([k, v]) => [k, publicUrl(tenantSlug, v as string)]),
          )
        : null;
      return [m.id, {
        url:      getImageUrl(m, tenantSlug, "large"),
        variants: resolvedVariants,
        altText:  m.altText,
        title:    m.title,
      }];
    }),
  );
}

type PostRow = {
  id:           string;
  title:        string;
  slug:         string;
  excerpt:      string | null;
  coverId:      string | null;
  isFeatured:   boolean;
  categoryName: string | null;
  publishedAt:  Date | null;
};

/** Fetch posts untuk satu SidebarSection, cover sudah resolved. */
export async function fetchSidebarPosts(
  tenantClient: TenantDb,
  section:      SidebarSection,
  tenantSlug:   string,
): Promise<PostCardData[]> {
  const { db, schema } = tenantClient;
  const { filter, limit } = section;

  const sel = {
    id:           schema.posts.id,
    title:        schema.posts.title,
    slug:         schema.posts.slug,
    excerpt:      schema.posts.excerpt,
    coverId:      schema.posts.coverId,
    isFeatured:   schema.posts.isFeatured,
    categoryName: schema.postCategories.name,
    publishedAt:  schema.posts.publishedAt,
  };

  let rows: PostRow[];

  switch (filter.by) {
    case "popular":
      rows = await db.select(sel)
        .from(schema.posts)
        .leftJoin(schema.postCategories, eq(schema.postCategories.id, schema.posts.categoryId))
        .where(eq(schema.posts.status, "published"))
        .orderBy(desc(schema.posts.viewCount))
        .limit(limit);
      break;

    case "category":
      rows = await db.select(sel)
        .from(schema.posts)
        .leftJoin(schema.postCategories, eq(schema.postCategories.id, schema.posts.categoryId))
        .where(and(
          eq(schema.posts.status, "published"),
          eq(schema.posts.categoryId, filter.categoryId),
        ))
        .orderBy(desc(schema.posts.publishedAt))
        .limit(limit);
      break;

    case "tag":
      rows = await db.select(sel)
        .from(schema.posts)
        .leftJoin(schema.postCategories, eq(schema.postCategories.id, schema.posts.categoryId))
        .where(and(
          eq(schema.posts.status, "published"),
          exists(
            db.select({ _: sql`1` })
              .from(schema.postTagPivot)
              .where(and(
                eq(schema.postTagPivot.postId, schema.posts.id),
                eq(schema.postTagPivot.tagId, filter.tagId),
              )),
          ),
        ))
        .orderBy(desc(schema.posts.publishedAt))
        .limit(limit);
      break;

    default: // "recent"
      rows = await db.select(sel)
        .from(schema.posts)
        .leftJoin(schema.postCategories, eq(schema.postCategories.id, schema.posts.categoryId))
        .where(eq(schema.posts.status, "published"))
        .orderBy(desc(schema.posts.publishedAt))
        .limit(limit);
  }

  const mediaMap = await resolveCovers(db, schema, rows, tenantSlug);

  return rows.map(r => {
    const cover = r.coverId ? (mediaMap.get(r.coverId) ?? null) : null;
    return {
      id:            r.id,
      title:         r.title,
      slug:          r.slug,
      excerpt:       r.excerpt,
      coverUrl:      cover?.url      ?? null,
      coverVariants: cover?.variants ?? null,
      coverAlt:      cover?.altText  ?? null,
      coverTitle:    cover?.title    ?? null,
      categoryName:  r.categoryName,
      publishedAt:   r.publishedAt ? r.publishedAt.toISOString() : null,
      isFeatured:    r.isFeatured,
    };
  });
}
