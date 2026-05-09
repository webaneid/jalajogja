import type { ProductCardData } from "@/lib/product-card-templates";
import { pickProductCover, formatPrice } from "@/lib/product-card-templates";
import { Store } from "lucide-react";
import { cn } from "@/lib/utils";

export function ProductCardRingkas({
  product,
  tenantSlug,
  isMember = false,
  className,
}: {
  product:    ProductCardData;
  tenantSlug: string;
  isMember?:  boolean;
  className?: string;
}) {
  const cover      = pickProductCover(product, "square");
  const isMitra    = product.sellerType === "mitra";
  const showMember = isMember && !!product.memberPrice;

  return (
    <a
      href={`/${tenantSlug}/toko/${product.slug}`}
      className={cn(
        "group flex flex-col rounded-xl overflow-hidden border border-border bg-card",
        "hover:border-primary/50 hover:shadow-md transition-all",
        className,
      )}
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
            <Store className="w-8 h-8" />
          </div>
        )}
      </div>

      {/* Content — minimal */}
      <div className="p-2.5 space-y-1">
        {isMitra && (
          <span className="text-[10px] font-medium bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
            Mitra
          </span>
        )}
        <h3 className="text-xs font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {product.name}
        </h3>
        {showMember ? (
          <p className="text-xs font-bold text-primary">{formatPrice(product.memberPrice)}</p>
        ) : (
          <p className="text-xs font-bold">{formatPrice(product.price)}</p>
        )}
      </div>
    </a>
  );
}
