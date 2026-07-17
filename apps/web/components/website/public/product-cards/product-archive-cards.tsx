import type { ProductCardData, SessionType } from "@/lib/product-card-templates";
import type { ProductArchiveCardDesignId } from "@/lib/product-archive-card-designs";
import { ProductArchiveCardsDesign1 } from "./product-archive-cards-design-1";

type Props = {
  design:      ProductArchiveCardDesignId;
  products:    ProductCardData[];
  tenantSlug:  string;
  sessionType: SessionType;
};

// Dispatcher desain kartu arsip produk — dipakai di /produk (arsip), /produk/kategori/{slug},
// dan "Produk Lainnya" di /produk/{slug}. Nambah desain baru: tambah ID di
// lib/product-archive-card-designs.ts + case di sini + komponen
// product-archive-cards-design-N.tsx baru (ikuti pola Design1 — grid desktop/list mobile).
export function ProductArchiveCards({ design, products, tenantSlug, sessionType }: Props) {
  switch (design) {
    default: return <ProductArchiveCardsDesign1 products={products} tenantSlug={tenantSlug} sessionType={sessionType} />;
  }
}
