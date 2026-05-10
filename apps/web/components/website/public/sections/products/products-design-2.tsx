import { PostsSectionTitle } from "../posts/posts-section-title";
import { ProductCard } from "@/components/website/public/product-cards/product-card";
import { pickProductCover, priceLabel } from "@/lib/product-card-templates";
import { Store } from "lucide-react";
import type { ProductsSectionProps } from "@/lib/products-section-designs";

export function ProductsDesign2({ products, tenantSlug, sectionTitle, filterHref }: ProductsSectionProps) {
  if (products.length === 0) return null;

  const featured = products[0];
  const rest     = products.slice(1, 5);
  const cover    = pickProductCover(featured, "square-large");

  return (
    <section className="py-10 px-4">
      <div className="max-w-7xl mx-auto">
      <PostsSectionTitle title={sectionTitle} href={filterHref} linkLabel="Lihat Semua" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Produk featured — kiri, besar */}
        <a
          href={`/${tenantSlug}/toko/${featured.slug}`}
          className="group flex flex-col rounded-xl overflow-hidden border border-border bg-card
                     hover:border-primary/50 hover:shadow-md transition-all"
        >
          <div className="aspect-square overflow-hidden bg-muted">
            {cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cover} alt={featured.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
                <Store className="w-16 h-16" />
              </div>
            )}
          </div>
          <div className="p-4 space-y-1.5">
            {featured.categoryName && (
              <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                {featured.categoryName}
              </span>
            )}
            <h3 className="font-semibold text-lg leading-snug line-clamp-2 group-hover:text-primary transition-colors">
              {featured.name}
            </h3>
            {featured.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">{featured.description}</p>
            )}
            <p className="text-base font-bold">{priceLabel(featured, "none")}</p>
          </div>
        </a>

        {/* Grid 4 produk kecil — kanan */}
        {rest.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {rest.map(p => (
              <ProductCard key={p.id} product={p} variant="grid" tenantSlug={tenantSlug} />
            ))}
          </div>
        )}
      </div>
      </div>
    </section>
  );
}
