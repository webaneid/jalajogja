import type { ProductCardData, SessionType } from "@/lib/product-card-templates";
import { ProductCard } from "./product-card";

// Desain 1 — Klasik. Grid 4 kolom di desktop, List di mobile (wajib untuk semua desain di
// registry ini — lihat lib/product-archive-card-designs.ts). Dual-render CSS breakpoint,
// SSR-safe, tidak perlu "use client" — pola sama campaign-archive-cards-design-1.tsx.
// Grid 4 kolom (bukan 3 seperti Campaign/Event) — dipertahankan dari desain existing produk.
export function ProductArchiveCardsDesign1({
  products,
  tenantSlug,
  sessionType,
}: {
  products:    ProductCardData[];
  tenantSlug:  string;
  sessionType: SessionType;
}) {
  return (
    <>
      {/* Desktop: Grid 4 kolom */}
      <div className="hidden md:grid grid-cols-4 gap-4">
        {products.map(p => (
          <ProductCard key={p.id} product={p} variant="grid" tenantSlug={tenantSlug} sessionType={sessionType} />
        ))}
      </div>
      {/* Mobile: List */}
      <div className="md:hidden flex flex-col">
        {products.map(p => (
          <ProductCard key={p.id} product={p} variant="list" tenantSlug={tenantSlug} sessionType={sessionType} />
        ))}
      </div>
    </>
  );
}
