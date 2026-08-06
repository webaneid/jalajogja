"use client";

// Popup pilih variasi produk untuk /gabung — TIDAK PERNAH menavigasi keluar halaman (beda dari
// DonationBannerCart yang navigasi ke /produk/{slug} untuk produk bervariasi). Data variasi
// SUDAH di-fetch eager oleh gabung/page.tsx (bukan lazy-fetch di sini) — lihat
// docs/arsitektur-gabung-forum.md § "Redesain /gabung" § 4 poin 4 dan § 10.
//
// findVariation()/isValueAvailable() DIDUPLIKASI LOKAL dari product-detail-client.tsx (bukan
// di-import) — duplikasi kecil disengaja, product-detail-client.tsx tidak disentuh sama sekali.

import { useState, useTransition } from "react";
import { Minus, Plus, ShoppingCart } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { addToCartAction } from "@/app/(public)/[tenant]/cart/actions";
import { formatPrice } from "@/lib/product-card-templates";
import type { ProductVariationData, AttributeGroup, ViewerImage } from "@/components/toko/public/product-detail-client";

function findVariation(
  variations: ProductVariationData[],
  selected:   Record<string, string>,
): ProductVariationData | null {
  const keys = Object.keys(selected);
  if (keys.length === 0) return null;
  return variations.find((v) => keys.every((k) => v.attributeCombo[k] === selected[k])) ?? null;
}

function isValueAvailable(
  variations: ProductVariationData[],
  attrName:   string,
  attrValue:  string,
  current:    Record<string, string>,
): boolean {
  return variations.some((v) =>
    v.attributeCombo[attrName] === attrValue &&
    v.isActive &&
    v.stock > 0 &&
    Object.entries(current).every(([k, val]) => k === attrName || v.attributeCombo[k] === val),
  );
}

// sessionType selalu "member" di konteks /gabung (halaman ini hanya bisa diakses anggota IKPM
// yang sudah lolos eligibility) — prioritas harga: memberPrice ?? publicPrice ?? price.
function resolveMemberPrice(v: ProductVariationData): string {
  return v.memberPrice ?? v.publicPrice ?? v.price;
}

type Props = {
  open:        boolean;
  onOpenChange: (v: boolean) => void;
  tenantSlug:  string;
  productId:   string;
  productName: string;
  variations:  ProductVariationData[];
  attrGroups:  AttributeGroup[];
  images:      ViewerImage[];
  onAdded:     () => void;
};

export function ProductVariationPopup({
  open, onOpenChange, tenantSlug, productId, productName, variations, attrGroups, images, onAdded,
}: Props) {
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [error, setError]       = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const activeVariation = findVariation(variations, selected);
  const thumbUrl = activeVariation?.images?.[0]?.url ?? images?.[0]?.url ?? null;

  const displayPrice = activeVariation ? resolveMemberPrice(activeVariation) : null;
  const stock = activeVariation?.stock ?? 0;
  const isOutOfStock = activeVariation !== null && stock === 0;

  const allAttrSelected = attrGroups.every((g) => selected[g.name]);
  const canAdd = allAttrSelected && !isOutOfStock && !isPending;

  function handleAdd() {
    if (!activeVariation) return;
    setError(null);
    startTransition(async () => {
      const itemName = `${productName} — ${Object.values(activeVariation.attributeCombo).join(" / ")}`;
      const res = await addToCartAction(tenantSlug, {
        itemType:  "product",
        itemId:    activeVariation.id,
        name:      itemName,
        unitPrice: parseFloat(resolveMemberPrice(activeVariation)),
        quantity,
        forGabung: true,
      });
      if (res.success) {
        setSelected({});
        setQuantity(1);
        onAdded();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{productName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {thumbUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumbUrl} alt={productName} className="h-32 w-32 mx-auto rounded-lg border border-border object-cover bg-muted/30" />
          )}

          {displayPrice ? (
            <p className="text-xl font-bold text-primary text-center">{formatPrice(displayPrice)}</p>
          ) : (
            <p className="text-sm text-muted-foreground text-center">Pilih variasi untuk lihat harga</p>
          )}

          <div className="space-y-4">
            {attrGroups.map((group) => (
              <div key={group.name}>
                <p className="text-sm font-medium mb-2">
                  {group.name}
                  {selected[group.name] && (
                    <span className="text-muted-foreground font-normal ml-2">: {selected[group.name]}</span>
                  )}
                </p>
                <div className="flex gap-2 flex-wrap">
                  {group.values.map((val) => {
                    const available  = isValueAvailable(variations, group.name, val, selected);
                    const isSelected = selected[group.name] === val;
                    return (
                      <button
                        key={val}
                        type="button"
                        disabled={!available}
                        onClick={() => { setSelected((prev) => ({ ...prev, [group.name]: val })); setQuantity(1); }}
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

          {activeVariation && (
            <p className="text-sm text-muted-foreground">
              Stok: <span className={stock === 0 ? "text-destructive font-medium" : "text-foreground font-medium"}>
                {stock === 0 ? "Habis" : stock}
              </span>
            </p>
          )}

          <div className="flex items-center gap-3">
            <div className="flex items-center border border-border rounded-lg overflow-hidden shrink-0">
              <button
                type="button"
                className="px-3 py-2.5 hover:bg-muted transition-colors disabled:opacity-40"
                disabled={quantity <= 1 || isPending}
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="px-4 py-2.5 text-sm font-medium min-w-[2.5rem] text-center">{quantity}</span>
              <button
                type="button"
                className="px-3 py-2.5 hover:bg-muted transition-colors disabled:opacity-40"
                disabled={isPending || quantity >= stock}
                onClick={() => setQuantity((q) => q + 1)}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <Button className="flex-1" size="lg" disabled={!canAdd} onClick={handleAdd}>
              <ShoppingCart className="h-4 w-4 mr-2" />
              {isPending ? "Menambahkan..." : isOutOfStock ? "Stok Habis" : !allAttrSelected ? "Pilih Variasi" : "Tambah ke Keranjang"}
            </Button>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
