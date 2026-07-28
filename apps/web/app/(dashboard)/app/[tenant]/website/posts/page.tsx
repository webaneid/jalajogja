import { eq, desc, ilike, and, or, count } from "drizzle-orm";
import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { CreateButton, SearchInput, PostsTable } from "@/components/website/post-list-client";
import type { ContentStatus } from "@jalajogja/db";

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PostsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const { tenant: slug } = await params;
  const { status: statusFilter, q: query, page: pageStr } = await searchParams;

  const access = await getTenantAccess(slug);
  if (!access) redirect(`/app/login`);

  const { db, schema } = createTenantDb(slug);

  const page    = Math.max(1, parseInt(pageStr ?? "1", 10));
  const perPage = 20;
  const offset  = (page - 1) * perPage;

  // Build conditions
  const conditions = [];

  if (statusFilter && ["draft", "published", "archived"].includes(statusFilter)) {
    conditions.push(eq(schema.posts.status, statusFilter as ContentStatus));
  }

  if (query?.trim()) {
    conditions.push(
      or(
        ilike(schema.posts.title, `%${query.trim()}%`),
        ilike(schema.posts.slug,  `%${query.trim()}%`)
      )
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const posts = await db
    .select({
      id:          schema.posts.id,
      title:       schema.posts.title,
      slug:        schema.posts.slug,
      status:      schema.posts.status,
      viewCount:   schema.posts.viewCount,
      publishedAt: schema.posts.publishedAt,
      createdAt:   schema.posts.createdAt,
      updatedAt:   schema.posts.updatedAt,
    })
    .from(schema.posts)
    .where(where)
    .orderBy(desc(schema.posts.updatedAt))
    .limit(perPage)
    .offset(offset);

  // Count untuk pagination
  const [{ value: total }] = await db
    .select({ value: count() })
    .from(schema.posts)
    .where(where);

  const totalPages = Math.ceil(Number(total) / perPage);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Posts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Artikel, berita, dan pengumuman organisasi
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/app/${slug}/website/import-wordpress`}
            className="text-sm px-3 py-1.5 rounded-md border border-border hover:bg-muted transition-colors"
            title="Impor post dari file WordPress WXR XML atau tarik langsung dari situs WordPress via REST API"
          >
            Import dari WordPress
          </a>
          <a
            href={`/api/website/export-wxr?slug=${slug}`}
            className="text-sm px-3 py-1.5 rounded-md border border-border hover:bg-muted transition-colors"
            title="Unduh semua post sebagai file WordPress WXR XML — bisa diimpor kembali ke WordPress kapan saja"
          >
            Export ke WordPress
          </a>
          <CreateButton slug={slug} />
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex gap-2 items-center flex-wrap">
        {(["all", "draft", "published", "archived"] as const).map((s) => {
          const isActive =
            s === "all" ? !statusFilter : statusFilter === s;
          const href =
            s === "all"
              ? `/${slug}/website/posts${query ? `?q=${query}` : ""}`
              : `/${slug}/website/posts?status=${s}${query ? `&q=${query}` : ""}`;
          return (
            <a key={s} href={href}>
              <Badge
                variant={isActive ? "default" : "outline"}
                className="cursor-pointer capitalize"
              >
                {s === "all" ? "Semua" : s}
              </Badge>
            </a>
          );
        })}
        <div className="ml-auto">
          <SearchInput slug={slug} status={statusFilter} defaultValue={query} />
        </div>
      </div>

      {/* Tabel */}
      <PostsTable
        posts={posts}
        slug={slug}
        page={page}
        totalPages={totalPages}
      />
    </div>
  );
}
