import { eq, inArray } from "drizzle-orm";
import { createTenantDb, db as publicDb, user as authUser } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { notFound, redirect } from "next/navigation";
import { publicUrl } from "@/lib/minio";
import { PostForm } from "@/components/website/post-form";
import type { SeoValues } from "@/components/seo/seo-panel";

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ tenant: string; id: string }>;
}) {
  const { tenant: slug, id: postId } = await params;

  const access = await getTenantAccess(slug);
  if (!access) redirect(`/app/login`);

  const { db, schema } = createTenantDb(slug);

  // Fetch post
  const [post] = await db
    .select()
    .from(schema.posts)
    .where(eq(schema.posts.id, postId))
    .limit(1);

  if (!post) notFound();

  // Resolve cover URL dari media table
  let coverUrl: string | null = null;
  if (post.coverId) {
    const [media] = await db
      .select({ path: schema.media.path })
      .from(schema.media)
      .where(inArray(schema.media.id, [post.coverId]))
      .limit(1);
    coverUrl = media ? publicUrl(slug, media.path) : null;
  }

  // Fetch tag pivots untuk post ini
  const pivots = await db
    .select({ tagId: schema.postTagPivot.tagId })
    .from(schema.postTagPivot)
    .where(eq(schema.postTagPivot.postId, postId));

  const tagIds = pivots.map((p) => p.tagId);

  // Fetch semua kategori + tag tenant untuk dropdown sidebar
  const categories = await db
    .select({ id: schema.postCategories.id, name: schema.postCategories.name, slug: schema.postCategories.slug })
    .from(schema.postCategories)
    .orderBy(schema.postCategories.name);

  const tags = await db
    .select({ id: schema.postTags.id, name: schema.postTags.name, slug: schema.postTags.slug })
    .from(schema.postTags)
    .orderBy(schema.postTags.name);

  // Resolve nama pembuat draft asli (post.authorId → tenant.users → public.user) — dipakai
  // sebagai teks hint default AuthorPicker saat displayAuthorId belum diisi. Pola sama dengan
  // resolusi authorId di app/(public)/[tenant]/post/[slug]/page.tsx.
  let originalAuthorName: string | null = null;
  if (post.authorId) {
    const [tenantUserRow] = await db
      .select({ betterAuthUserId: schema.users.betterAuthUserId })
      .from(schema.users)
      .where(eq(schema.users.id, post.authorId))
      .limit(1);
    if (tenantUserRow) {
      const [au] = await publicDb
        .select({ name: authUser.name })
        .from(authUser)
        .where(eq(authUser.id, tenantUserRow.betterAuthUserId))
        .limit(1);
      originalAuthorName = au?.name ?? null;
    }
  }

  // Build SeoValues dari data post
  const seoValues: SeoValues = {
    metaTitle:      post.metaTitle   ?? "",
    metaDesc:       post.metaDesc    ?? "",
    ogTitle:        post.ogTitle     ?? "",
    ogDescription:  post.ogDescription ?? "",
    ogImageId:      post.ogImageId   ?? null,
    ogImageUrl:     null,       // TODO: resolve URL dari media id
    twitterCard:    post.twitterCard ?? "summary_large_image",
    focusKeyword:   post.focusKeyword ?? "",
    canonicalUrl:   post.canonicalUrl ?? "",
    robots:         post.robots       ?? "index,follow",
    schemaType:     post.schemaType   ?? "Article",
    structuredData: post.structuredData
      ? JSON.stringify(post.structuredData, null, 2)
      : "",
  };

  return (
    <div className="h-full flex flex-col">
      <PostForm
        slug={slug}
        postId={postId}
        currentUserName={originalAuthorName}
        initialData={{
          title:       post.title,
          postSlug:    post.slug,
          excerpt:     post.excerpt ?? "",
          content:     post.content,
          status:      post.status,
          // Kirim full UTC ISO string — client yang konversi ke local time untuk display
          publishedAt: post.publishedAt
            ? new Date(post.publishedAt).toISOString()
            : null,
          categoryId: post.categoryId,
          isFeatured: post.isFeatured,
          tagIds,
          coverId:    post.coverId,
          coverUrl:   coverUrl,
          displayAuthorId: post.displayAuthorId,
          editorId:        post.editorId,
          seo:        seoValues,
        }}
        categories={categories}
        tags={tags}
      />
    </div>
  );
}
