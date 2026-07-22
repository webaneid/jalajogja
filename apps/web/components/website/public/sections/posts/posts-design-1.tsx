import { PostCard } from "@/components/website/public/post-cards/post-card";
import type { PostsSectionProps } from "@/lib/posts-section-designs";

export function PostsDesign1({ data, posts, featuredPosts = [], tenantSlug }: PostsSectionProps) {
  const leftPosts  = posts.slice(0, 5);
  const rightPosts = posts.slice(5, 10);
  const centerPosts = (featuredPosts.length > 0 ? featuredPosts : posts.slice(0, 3)).slice(0, 3);
  const showRight = rightPosts.length > 0;

  // Mobile: semua post diratakan, featured = centerPosts[0]
  const mobileFirst   = centerPosts[0] ?? posts[0];
  const mobileRest    = [...leftPosts, ...rightPosts].filter(p => p.id !== mobileFirst?.id).slice(0, 8);

  return (
    <section className="py-10 px-4">
      <div className="max-w-7xl mx-auto">
        {data.title && (
          <h2 className="section-title !mb-6 border-b border-border pb-3">{data.title}</h2>
        )}

        {/* ── MOBILE: overlay pertama + list sisanya ── */}
        <div className="md:hidden">
          {mobileFirst && (
            <PostCard post={mobileFirst} variant="overlay" tenantSlug={tenantSlug} className="aspect-[4/3] mb-4" />
          )}
          <div>
            {mobileRest.map(p => (
              <PostCard key={p.id} post={p} variant="list" tenantSlug={tenantSlug} />
            ))}
          </div>
        </div>

        {/* ── DESKTOP: 3 kolom ── */}
        <div className={`hidden md:grid gap-4 ${showRight ? "grid-cols-[1fr_1.4fr_1fr]" : "grid-cols-[1fr_1.4fr]"}`}>

          {/* Kolom Kiri */}
          {leftPosts.length > 0 && (
            <div className="flex flex-col gap-3 border-r border-border pr-4">
              {leftPosts[0] && (
                <PostCard post={leftPosts[0]} variant="klasik" tenantSlug={tenantSlug} />
              )}
              {leftPosts.slice(1).map(p => (
                <PostCard key={p.id} post={p} variant="judul" tenantSlug={tenantSlug} />
              ))}
            </div>
          )}

          {/* Kolom Tengah */}
          {centerPosts.length > 0 && (
            <div className="flex flex-col gap-3">
              {centerPosts[0] && (
                <PostCard post={centerPosts[0]} variant="overlay" tenantSlug={tenantSlug} />
              )}
              {centerPosts.slice(1).map(p => (
                <PostCard key={p.id} post={p} variant="list" tenantSlug={tenantSlug} />
              ))}
            </div>
          )}

          {/* Kolom Kanan */}
          {showRight && (
            <div className="flex flex-col gap-3 border-l border-border pl-4">
              {rightPosts[0] && (
                <PostCard post={rightPosts[0]} variant="klasik" tenantSlug={tenantSlug} />
              )}
              {rightPosts.slice(1).map(p => (
                <PostCard key={p.id} post={p} variant="judul" tenantSlug={tenantSlug} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
