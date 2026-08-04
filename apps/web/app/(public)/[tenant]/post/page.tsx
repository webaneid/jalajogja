import { notFound }                          from "next/navigation";
import { eq, desc, and, ilike, sql, inArray } from "drizzle-orm";
import { createTenantDb, db, tenants }        from "@jalajogja/db";
import type { TenantDb }                      from "@jalajogja/db";
import { publicUrl }                          from "@/lib/minio";
import { getImageUrl }                        from "@/lib/image-url";
import { WidgetArea }                         from "@/components/website/public/widget-area";
import { PostArchiveCards }                   from "@/components/website/public/post-cards/post-archive-cards";
import { PostArchiveFiltersClient }           from "@/components/website/public/post-cards/post-archive-filters-client";
import { PublicButton }                       from "@/components/website/public/ui/public-button";
import type { PostCardData }                  from "@/lib/post-card-templates";
import type { Metadata }                      from "next";
import { generateMetadata as buildMetadata }  from "@/lib/seo";
import { getTenantSeoBase }                   from "@/lib/tenant-seo";
import { getPageSeoOverride }                 from "@/lib/get-page-seo-override";
import { resolveBaseUrl }                     from "@/lib/resolve-base-url";
import { resolvePostHrefs }                   from "@/lib/post-permalink.server";
import { FileText }                           from "lucide-react";

export const revalidate = 60;

const PAGE_SIZE = 20;

type Params       = Promise<{ tenant: string }>;
type SearchParams = Promise<{ category?: string; search?: string; page?: string }>;

// ─── resolveCovers (sama dengan posts-section.tsx) ─────────────────────────────
// media.variants di DB = path RELATIF, wajib di-wrap publicUrl() sebelum dipakai sebagai src.
type CoverEntry = {
  url:      string | null;
  variants: Record<string, string> | null;
  altText:  string | null;
  title:    string | null;
};

