import type { PostCardData } from "@/lib/post-card-templates";
import { pickCover } from "@/lib/post-card-templates";

const fmt = (date: string | null) =>
  date ? new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(new Date(date)) : "";

export function PostCardRingkas({ post, tenantSlug }: { post: PostCardData; tenantSlug: string }) {
  return (
    <a
      href={`/${tenantSlug}/post/${post.slug}`}
      className="group flex flex-col rounded-xl border border-border bg-card overflow-hidden hover:border-primary/50 hover:shadow-md transition-all"
    >
      {/* Cover */}
      <div className="aspect-video bg-muted overflow-hidden">
        {pickCover(post, "thumbnail") ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={pickCover(post, "thumbnail")!}
            alt={post.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full bg-muted" />
        )}
      </div>

      {/* Content */}
      <div className="p-3 flex flex-col gap-1.5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {post.categoryName && (
            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
              {post.categoryName}
            </span>
          )}
          <span>{fmt(post.publishedAt)}</span>
        </div>
        <h3 className="font-semibold leading-snug line-clamp-3 text-sm group-hover:text-primary transition-colors">
          {post.title}
        </h3>
      </div>
    </a>
  );
}
