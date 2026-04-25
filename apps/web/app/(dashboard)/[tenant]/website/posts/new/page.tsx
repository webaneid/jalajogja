import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { PostForm } from "@/components/website/post-form";
import type { SeoValues } from "@/components/seo/seo-panel";

const DEFAULT_SEO: SeoValues = {
  metaTitle:      "",
  metaDesc:       "",
  focusKeyword:   "",
  ogTitle:        "",
  ogDescription:  "",
  ogImageId:      null,
  ogImageUrl:     null,
  twitterCard:    "summary_large_image",
  canonicalUrl:   "",
  robots:         "index,follow",
  schemaType:     "Article",
  structuredData: "",
};

export default async function PostsNewPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/login");

  const { db, schema } = createTenantDb(slug);

  const [categories, tags] = await Promise.all([
    db.select({ id: schema.postCategories.id, name: schema.postCategories.name, slug: schema.postCategories.slug })
      .from(schema.postCategories)
      .orderBy(schema.postCategories.name),
    db.select({ id: schema.postTags.id, name: schema.postTags.name, slug: schema.postTags.slug })
      .from(schema.postTags)
      .orderBy(schema.postTags.name),
  ]);

  return (
    <PostForm
      slug={slug}
      postId={null}
      initialData={{
        title:       "",
        postSlug:    "",
        excerpt:     "",
        content:     null,
        coverId:     null,
        categoryId:  null,
        isFeatured:  false,
        tagIds:      [],
        status:      "draft",
        seo:         DEFAULT_SEO,
      }}
      categories={categories}
      tags={tags}
    />
  );
}
