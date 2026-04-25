import { PostCard } from "@/components/website/public/post-cards/post-card";
import type { PostsSectionProps } from "@/lib/posts-section-designs";

export function PostsDesign1({ data, posts, featuredPosts = [], tenantSlug }: PostsSectionProps) {
  const leftPosts  = posts.slice(0, 5);
  const rightPosts = posts.slice(5, 10);
  // Jika featured kosong → fallback ke 5 post terkini di kolom tengah
  const centerPosts = featuredPosts.length > 0 ? featuredPosts : posts.slice(0, 5);

  // Kolom kanan hanya tampil jika ada minimal 1 post untuk posisi kanan
  const showRight = rightPosts.length > 0;

  return (
    <section className="py-10 px-4">
      <div className="max-w-7xl mx-auto">
        {data.title && (
          <h2 className="text-2xl font-bold mb-6 border-b border-border pb-3">{data.title}</h2>
        )}

        <div className={`grid gap-4 ${showRight ? "grid-cols-1 md:grid-cols-[1fr_1.4fr_1fr]" : "grid-cols-1 md:grid-cols-[1fr_1.4fr]"}`}>

          {/* ── Kolom Kiri: 1 ringkas + sisanya judul ── */}
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

          {/* ── Kolom Tengah: 1 overlay + sisanya list ── */}
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

          {/* ── Kolom Kanan: 1 ringkas + sisanya judul ── */}
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
