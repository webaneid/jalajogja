import { eq } from "drizzle-orm";
import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { notFound, redirect } from "next/navigation";
import { PostForm } from "@/components/website/post-form";
import type { SeoValues } from "@/components/seo/seo-panel";

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ tenant: string; id: string }>;
}) {
  const { tenant: slug, id: postId } = await params;

  const access = await getTenantAccess(slug);
  if (!access) redirect(`/login`);

  const { db, schema } = createTenantDb(slug);

  // Fetch post
  const [post] = await db
    .select()
    .from(schema.posts)
    .where(eq(schema.posts.id, postId))
    .limit(1);

  if (!post) notFound();

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
        initialData={{
          title:      post.title,
          postSlug:   post.slug,
          excerpt:    post.excerpt ?? "",
          content:    post.content,
          status:     post.status,
          categoryId: post.categoryId,
          tagIds,
          coverId:    post.coverId,
          seo:        seoValues,
        }}
        categories={categories}
        tags={tags}
      />
    </div>
  );
}
