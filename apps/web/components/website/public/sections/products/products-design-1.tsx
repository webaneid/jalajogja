import { PostsSectionTitle } from "../posts/posts-section-title";
import { ProductCard } from "@/components/website/public/product-cards/product-card";
import type { ProductsSectionProps } from "@/lib/products-section-designs";

export function ProductsDesign1({ products, tenantSlug, sectionTitle, filterHref }: ProductsSectionProps) {
  if (products.length === 0) return null;

  return (
    <section className="w-full">
      <PostsSectionTitle title={sectionTitle} href={filterHref} linkLabel="Lihat Semua" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {products.map(p => (
          <ProductCard key={p.id} product={p} variant="grid" tenantSlug={tenantSlug} />
        ))}
      </div>
    </section>
  );
}
