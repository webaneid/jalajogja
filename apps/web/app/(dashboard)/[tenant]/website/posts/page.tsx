import { eq, desc, ilike, and, or, count } from "drizzle-orm";
import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { PostListClient } from "@/components/website/post-list-client";
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
  if (!access) redirect(`/login`);

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
        <PostListClient.CreateButton slug={slug} />
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
          <PostListClient.SearchInput slug={slug} status={statusFilter} defaultValue={query} />
        </div>
      </div>

      {/* Tabel */}
      <PostListClient.Table
        posts={posts}
        slug={slug}
        page={page}
        totalPages={totalPages}
      />
    </div>
  );
}
