import type { ProductCardData, SessionType } from "@/lib/product-card-templates";
import { pickProductCover, formatPrice, resolvePrice, priceLabel } from "@/lib/product-card-templates";
import { Store } from "lucide-react";

export function ProductCardGrid({
  product,
  tenantSlug,
  sessionType = "none",
}: {
  product:      ProductCardData;
  tenantSlug:   string;
  sessionType?: SessionType;
}) {
  const cover        = pickProductCover(product, "square-large");
  const isMitra      = product.sellerType === "mitra";
  const isVariable   = product.productType === "variable";
  const displayPrice = resolvePrice(product, sessionType);
  const hasDiscount  = !isVariable && displayPrice !== product.price;

  return (
    <a
      href={`/${tenantSlug}/toko/${product.slug}`}
      className="group flex flex-col rounded-xl overflow-hidden border border-border bg-card
                 hover:border-primary/50 hover:shadow-md transition-all"
    >
      {/* Cover — square */}
      <div className="aspect-square bg-muted overflow-hidden">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
            <Store className="w-10 h-10" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3 flex flex-col gap-1.5 flex-1">
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

        {/* Nama */}
        <h3 className="text-sm font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {product.name}
        </h3>

        {/* Nama usaha mitra */}
        {isMitra && product.businessName && (
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Store className="h-3 w-3" />
            {product.businessName}
          </p>
        )}

        {/* Harga */}
        <div className="mt-auto pt-1">
          {isVariable ? (
            <p className="text-sm font-bold text-foreground">{priceLabel(product, sessionType)}</p>
          ) : hasDiscount ? (
            <div>
              <p className="text-xs text-muted-foreground line-through">{formatPrice(product.price)}</p>
              <p className="text-sm font-bold text-primary">{formatPrice(displayPrice)}</p>
              {sessionType === "member" && (
                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
                  Harga Anggota
                </span>
              )}
            </div>
          ) : (
            <p className="text-sm font-bold text-foreground">{formatPrice(displayPrice)}</p>
          )}
        </div>
      </div>
    </a>
  );
}
