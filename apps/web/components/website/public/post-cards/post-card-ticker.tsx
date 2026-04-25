import type { PostCardData } from "@/lib/post-card-templates";

export function PostCardTicker({ post, tenantSlug }: { post: PostCardData; tenantSlug: string }) {
  return (
    <a
      href={`/${tenantSlug}/post/${post.slug}`}
      className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm hover:text-primary transition-colors shrink-0"
    >
      <span className="text-primary">·</span>
      <span className="line-clamp-1">{post.title}</span>
    </a>
  );
}
