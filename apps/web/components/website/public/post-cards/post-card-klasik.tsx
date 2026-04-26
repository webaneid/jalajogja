import type { PostCardData } from "@/lib/post-card-templates";
import { pickCover } from "@/lib/post-card-templates";

const fmt = (date: string | null) =>
  date ? new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(new Date(date)) : "";

export function PostCardKlasik({ post, tenantSlug }: { post: PostCardData; tenantSlug: string }) {
  return (
    <a
      href={`/${tenantSlug}/post/${post.slug}`}
      className="group flex flex-col rounded-xl overflow-hidden transition-all"
    >
      {/* Cover */}
      <div className="aspect-video bg-muted overflow-hidden rounded-lg">
        {pickCover(post, "medium") ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={pickCover(post, "medium")!}
            alt={post.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10">
              <path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-7 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm6 13H6v-.5c0-2 4-3.1 6-3.1s6 1.1 6 3.1V19z" />
            </svg>
          </div>
        )}
      </div>

      {/* Content — tanpa padding horizontal, rapat ke tepi gambar */}
      <div className="flex flex-col flex-1 pt-2 gap-1.5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {post.categoryName && (
            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
              {post.categoryName}
            </span>
          )}
          <span>{fmt(post.publishedAt)}</span>
        </div>
        <h3 className="font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {post.title}
        </h3>
        {post.excerpt && (
          <p className="text-sm text-muted-foreground line-clamp-3">{post.excerpt}</p>
        )}
      </div>
    </a>
  );
}
