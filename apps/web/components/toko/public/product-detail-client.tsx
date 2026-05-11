"use client";

import { useState, useTransition } from "react";
import { ShoppingCart, Minus, Plus, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductImageViewer } from "./product-image-viewer";
import { addToCartAction } from "@/app/(public)/[tenant]/cart/actions";
import { resolvePrice, formatPrice, priceLabel } from "@/lib/product-card-templates";
import type { ProductCardData, SessionType } from "@/lib/product-card-templates";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProductVariationData = {
  id:             string;
  sku:            string | null;
  price:          string;
  publicPrice:    string | null;
  memberPrice:    string | null;
  stock:          number;
  images:         Array<{ id: string; url: string; variants?: Record<string, string> | null; alt: string; order: number }>;
  attributeCombo: Record<string, string>;
  isActive:       boolean;
};

export type AttributeGroup = {
  name:   string;
  values: string[];
};

export type ViewerImage = {
  id:       string;
  url:      string;
  variants?: Record<string, string> | null;
  alt:      string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function findVariation(
  variations: ProductVariationData[],
  selected:   Record<string, string>,
): ProductVariationData | null {
  const keys = Object.keys(selected);
  if (keys.length === 0) return null;
  return variations.find(v =>
    keys.every(k => v.attributeCombo[k] === selected[k])
  ) ?? null;
}

function isValueAvailable(
  variations:  ProductVariationData[],
  attrName:    string,
  attrValue:   string,
  current:     Record<string, string>,
): boolean {
  return variations.some(v =>
    v.attributeCombo[attrName] === attrValue &&
    v.isActive &&
    v.stock > 0 &&
    Object.entries(current).every(([k, val]) => k === attrName || v.attributeCombo[k] === val),
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

type Props = {
  product:       ProductCardData;
  variations:    ProductVariationData[];
  attrGroups:    AttributeGroup[];
  productImages: ViewerImage[];   // gambar utama produk
  sessionType:   SessionType;
  tenantSlug:    string;
};

export function ProductDetailClient({
  product,
  variations,
  attrGroups,
  productImages,
  sessionType,
  tenantSlug,
}: Props) {
  const isVariable = product.productType === "variable";

  const [selected, setSelected]   = useState<Record<string, string>>({});
  const [quantity, setQuantity]   = useState(1);
  const [added, setAdded]         = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const activeVariation = isVariable ? findVariation(variations, selected) : null;

  // Gambar: pakai gambar variasi terpilih jika ada, fallback ke gambar produk utama
  const displayImages: ViewerImage[] =
    activeVariation && activeVariation.images.length > 0
      ? activeVariation.images
      : productImages;

  // Harga display
  const displayPrice: string = (() => {
    if (isVariable) {
      if (activeVariation) {
        const vProduct: ProductCardData = {
          ...product,
          price:       activeVariation.price,
          publicPrice: activeVariation.publicPrice,
          memberPrice: activeVariation.memberPrice,
          productType: "simple",
          priceMin:    activeVariation.price,
          priceMax:    null,
        };
        return resolvePrice(vProduct, sessionType);
      }
      return product.priceMin; // sebelum pilih variasi
    }
    return resolvePrice(product, sessionType);
  })();

  const originalPrice = isVariable
    ? (activeVariation?.price ?? null)
    : product.price;

  const hasDiscount = !isVariable && displayPrice !== originalPrice;

  // Stok
  const stock = isVariable ? (activeVariation?.stock ?? 0) : null;
  const isOutOfStock = isVariable
    ? (activeVariation !== null && stock === 0)
    : false;

  // Tombol disabled jika variable dan belum pilih semua atribut
  const allAttrSelected = isVariable
    ? attrGroups.every(g => selected[g.name])
    : true;
  const canAdd = allAttrSelected && !isOutOfStock && !isPending;

  async function handleAddToCart() {
    setError(null);

    const itemId   = isVariable ? activeVariation?.id : product.id;
    const itemName = isVariable && activeVariation
      ? `${product.name} — ${Object.values(activeVariation.attributeCombo).join(" / ")}`
      : product.name;
    const unitPrice = parseFloat(displayPrice);

    const result = await addToCartAction(tenantSlug, {
      itemType:  "product",
      itemId,
      name:      itemName,
      unitPrice,
      quantity,
    });

    if (result.success) {
      setAdded(true);
      setTimeout(() => setAdded(false), 2500);
    } else {
      setError(result.error);
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">

      {/* Kiri — Image viewer: gambar besar + thumbnail strip */}
      <div>
        <ProductImageViewer images={displayImages} productName={product.name} />
      </div>

      {/* Kanan — Info + CTA */}
      <div className="space-y-5">

        {/* Kategori badge */}
        {product.categoryName && (
          <span className="inline-block text-xs font-medium bg-primary/10 text-primary px-2.5 py-1 rounded-full">
            {product.categoryName}
          </span>
        )}

        {/* Nama */}
        <h1 className="text-2xl font-bold leading-snug">{product.name}</h1>

        {/* Badge mitra */}
        {product.sellerType === "mitra" && product.businessName && (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Store className="h-4 w-4" />
            Dijual oleh <span className="font-medium text-foreground">{product.businessName}</span>
          </p>
        )}

        {/* Harga */}
        <div className="space-y-1">
          {isVariable && !activeVariation ? (
            <p className="text-xl font-bold">{priceLabel(product, sessionType)}</p>
          ) : (
            <>
              <p className="text-2xl font-bold text-primary">{formatPrice(displayPrice)}</p>
              {hasDiscount && originalPrice && (
                <p className="text-sm text-muted-foreground line-through">{formatPrice(originalPrice)}</p>
              )}
              {sessionType === "member" && (activeVariation?.memberPrice ?? product.memberPrice) && (
                <span className="inline-block text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                  Harga Anggota IKPM
                </span>
              )}
            </>
          )}
        </div>

        {/* Variation picker */}
        {isVariable && attrGroups.length > 0 && (
          <div className="space-y-4">
            {attrGroups.map(group => (
              <div key={group.name}>
                <p className="text-sm font-medium mb-2">
                  {group.name}
                  {selected[group.name] && (
                    <span className="text-muted-foreground font-normal ml-2">: {selected[group.name]}</span>
                  )}
                </p>
                <div className="flex gap-2 flex-wrap">
                  {group.values.map(val => {
                    const available = isValueAvailable(variations, group.name, val, selected);
                    const isSelected = selected[group.name] === val;
                    return (
                      <button
                        key={val}
                        disabled={!available}
                        onClick={() => {
                          setSelected(prev => ({ ...prev, [group.name]: val }));
                          setQuantity(1);
                        }}
                        className={[
                          "px-3 py-1.5 rounded-lg border text-sm font-medium transition-all",
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary"
                            : available
                            ? "border-border hover:border-primary/50 hover:bg-muted"
                            : "border-border text-muted-foreground/40 line-through cursor-not-allowed",
                        ].join(" ")}
                      >
                        {val}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Stok info (variable setelah pilih variasi) */}
        {isVariable && activeVariation && (
          <p className="text-sm text-muted-foreground">
            Stok: <span className={stock === 0 ? "text-destructive font-medium" : "text-foreground font-medium"}>
              {stock === 0 ? "Habis" : stock}
            </span>
          </p>
        )}

        {/* Quantity + Add to cart */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center border border-border rounded-lg overflow-hidden">
              <button
                className="px-3 py-2 hover:bg-muted transition-colors disabled:opacity-40"
                disabled={quantity <= 1 || isPending}
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="px-4 py-2 text-sm font-medium min-w-[2.5rem] text-center">{quantity}</span>
              <button
                className="px-3 py-2 hover:bg-muted transition-colors disabled:opacity-40"
                disabled={isPending || (isVariable && stock !== null && quantity >= stock)}
                onClick={() => setQuantity(q => q + 1)}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          <Button
            className="w-full"
            size="lg"
            disabled={!canAdd}
            onClick={() => startTransition(handleAddToCart)}
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            {isPending ? "Menambahkan..." : added ? "Ditambahkan ✓" : isOutOfStock ? "Stok Habis" : !allAttrSelected ? "Pilih Variasi" : "Tambah ke Keranjang"}
          </Button>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {added && (
            <p className="text-sm text-center text-muted-foreground">
              Produk masuk ke{" "}
              <a href={`/${tenantSlug}/keranjang`} className="text-primary font-medium hover:underline">
                keranjang
              </a>
            </p>
          )}
        </div>

      </div>
    </div>
  );
}
