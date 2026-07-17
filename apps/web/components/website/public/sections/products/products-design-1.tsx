import { PostsSectionTitle } from "../posts/posts-section-title";
import { ProductCard } from "@/components/website/public/product-cards/product-card";
import type { ProductCardData } from "@/lib/product-card-templates";
import type { ProductsSectionProps } from "@/lib/products-section-designs";

// "Grid Produk" — ikut setting "Desain Kartu Arsip" (docs/arsitektur-product.md), bukan pilihan
// kartu terpisah. Registry arsip Produk baru 1 desain — dispatch di bawah selalu 1 cabang untuk
// sekarang, murni plumbing supaya desain baru nanti otomatis ikut tanpa ubah file ini lagi.
function renderCard(p: ProductCardData, tenantSlug: string, cardDesign: ProductsSectionProps["cardDesign"]) {
  switch (cardDesign) {
    default: return <ProductCard product={p} variant="grid" tenantSlug={tenantSlug} />;
  }
}

export function ProductsDesign1({ products, tenantSlug, sectionTitle, filterHref, cardDesign }: ProductsSectionProps) {
  if (products.length === 0) return null;

  return (
    <section className="py-10 px-4">
      <div className="max-w-7xl mx-auto">
        <PostsSectionTitle title={sectionTitle} href={filterHref} linkLabel="Lihat Semua" />

        {/* Desktop: Grid 4 kolom */}
        <div className="hidden md:grid grid-cols-4 gap-4">
          {products.map(p => (
            <div key={p.id}>{renderCard(p, tenantSlug, cardDesign)}</div>
          ))}
        </div>

        {/* Mobile: slider horizontal — lebih nyaman di-scroll daripada grid sempit di layar kecil */}
        <div
          className="md:hidden flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: "none" }}
        >
          {products.map(p => (
            <div key={p.id} className="flex-none w-[75%] sm:w-[45%] snap-start">
              {renderCard(p, tenantSlug, cardDesign)}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
