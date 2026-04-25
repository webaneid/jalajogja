import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { createTenantDb, db, tenants } from "@jalajogja/db";
import { publicUrl } from "@/lib/minio";
import { renderBody } from "@/lib/letter-render";
import type { Metadata } from "next";

export const revalidate = 60;

type Params = Promise<{ tenant: string; slug: string }>;

async function getPost(tenantSlug: string, postSlug: string) {
  const [tenant] = await db
    .select({ id: tenants.id, name: tenants.name, isActive: tenants.isActive })
    .from(tenants)
    .where(eq(tenants.slug, tenantSlug))
    .limit(1);

  if (!tenant?.isActive) return null;

  const tenantClient             = createTenantDb(tenantSlug);
  const { db: tenantDb, schema } = tenantClient;

  const [post] = await tenantDb
    .select({
      id:           schema.posts.id,
      title:        schema.posts.title,
      excerpt:      schema.posts.excerpt,
      content:      schema.posts.content,
      status:       schema.posts.status,
      coverId:      schema.posts.coverId,
      publishedAt:  schema.posts.publishedAt,
      updatedAt:    schema.posts.updatedAt,
      metaTitle:    schema.posts.metaTitle,
      metaDesc:     schema.posts.metaDesc,
      categoryName: schema.postCategories.name,
    })
    .from(schema.posts)
    .leftJoin(schema.postCategories, eq(schema.postCategories.id, schema.posts.categoryId))
    .where(eq(schema.posts.slug, postSlug))
    .limit(1);

  if (!post || post.status !== "published") return null;

  let coverUrl: string | null = null;
  if (post.coverId) {
    const [media] = await tenantDb
      .select({ path: schema.media.path })
      .from(schema.media)
      .where(eq(schema.media.id, post.coverId))
      .limit(1);
    coverUrl = media ? publicUrl(tenantSlug, media.path) : null;
  }

  return { post, coverUrl, tenantName: tenant.name };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { tenant: tenantSlug, slug: postSlug } = await params;
  const result = await getPost(tenantSlug, postSlug);
  if (!result) return {};
  const { post, tenantName } = result;
  return {
    title:       post.metaTitle || `${post.title} — ${tenantName}`,
    description: post.metaDesc ?? post.excerpt ?? undefined,
  };
}

export default async function BlogDetailPage({ params }: { params: Params }) {
  const { tenant: tenantSlug, slug: postSlug } = await params;
  const result = await getPost(tenantSlug, postSlug);
  if (!result) notFound();

  const { post, coverUrl, tenantName } = result;
  const html = renderBody(post.content);

  const fmtDate = (date: Date | null) =>
    date
      ? new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(date)
      : "";

  return (
    <article className="max-w-3xl mx-auto px-4 py-10">
      {/* Breadcrumb */}
      <div className="text-xs text-muted-foreground mb-6 flex items-center gap-2">
        <a href={`/${tenantSlug}/post`} className="hover:text-foreground transition-colors">Postingan</a>
        <span>/</span>
        <span className="text-foreground truncate max-w-xs">{post.title}</span>
      </div>

      {/* Category + Date */}
      <div className="flex items-center gap-3 mb-4 text-xs text-muted-foreground">
        {post.categoryName && (
          <span className="px-2.5 py-1 bg-primary/10 text-primary rounded-full font-medium">
            {post.categoryName}
          </span>
        )}
        <span>{fmtDate(post.publishedAt)}</span>
      </div>

      {/* Title */}
      <h1 className="text-3xl font-bold tracking-tight mb-6">{post.title}</h1>

      {/* Cover */}
      {coverUrl && (
        <div className="mb-8 rounded-xl overflow-hidden border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={coverUrl} alt={post.title} className="w-full aspect-video object-cover" />
        </div>
      )}

      {/* Excerpt */}
      {post.excerpt && (
        <p className="text-muted-foreground text-base leading-relaxed mb-6 font-medium">
          {post.excerpt}
        </p>
      )}

      {/* Content */}
      <div
        className="prose prose-sm max-w-none
          [&_p]:my-3 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mt-8 [&_h2]:mb-3
          [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-2
          [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6
          [&_li]:my-1 [&_a]:text-primary [&_a]:underline
          [&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-4
          [&_blockquote]:italic [&_blockquote]:text-muted-foreground
          [&_pre]:bg-muted [&_pre]:rounded [&_pre]:p-4 [&_pre]:overflow-x-auto
          [&_code]:bg-muted [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-sm"
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {/* Footer */}
      <div className="mt-12 pt-6 border-t border-border text-xs text-muted-foreground flex items-center justify-between">
        <span>Diterbitkan oleh {tenantName}</span>
        {post.updatedAt && post.updatedAt !== post.publishedAt && (
          <span>Diperbarui {fmtDate(post.updatedAt)}</span>
        )}
      </div>

      <a
        href={`/${tenantSlug}/post`}
        className="mt-6 inline-block text-sm text-primary hover:underline"
      >
        ← Kembali ke Blog
      </a>
    </article>
  );
}
