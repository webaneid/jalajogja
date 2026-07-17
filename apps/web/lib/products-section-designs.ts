import type { ProductCardData } from "./product-card-templates";
import type { ProductArchiveCardDesignId } from "./product-archive-card-designs";

export type ProductsSectionData = {
  title:      string;
  count:      number;       // default 8
  categoryId: string | null;
};

export const PRODUCTS_SECTION_DESIGN_IDS = ["1", "2", "3"] as const;
export type ProductsSectionDesignId = typeof PRODUCTS_SECTION_DESIGN_IDS[number];

export type ProductsSectionDesignMeta = {
  label:       string;
  description: string;
  minCount:    number;
};

export const PRODUCTS_SECTION_DESIGNS: Record<ProductsSectionDesignId, ProductsSectionDesignMeta> = {
  "1": { label: "Grid Produk",    description: "4 kolom grid, cocok untuk banyak produk.",               minCount: 4  },
  "2": { label: "Showcase",       description: "1 produk utama besar + 4 produk kecil di samping.",       minCount: 5  },
  "3": { label: "Carousel Produk",description: "Scroll horizontal, tampilan padat, cocok untuk mobile.", minCount: 3  },
};

export type ProductsSectionProps = {
  data:        ProductsSectionData;
  products:    ProductCardData[];
  tenantSlug:  string;
  sectionTitle: string;
  filterHref:  string;
  cardDesign:  ProductArchiveCardDesignId;   // dipakai HANYA oleh ProductsDesign1 — ikut Desain Kartu Arsip
};
