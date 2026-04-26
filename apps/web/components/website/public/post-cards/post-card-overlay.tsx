import type { PostCardData } from "@/lib/post-card-templates";

const fmt = (date: string | null) =>
  date ? new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(new Date(date)) : "";

export function PostCardOverlay({
  post,
  tenantSlug,
  primaryColor = "#2563eb",
  className,
}: {
  post:          PostCardData;
  tenantSlug:    string;
  primaryColor?: string;
  className?:    string;
}) {
  return (
    <a
      href={`/${tenantSlug}/post/${post.slug}`}
      className={`group relative flex flex-col justify-end rounded-xl overflow-hidden aspect-[4/3] hover:shadow-lg transition-all${className ? ` ${className}` : ""}`}
    >
      {/* Background */}
      {post.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.coverUrl}
          alt={post.title}
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
      ) : (
        <div className="absolute inset-0" style={{ backgroundColor: primaryColor }} />
      )}

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

      {/* Content */}
      <div className="relative z-10 p-4 text-white">
        {post.categoryName && (
          <span className="text-xs bg-white/20 backdrop-blur-sm px-2 py-0.5 rounded-full font-medium mb-2 inline-block">
            {post.categoryName}
          </span>
        )}
        <h3 className="font-semibold leading-snug line-clamp-2 group-hover:text-white/90 transition-colors">
          {post.title}
        </h3>
        <p className="text-xs text-white/60 mt-1">{fmt(post.publishedAt)}</p>
      </div>
    </a>
  );
}
