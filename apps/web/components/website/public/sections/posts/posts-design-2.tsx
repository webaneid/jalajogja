import { PostCard } from "@/components/website/public/post-cards/post-card";
import { pickCover } from "@/lib/post-card-templates";
import { PostsSectionTitle } from "./posts-section-title";
import type { PostsSectionProps } from "@/lib/posts-section-designs";

const fmtDate = (d: string | null) =>
  d ? new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(new Date(d)) : "";

export function PostsDesign2({ data, posts, tenantSlug, sectionTitle, filterHref }: PostsSectionProps) {
  const featured   = posts[0];
  const leftPosts  = posts.slice(1, 6);
  const rightPosts = posts.slice(6, 11);

  return (
    <section className="py-10 px-4">
      <div className="max-w-7xl mx-auto">
      <PostsSectionTitle title={sectionTitle} href={filterHref} />

      {featured && (
        <a
          href={`/${tenantSlug}/post/${featured.slug}`}
          className="flex gap-4 mb-6 group"
        >
          <div className="w-1/2 shrink-0 aspect-video overflow-hidden rounded-lg bg-muted">
            {pickCover(featured, "large") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={pickCover(featured, "large")!}
                alt={featured.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div className="w-full h-full bg-muted" />
            )}
          </div>
          <div className="w-1/2 flex flex-col gap-2">
            {featured.categoryName && (
              <span className="text-xs font-semibold text-primary uppercase tracking-wide">
                {featured.categoryName}
              </span>
            )}
            <h3 className="text-2xl font-bold leading-tight line-clamp-3 group-hover:text-primary transition-colors">
              {featured.title}
            </h3>
            {featured.excerpt && (
              <p className="text-sm text-muted-foreground line-clamp-3">{featured.excerpt}</p>
            )}
            {featured.publishedAt && (
              <p className="text-xs text-muted-foreground mt-auto">{fmtDate(featured.publishedAt)}</p>
            )}
          </div>
        </a>
      )}

      {leftPosts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 border-t border-border pt-4">
          <div>
            {leftPosts.map(p => (
              <PostCard key={p.id} post={p} variant="list" tenantSlug={tenantSlug} />
            ))}
          </div>
          {rightPosts.length > 0 && (
            <div className="border-l border-border pl-6">
              {rightPosts.map(p => (
                <PostCard key={p.id} post={p} variant="list" tenantSlug={tenantSlug} />
              ))}
            </div>
          )}
        </div>
      )}
      </div>
    </section>
  );
}
