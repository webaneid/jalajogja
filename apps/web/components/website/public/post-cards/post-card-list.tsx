import type { PostCardData } from "@/lib/post-card-templates";

const fmt = (date: Date | null) =>
  date ? new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(date) : "";

export function PostCardList({ post, tenantSlug }: { post: PostCardData; tenantSlug: string }) {
  return (
    <a
      href={`/${tenantSlug}/blog/${post.slug}`}
      className="group flex gap-4 items-start py-3 border-t border-border first:border-0 transition-all hover:bg-muted/40 px-2 -mx-2 rounded-lg"
    >
      {/* Content */}
      <div className="flex flex-col flex-1 gap-1.5 min-w-0">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {post.categoryName && (
            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium shrink-0">
              {post.categoryName}
            </span>
          )}
          <span className="shrink-0">{fmt(post.publishedAt)}</span>
        </div>
        <h3 className="font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {post.title}
        </h3>
        {post.excerpt && (
          <p className="text-sm text-muted-foreground line-clamp-2">{post.excerpt}</p>
        )}
      </div>

      {/* Thumbnail */}
      {post.coverUrl && (
        <div className="w-24 h-24 shrink-0 rounded-lg overflow-hidden bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.coverUrl}
            alt={post.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      )}
    </a>
  );
}
