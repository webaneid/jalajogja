import type { ProductCardData, ProductCardVariant, SessionType } from "@/lib/product-card-templates";
import { ProductCardGrid    } from "./product-card-grid";
import { ProductCardList    } from "./product-card-list";
import { ProductCardRingkas } from "./product-card-ringkas";

type Props = {
  product:      ProductCardData;
  variant:      ProductCardVariant;
  tenantSlug:   string;
  sessionType?: SessionType;  // "none" | "public" | "member" — menentukan tier harga
  className?:   string;       // hanya dipakai oleh variant ringkas
};

export function ProductCard({ product, variant, tenantSlug, sessionType = "none", className }: Props) {
  switch (variant) {
    case "list":    return <ProductCardList    product={product} tenantSlug={tenantSlug} sessionType={sessionType} />;
    case "ringkas": return <ProductCardRingkas product={product} tenantSlug={tenantSlug} sessionType={sessionType} className={className} />;
    default:        return <ProductCardGrid    product={product} tenantSlug={tenantSlug} sessionType={sessionType} />;
  }
}
