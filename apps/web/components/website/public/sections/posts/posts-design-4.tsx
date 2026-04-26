import { PostCard } from "@/components/website/public/post-cards/post-card";
import { PostsSectionTitle } from "./posts-section-title";
import type { PostsSectionProps, ColumnRenderData } from "@/lib/posts-section-designs";

function TrioColumn({ col, tenantSlug }: { col: ColumnRenderData; tenantSlug: string }) {
  if (col.posts.length === 0) return null;
  const title = col.filterLabel ?? "Postingan";
  const href  = col.filterHref ?? "#";
  return (
    <div className="flex flex-col">
      <PostsSectionTitle as="h3" title={title} href={href} />
      <div>
        {col.posts.map(p => (
          <PostCard key={p.id} post={p} variant="list" tenantSlug={tenantSlug} />
        ))}
      </div>
    </div>
  );
}

export function PostsDesign4({ columnData = [], tenantSlug }: PostsSectionProps) {
  const activeCols = columnData.filter(col => col.posts.length > 0);
  if (activeCols.length === 0) return null;

  return (
    <section className="py-10 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">
          {activeCols.map((col, i) => {
            const isFirst = i === 0;
            const isLast  = i === activeCols.length - 1;
            const px = `${isFirst ? "" : "md:pl-6"} ${isLast ? "" : "md:pr-6"} ${i > 0 ? "pt-6 md:pt-0" : ""}`.trim();
            return (
              <div key={i} className={px}>
                <TrioColumn col={col} tenantSlug={tenantSlug} />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
