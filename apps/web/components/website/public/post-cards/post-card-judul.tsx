import type { PostCardData } from "@/lib/post-card-templates";

const fmt = (date: Date | null) =>
  date ? new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(date) : "";

export function PostCardJudul({ post, tenantSlug }: { post: PostCardData; tenantSlug: string }) {
  return (
    <a
      href={`/${tenantSlug}/blog/${post.slug}`}
      className="group flex flex-col gap-1 py-3 border-t border-border first:border-0 hover:bg-muted/40 px-2 -mx-2 rounded-lg transition-colors"
    >
      {/* Meta: kategori + tanggal satu baris */}
      <div className="flex items-center gap-2">
        {post.categoryName && (
          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
            {post.categoryName}
          </span>
        )}
        <p className="text-xs text-muted-foreground">{fmt(post.publishedAt)}</p>
      </div>

      {/* Judul di bawah */}
      <h3 className="text-sm font-medium leading-snug line-clamp-2 group-hover:text-primary transition-colors">
        {post.title}
      </h3>
    </a>
  );
}
