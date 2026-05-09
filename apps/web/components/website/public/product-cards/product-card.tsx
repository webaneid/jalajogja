import type { ProductCardData, ProductCardVariant } from "@/lib/product-card-templates";
import { ProductCardGrid    } from "./product-card-grid";
import { ProductCardList    } from "./product-card-list";
import { ProductCardRingkas } from "./product-card-ringkas";

type Props = {
  product:    ProductCardData;
  variant:    ProductCardVariant;
  tenantSlug: string;
  isMember?:  boolean;   // anggota IKPM login → tampilkan harga member
  className?: string;    // hanya dipakai oleh variant yang support (ringkas)
};

export function ProductCard({ product, variant, tenantSlug, isMember = false, className }: Props) {
  switch (variant) {
    case "list":    return <ProductCardList    product={product} tenantSlug={tenantSlug} isMember={isMember} />;
    case "ringkas": return <ProductCardRingkas product={product} tenantSlug={tenantSlug} isMember={isMember} className={className} />;
    default:        return <ProductCardGrid    product={product} tenantSlug={tenantSlug} isMember={isMember} />;
  }
}
