import type { ProductCardData } from "@/lib/product-card-templates";
import { pickProductCover, formatPrice } from "@/lib/product-card-templates";
import { Store } from "lucide-react";

export function ProductCardList({
  product,
  tenantSlug,
  isMember = false,
}: {
  product:    ProductCardData;
  tenantSlug: string;
  isMember?:  boolean;
}) {
  const cover      = pickProductCover(product, "square");
  const isMitra    = product.sellerType === "mitra";
  const showMember = isMember && !!product.memberPrice;

  return (
    <a
      href={`/${tenantSlug}/toko/${product.slug}`}
      className="group flex gap-3 items-start py-3 border-t border-border first:border-0
                 hover:bg-muted/40 px-2 -mx-2 rounded-lg transition-colors"
    >
      {/* Thumbnail */}
      <div className="w-20 h-20 shrink-0 rounded-lg overflow-hidden bg-muted">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
            <Store className="w-6 h-6" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 space-y-0.5">
        {/* Kategori + badge mitra */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {product.categoryName && (
            <span className="text-[10px] font-medium bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
              {product.categoryName}
            </span>
          )}
          {isMitra && (
            <span className="text-[10px] font-medium bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
              Mitra
            </span>
          )}
        </div>

        <h3 className="text-sm font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {product.name}
        </h3>

        {isMitra && product.businessName && (
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Store className="h-3 w-3" />
            {product.businessName}
          </p>
        )}

        {showMember ? (
          <div className="flex items-baseline gap-2">
            <p className="text-sm font-bold text-primary">{formatPrice(product.memberPrice)}</p>
            <p className="text-xs text-muted-foreground line-through">{formatPrice(product.price)}</p>
          </div>
        ) : (
          <p className="text-sm font-bold">{formatPrice(product.price)}</p>
        )}
      </div>
    </a>
  );
}
