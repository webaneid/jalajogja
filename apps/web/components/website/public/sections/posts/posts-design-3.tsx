import { PostCard } from "@/components/website/public/post-cards/post-card";
import { PostsSectionTitle } from "./posts-section-title";
import type { PostsSectionProps } from "@/lib/posts-section-designs";

export function PostsDesign3({ data, posts, baseUrl, sectionTitle, filterHref }: PostsSectionProps) {
  const leftPosts  = posts.slice(0, 5);
  const rightPosts = posts.slice(5, 10);

  // Mobile: overlay first + list rest
  const mobileFirst = posts[0];
  const mobileRest  = posts.slice(1, 7);

  return (
    <section className="py-10 px-4">
      <div className="max-w-7xl mx-auto">
        <PostsSectionTitle
          title={sectionTitle}
          eyebrow={data.eyebrow}
          description={data.headerDesc}
          align={data.titleAlign}
          href={filterHref}
        />

        {/* ── MOBILE: overlay pertama + list ── */}
        <div className="md:hidden">
          {mobileFirst && (
            <PostCard post={mobileFirst} variant="overlay" baseUrl={baseUrl} className="aspect-[4/3] mb-4" />
          )}
          <div>
            {mobileRest.map(p => (
              <PostCard key={p.id} post={p} variant="list" baseUrl={baseUrl} />
            ))}
          </div>
        </div>

        {/* ── DESKTOP: 2 kolom list ── */}
        <div className="hidden md:grid grid-cols-2 gap-x-6">
          <div>
            {leftPosts.map(p => (
              <PostCard key={p.id} post={p} variant="list" baseUrl={baseUrl} />
            ))}
          </div>
          {rightPosts.length > 0 && (
            <div className="border-l border-border pl-6">
              {rightPosts.map(p => (
                <PostCard key={p.id} post={p} variant="list" baseUrl={baseUrl} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
