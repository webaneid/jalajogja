import type { PostCardData } from "@/lib/post-card-templates";

export function PostCardTicker({ post, baseUrl }: { post: PostCardData; baseUrl: string }) {
  return (
    <a
      href={`${baseUrl}${post.href}`}
      className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm hover:text-primary transition-colors shrink-0"
    >
      <span className="text-primary">·</span>
      <span className="line-clamp-1">{post.title}</span>
    </a>
  );
}
