import { PostCard } from "@/components/website/public/post-cards/post-card";
import { PostsSectionTitle } from "./posts-section-title";
import type { PostsSectionProps } from "@/lib/posts-section-designs";

export function PostsDesign3({ posts, tenantSlug, sectionTitle, filterHref }: PostsSectionProps) {
  const leftPosts  = posts.slice(0, 5);
  const rightPosts = posts.slice(5, 10);

  return (
    <section className="py-10 px-4">
      <div className="max-w-7xl mx-auto">
        <PostsSectionTitle title={sectionTitle} href={filterHref} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
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
      </div>
    </section>
  );
}
