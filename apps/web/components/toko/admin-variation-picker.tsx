"use client";

// Popup pilih variasi produk untuk form buat pesanan manual admin (/toko/pesanan/new).
// Data variasi di-fetch LAZY (baru dipanggil saat dialog dibuka) via getProductVariationsAction
// — beda dari ProductVariationPopup (/gabung), yang datanya eager-fetched server-side karena
// hanya ada SATU produk relevan di konteks itu. Di sini katalog produk admin bisa banyak,
// jadi fetch variasi hanya untuk produk yang benar-benar diklik.
//
// TIDAK memanggil addToCartAction (itu untuk cart publik) — onConfirm mengembalikan variasi
// terpilih ke caller, yang lalu memanggil addToCart() lokal milik OrderCreateClient sendiri.
// Logika pilih atribut (findVariation/isValueAvailable) DIDUPLIKASI dari ProductVariationPopup
// (bukan di-import) — duplikasi kecil disengaja, tipe datanya juga sengaja beda (lihat
// AdminProductVariation di actions.ts, butuh weightGram yang tidak ada di tipe publik).

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  getProductVariationsAction,
  type AdminProductVariation, type AdminAttributeGroup,
} from "@/app/(dashboard)/app/[tenant]/toko/actions";

function findVariation(
  variations: AdminProductVariation[],
  selected:   Record<string, string>,
): AdminProductVariation | null {
  const keys = Object.keys(selected);
  if (keys.length === 0) return null;
  return variations.find((v) => keys.every((k) => v.attributeCombo[k] === selected[k])) ?? null;
}

function isValueAvailable(
  variations: AdminProductVariation[],
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

function formatRupiah(n: number) {
  return "Rp " + new Intl.NumberFormat("id-ID", { minimumFractionDigits: 0 }).format(n);
}

export type PickedVariation = {
  id:         string;
  name:       string; // "{nama produk} — {kombinasi atribut}"
  price:      number;
  stock:      number;
  weightGram: number;
  sku:        string | null;
};

type Props = {
  open:         boolean;
  onOpenChange: (v: boolean) => void;
  slug:         string;
  productId:    string;
  productName:  string;
  onConfirm:    (v: PickedVariation) => void;
};

export function AdminVariationPicker({ open, onOpenChange, slug, productId, productName, onConfirm }: Props) {
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [variations, setVariations] = useState<AdminProductVariation[]>([]);
  const [attrGroups, setAttrGroups] = useState<AdminAttributeGroup[]>([]);
  const [selected,   setSelected]   = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setSelected({});
    setError(null);
    setVariations([]);
    setAttrGroups([]);
    setLoading(true);
    getProductVariationsAction(slug, productId).then((res) => {
      if (res.success) {
        setVariations(res.data.variations);
        setAttrGroups(res.data.attrGroups);
      } else {
        setError(res.error);
      }
      setLoading(false);
    });
  }, [open, slug, productId]);

  const activeVariation = findVariation(variations, selected);
  const allAttrSelected = attrGroups.every((g) => selected[g.name]);
  const isOutOfStock    = activeVariation !== null && activeVariation.stock === 0;
  const canConfirm      = allAttrSelected && activeVariation !== null && !isOutOfStock;

  function handleConfirm() {
    if (!activeVariation) return;
    const comboLabel = Object.values(activeVariation.attributeCombo).join(" / ");
    onConfirm({
      id:         activeVariation.id,
      name:       comboLabel ? `${productName} — ${comboLabel}` : productName,
      price:      parseFloat(activeVariation.price),
      stock:      activeVariation.stock,
      weightGram: activeVariation.weightGram,
      sku:        activeVariation.sku,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{productName}</DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Memuat variasi...
          </div>
        )}

        {error && <p className="text-sm text-destructive py-2">{error}</p>}

        {!loading && !error && (
          <div className="space-y-4">
            {activeVariation ? (
              <p className="text-xl font-bold text-primary text-center">{formatRupiah(parseFloat(activeVariation.price))}</p>
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
                          onClick={() => setSelected((prev) => ({ ...prev, [group.name]: val }))}
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
                Stok: <span className={activeVariation.stock === 0 ? "text-destructive font-medium" : "text-foreground font-medium"}>
                  {activeVariation.stock === 0 ? "Habis" : activeVariation.stock}
                </span>
                {activeVariation.sku && <span className="ml-2 font-mono text-xs">{activeVariation.sku}</span>}
              </p>
            )}

            <button
              type="button"
              disabled={!canConfirm}
              onClick={handleConfirm}
              className="w-full rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isOutOfStock ? "Stok Habis" : !allAttrSelected ? "Pilih Variasi" : "Tambahkan"}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
