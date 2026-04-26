import { notFound } from "next/navigation";
import { eq, desc, inArray } from "drizzle-orm";
import { createTenantDb, db, tenants } from "@jalajogja/db";
import { publicUrl } from "@/lib/minio";
import type { Metadata } from "next";

export const revalidate = 60;

type Params = Promise<{ tenant: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { tenant: slug } = await params;
  const [tenant] = await db
    .select({ name: tenants.name })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);
  if (!tenant) return {};
  return { title: `Postingan — ${tenant.name}` };
}

export default async function BlogListPage({ params }: { params: Params }) {
  const { tenant: slug } = await params;

  const [tenant] = await db
    .select({ id: tenants.id, name: tenants.name, isActive: tenants.isActive })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);

  if (!tenant?.isActive) notFound();

  const { db: tenantDb, schema } = createTenantDb(slug);

  const posts = await tenantDb
    .select({
      id:          schema.posts.id,
      title:       schema.posts.title,
      slug:        schema.posts.slug,
      excerpt:     schema.posts.excerpt,
      coverId:     schema.posts.coverId,
      publishedAt: schema.posts.publishedAt,
      categoryName: schema.postCategories.name,
    })
    .from(schema.posts)
    .leftJoin(schema.postCategories, eq(schema.postCategories.id, schema.posts.categoryId))
    .where(eq(schema.posts.status, "published"))
    .orderBy(desc(schema.posts.publishedAt))
    .limit(50);

  // Fetch cover URLs + metadata
  const coverIds = [...new Set(posts.map((p) => p.coverId).filter(Boolean))] as string[];
  const mediaRows = coverIds.length
    ? await tenantDb
        .select({
          id:      schema.media.id,
          path:    schema.media.path,
          altText: schema.media.altText,
          title:   schema.media.title,
        })
        .from(schema.media)
        .where(
          coverIds.length === 1
            ? eq(schema.media.id, coverIds[0]!)
            : inArray(schema.media.id, coverIds)
        )
    : [];
  const mediaMap = new Map(
    mediaRows.map((m) => [m.id, { url: publicUrl(slug, m.path), altText: m.altText, title: m.title }]),
  );

  const fmt = (date: Date | null) =>
    date
      ? new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(date)
      : "";

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-10">Blog</h1>

      {posts.length === 0 ? (
        <p className="text-muted-foreground">Belum ada postingan.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((post) => {
            const cover = post.coverId ? mediaMap.get(post.coverId) : null;
            return (
              <a
                key={post.id}
                href={`/${slug}/post/${post.slug}`}
                className="group block border border-border rounded-xl overflow-hidden hover:border-primary/50 hover:shadow-md transition-all"
              >
                {cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={cover.url}
                    alt={cover.altText ?? post.title}
                    title={cover.title ?? undefined}
                    className="w-full aspect-video object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full aspect-video bg-muted/60 flex items-center justify-center">
                    <span className="text-muted-foreground/40 text-3xl">📄</span>
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                    {post.categoryName && (
                      <>
                        <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full">{post.categoryName}</span>
                        <span>·</span>
                      </>
                    )}
                    <span>{fmt(post.publishedAt)}</span>
                  </div>
                  <h2 className="font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                    {post.title}
                  </h2>
                  {post.excerpt && (
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{post.excerpt}</p>
                  )}
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