async function resolveCovers(
  db: TenantDb["db"],
  schema: TenantDb["schema"],
  rows: { coverId: string | null }[],
  tenantSlug: string,
): Promise<Map<string, CoverEntry>> {
  const coverIds = [...new Set(rows.map((r) => r.coverId).filter(Boolean))] as string[];
  if (!coverIds.length) return new Map();
  const media = await db
    .select({
      id:       schema.media.id,
      path:     schema.media.path,
      variants: schema.media.variants,
      altText:  schema.media.altText,
      title:    schema.media.title,
    })
    .from(schema.media)
    .where(inArray(schema.media.id, coverIds));
  return new Map(
    media.map((m) => {
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

// ─── Metadata ─────────────────────────────────────────────────────────────────
// SEO Fase 3 (docs/arsitektur-seo.md § 3.3) — kategori aktif menang atas override page-wide,
// selain itu fallback ke override page-wide, lalu fallback hardcode. Pola sama /produk.
export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: SearchParams }): Promise<Metadata> {
  const { tenant: slug } = await params;
  const { category }     = await searchParams;
  const base = await getTenantSeoBase(slug);
  const tenantClient = createTenantDb(slug);

  const override = await getPageSeoOverride(tenantClient, slug, "post-archive");
  let title        = override?.metaTitle || "Berita & Artikel";
  let description  = override?.metaDesc || undefined;
  let canonicalUrl = `${base.baseUrl}/post`;

  if (category) {
    const { db: tenantDb, schema } = tenantClient;
    const [cat] = await tenantDb
      .select({ name: schema.postCategories.name, metaTitle: schema.postCategories.metaTitle, metaDesc: schema.postCategories.metaDesc })
      .from(schema.postCategories).where(eq(schema.postCategories.slug, category)).limit(1);
    if (cat) {
      title        = cat.metaTitle || `${cat.name} — Berita ${base.siteName}`;
      description  = cat.metaDesc || undefined;
      canonicalUrl = `${base.baseUrl}/post?category=${category}`;
    }
  }

  return buildMetadata({
    title, description,
    ogTitle:       override?.ogTitle || undefined,
    ogDescription: override?.ogDescription || undefined,
    siteName:      base.siteName,
    ogImageUrl:    override?.ogImageUrl || base.logoUrl,
    canonicalUrl,
    robots:        override?.robots || undefined,
  });
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function BlogListPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { tenant: slug }                      = await params;
  const { category, search, page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  const [tenant] = await db
    .select({ id: tenants.id, name: tenants.name, isActive: tenants.isActive })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);
  if (!tenant?.isActive) notFound();

  const tenantClient             = createTenantDb(slug);
  const { db: tenantDb, schema } = tenantClient;
  const baseUrl                  = await resolveBaseUrl(slug);

  // Resolve kategori filter (slug → id)
  let categoryId: string | null = null;
  if (category) {
    const [cat] = await tenantDb
      .select({ id: schema.postCategories.id })
      .from(schema.postCategories)
      .where(eq(schema.postCategories.slug, category))
      .limit(1);
    categoryId = cat?.id ?? null;
  }

  // Semua kategori (untuk chip filter)
  const categories = await tenantDb
    .select({ id: schema.postCategories.id, name: schema.postCategories.name, slug: schema.postCategories.slug })
    .from(schema.postCategories)
    .orderBy(schema.postCategories.name);

  const whereClauses = [
    eq(schema.posts.status, "published"),
    ...(categoryId ? [eq(schema.posts.categoryId, categoryId)] : []),
    ...(search ? [ilike(schema.posts.title, `%${search}%`)] : []),
  ];

  const [{ total }] = await tenantDb
    .select({ total: sql<number>`count(*)` })
    .from(schema.posts)
    .where(and(...whereClauses));

  const totalPages = Math.max(1, Math.ceil(Number(total) / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);

  const rows = await tenantDb
    .select({
      id:           schema.posts.id,
      title:        schema.posts.title,
      slug:         schema.posts.slug,
      excerpt:      schema.posts.excerpt,
      coverId:      schema.posts.coverId,
      publishedAt:  schema.posts.publishedAt,
      isFeatured:   schema.posts.isFeatured,
      categoryName: schema.postCategories.name,
      categorySlug: schema.postCategories.slug,
    })
    .from(schema.posts)
    .leftJoin(schema.postCategories, eq(schema.postCategories.id, schema.posts.categoryId))
    .where(and(...whereClauses))
    .orderBy(desc(schema.posts.publishedAt))
    .limit(PAGE_SIZE)
    .offset((safePage - 1) * PAGE_SIZE);

  const mediaMap  = await resolveCovers(tenantDb, schema, rows, slug);
  const withHrefs = await resolvePostHrefs(tenantClient, rows);

  const posts: PostCardData[] = withHrefs.map((r) => {
    const cover = r.coverId ? (mediaMap.get(r.coverId) ?? null) : null;
    return {
      id:            r.id,
      title:         r.title,
      slug:          r.slug,
      excerpt:       r.excerpt,
      coverUrl:      cover?.url ?? null,
      coverVariants: cover?.variants ?? null,
      coverAlt:      cover?.altText ?? null,
      coverTitle:    cover?.title ?? null,
      categoryName:  r.categoryName ?? null,
      publishedAt:   r.publishedAt ? r.publishedAt.toISOString() : null,
      isFeatured:    r.isFeatured,
      href:          r.href,
    };
  });

  const basePath = `/${slug}/post`;
  const pageQuery = (p: number) =>
    new URLSearchParams({
      ...(category ? { category } : {}),
      ...(search ? { search } : {}),
      page: String(p),
    }).toString();

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Berita & Artikel</h1>
        <p className="text-muted-foreground text-sm mt-1">{tenant.name}</p>
      </div>

      {/* Filter: search + kategori chips */}
      <div className="mb-8">
        <PostArchiveFiltersClient
          categories={categories}
          currentCategory={category ?? null}
          currentSearch={search ?? ""}
          basePath={basePath}
        />
      </div>

      <div className="flex gap-10">
        {/* Main content */}
        <div className="flex-1 min-w-0">
          {posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
              <FileText className="h-12 w-12 mb-4 opacity-30" />
              <p className="text-sm">Belum ada artikel{search ? ` untuk "${search}"` : ""}.</p>
            </div>
          ) : (
            <PostArchiveCards design="1" posts={posts} baseUrl={baseUrl} />
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-10 flex items-center justify-center gap-2">
              {safePage > 1 && (
                <PublicButton
                  href={`${basePath}?${pageQuery(safePage - 1)}`}
                  variant="outline-dark" size="sm" iconLeft="chevron" icon="none"
                >
                  Sebelumnya
                </PublicButton>
              )}
              <span className="text-sm text-muted-foreground px-2">
                Halaman {safePage} dari {totalPages}
              </span>
              {safePage < totalPages && (
                <PublicButton
                  href={`${basePath}?${pageQuery(safePage + 1)}`}
                  variant="outline-dark" size="sm" icon="chevron"
                >
                  Berikutnya
                </PublicButton>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-72 shrink-0 hidden lg:block">
          <WidgetArea id="default-sidebar" tenantClient={tenantClient} tenantSlug={slug} baseUrl={baseUrl} />
        </div>
      </div>
    </div>
  );
}
