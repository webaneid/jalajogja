"use client";

import { useState } from "react";
import { Trash2, ImageIcon, X, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MediaPicker, type MediaItem } from "@/components/media/media-picker";
import type { AttributeGroup } from "@jalajogja/db";
import type { ProductImage } from "@/app/(dashboard)/app/[tenant]/toko/actions";

export type VariationLocal = {
  _key:        string;
  id?:         string;
  sku:         string;
  price:       string; // kosong = pakai harga produk induk (fallback resolve-time)
  publicPrice: string;
  memberPrice: string;
  stock:       string;
  weightGram:  string; // kosong = pakai berat produk induk (fallback resolve-time)
  images:      ProductImage[];
  attributeCombo: Record<string, string>;
  isActive:    boolean;
};

type Props = {
  slug:               string;
  variations:         VariationLocal[];
  attributeGroups:    AttributeGroup[];
  onChange:           (variations: VariationLocal[]) => void;
  minKomisi?:         number;
  // Nilai produk induk — dipakai sebagai fallback tampilan (bukan disalin ke DB) untuk
  // variasi yang tidak mengisi harga/berat/SKU sendiri. Lihat docs/arsitektur-billing.md
  // § "Fallback Harga/Berat/SKU per Variasi".
  productPrice:       string;   // Harga Dasar (modal) produk induk
  productPublicPrice: string;   // Harga Publik produk induk
  productMemberPrice: string;   // Harga Anggota produk induk
  productWeightGram:  string;
  productSku:         string;
};

function formatRp(n: number) {
  return "Rp " + n.toLocaleString("id-ID");
}

export function VariationTable({
  slug, variations, attributeGroups, onChange, minKomisi,
  productPrice, productPublicPrice, productMemberPrice, productWeightGram, productSku,
}: Props) {
  const [pickerKey, setPickerKey]   = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);

  function updateVariation(key: string, patch: Partial<VariationLocal>) {
    onChange(variations.map(v => v._key === key ? { ...v, ...patch } : v));
  }

  function removeVariation(key: string) {
    onChange(variations.filter(v => v._key !== key));
    if (editingKey === key) setEditingKey(null);
  }

  function removeImage(key: string, imageId: string) {
    const v = variations.find(v2 => v2._key === key);
    if (!v) return;
    updateVariation(key, { images: v.images.filter(img => img.id !== imageId) });
  }

  function handleSelectImage(key: string, media: MediaItem) {
    const v = variations.find(v2 => v2._key === key);
    if (!v) return;
    if (v.images.some(img => img.id === media.id)) return;
    updateVariation(key, {
      images: [...v.images, {
        id:       media.id,
        url:      media.url,
        variants: media.variants ?? null,
        alt:      media.altText ?? media.originalName,
        order:    v.images.length,
      }],
    });
    setPickerKey(null);
  }

  if (variations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6 rounded-lg border border-dashed border-border">
        Belum ada variasi. Isi atribut di atas lalu klik &quot;Generate Variasi&quot;.
      </p>
    );
  }

  const editingVariation = variations.find(v => v._key === editingKey) ?? null;
  // Harga yang tampil di daftar = harga JUAL (Publik), bukan modal. Kosong di variasi → ikut
  // produk induk; produk lama tanpa Harga Publik → ikut Harga Dasar (sama dengan resolver server).
  const parentSellingNum = parseFloat(productPublicPrice) || parseFloat(productPrice) || 0;

  return (
    <div className="space-y-2">
      {variations.map(v => {
        const thumbUrl = v.images[0]?.variants?.square ?? v.images[0]?.url ?? null;
        const comboLabel = attributeGroups
          .map(g => v.attributeCombo[g.name])
          .filter(Boolean)
          .join(" · ");

        // Harga & berat EFEKTIF — kosong di variasi berarti pakai nilai produk induk.
        const priceIsFallback = !v.publicPrice.trim();
        const priceNum        = priceIsFallback ? parentSellingNum : (parseFloat(v.publicPrice) || 0);
        const weightEffective = v.weightGram.trim() || productWeightGram.trim();

        return (
          <div
            key={v._key}
            className={`flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 transition-opacity ${
              v.isActive ? "border-border" : "border-border/40 opacity-60"
            }`}
          >
            {/* Foto — klik buka form edit lengkap */}
            <button
              type="button"
              onClick={() => setEditingKey(v._key)}
              className="relative shrink-0 block w-11 h-11 rounded-lg border border-border overflow-hidden"
            >
              {thumbUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <ImageIcon className="h-4 w-4" />
                </div>
              )}
            </button>

            {/* Ringkasan — klik buka form edit lengkap */}
            <button
              type="button"
              onClick={() => setEditingKey(v._key)}
              className="flex-1 min-w-0 text-left"
            >
              <div className="flex flex-wrap gap-1 mb-0.5">
                {attributeGroups.map(g => (
                  <span key={g.name}
                    className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                    {v.attributeCombo[g.name] ?? "—"}
                  </span>
                ))}
                {comboLabel === "" && (
                  <span className="text-xs text-muted-foreground italic">Tanpa atribut</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {priceNum > 0 ? formatRp(priceNum) : "Harga belum diisi"}
                {priceIsFallback && priceNum > 0 && " (produk)"}
                {" · "}Stok {v.stock || 0}
                {weightEffective && ` · ${weightEffective}g${!v.weightGram.trim() ? " (produk)" : ""}`}
              </p>
            </button>

            {/* Toggle aktif */}
            <label className="flex items-center gap-1.5 cursor-pointer shrink-0" title={v.isActive ? "Aktif" : "Nonaktif"}>
              <input
                type="checkbox"
                checked={v.isActive}
                onChange={e => updateVariation(v._key, { isActive: e.target.checked })}
                className="accent-primary h-3.5 w-3.5"
              />
            </label>

            {/* Edit */}
            <button
              type="button"
              onClick={() => setEditingKey(v._key)}
              className="text-muted-foreground hover:text-primary transition-colors shrink-0"
              title="Edit variasi"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>

            {/* Hapus */}
            <button
              type="button"
              onClick={() => removeVariation(v._key)}
              className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
              title="Hapus variasi"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}

      {/* MediaPicker untuk foto variasi — dialog terpisah, boleh terbuka bersamaan dengan
          dialog edit (pola sama MediaEditModal di media-picker.tsx: dua Dialog root Radix
          independen aman dibuka bertumpuk selama masing-masing punya state sendiri). */}
      {pickerKey && (
        <MediaPicker
          slug={slug}
          open={!!pickerKey}
          module="shop"
          accept={["image/"]}
          multiple
          onSelect={(media) => handleSelectImage(pickerKey, media)}
          onClose={() => setPickerKey(null)}
        />
      )}

      {/* Dialog edit variasi — form lengkap, lebih lega dari sidebar w-72 yang bikin bingung */}
      <Dialog open={!!editingVariation} onOpenChange={(open) => !open && setEditingKey(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          {editingVariation && (
            <VariationEditForm
              variation={editingVariation}
              attributeGroups={attributeGroups}
              minKomisi={minKomisi}
              productPrice={productPrice}
              productPublicPrice={productPublicPrice}
              productMemberPrice={productMemberPrice}
              productWeightGram={productWeightGram}
              productSku={productSku}
              onChange={(patch) => updateVariation(editingVariation._key, patch)}
              onOpenPicker={() => setPickerKey(editingVariation._key)}
              onRemoveImage={(imageId) => removeImage(editingVariation._key, imageId)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VariationEditForm({
  variation, attributeGroups, minKomisi, productPrice, productPublicPrice, productMemberPrice, productWeightGram, productSku,
  onChange, onOpenPicker, onRemoveImage,
}: {
  variation:         VariationLocal;
  attributeGroups:   AttributeGroup[];
  minKomisi?:        number;
  productPrice:      string;
  productPublicPrice: string;
  productMemberPrice: string;
  productWeightGram: string;
  productSku:        string;
  onChange:          (patch: Partial<VariationLocal>) => void;
  onOpenPicker:      () => void;
  onRemoveImage:     (imageId: string) => void;
}) {
  // Harga efektif untuk validasi Harga Anggota — pakai harga variasi kalau diisi, kalau
  // tidak pakai harga produk induk (sama seperti resolusi harga di checkout/product detail).
  const effectivePriceNum = variation.price.trim()
    ? (parseFloat(variation.price) || 0)
    : (parseFloat(productPrice) || 0);
  const maxMember = minKomisi != null && effectivePriceNum > 0
    ? effectivePriceNum * (1 - minKomisi / 100)
    : null;
  const memberInvalidKomisi = maxMember != null && variation.memberPrice
    ? parseFloat(variation.memberPrice) > maxMember
    : false;
  // Harga Anggota tidak boleh melebihi Harga Publik efektif variasi (publik variasi → publik
  // produk → Harga Dasar untuk produk lama). Server memvalidasi ulang di saveVariationsAction.
  const effectivePublicNum = variation.publicPrice.trim()
    ? (parseFloat(variation.publicPrice) || 0)
    : (parseFloat(productPublicPrice) || parseFloat(productPrice) || 0);
  const memberAbovePublic = !!variation.memberPrice && effectivePublicNum > 0
    && parseFloat(variation.memberPrice) > effectivePublicNum;
  const memberInvalid = memberInvalidKomisi || memberAbovePublic;

  const comboLabel = attributeGroups
    .map(g => variation.attributeCombo[g.name])
    .filter(Boolean)
    .join(" · ") || "Tanpa atribut";

  const fromParent = (v: string) => v ? `${(parseFloat(v) || 0).toLocaleString("id-ID")} (dari produk)` : "Ikut produk";
  const pricePlaceholder  = fromParent(productPrice);
  const publicPlaceholder = fromParent(productPublicPrice);
  const memberPlaceholder = fromParent(productMemberPrice);
  const weightPlaceholder = productWeightGram
    ? `${productWeightGram} (dari produk)`
    : "Ikut produk";
  const skuPlaceholder = productSku || "—";

  return (
    <>
      <DialogHeader>
        <DialogTitle>{comboLabel}</DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        {/* Foto */}
        <div>
          <Label className="mb-1.5 block">Foto Variasi</Label>
          <div className="flex flex-wrap gap-2">
            {variation.images.map(img => (
              <div key={img.id} className="relative w-16 h-16 rounded-md border border-border overflow-hidden group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.variants?.square ?? img.url} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => onRemoveImage(img.id)}
                  className="absolute top-0.5 right-0.5 rounded-full bg-black/60 p-0.5 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Hapus foto"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={onOpenPicker}
              className="w-16 h-16 rounded-md border border-dashed border-border flex flex-col items-center justify-center gap-0.5 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            >
              <ImageIcon className="h-4 w-4" />
              <span className="text-[10px]">Tambah</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="var-price">Harga Dasar (modal)</Label>
            <Input id="var-price" type="number" min={0} value={variation.price}
              onChange={e => onChange({ price: e.target.value })} placeholder={pricePlaceholder} />
          </div>
          <div>
            <Label htmlFor="var-stock">Stok</Label>
            <Input id="var-stock" type="number" min={0} value={variation.stock}
              onChange={e => onChange({ stock: e.target.value })} placeholder="0" />
          </div>
          <div>
            <Label htmlFor="var-public">Harga Publik</Label>
            <Input id="var-public" type="number" min={0} value={variation.publicPrice}
              onChange={e => onChange({ publicPrice: e.target.value })} placeholder={publicPlaceholder} />
          </div>
          <div>
            <Label htmlFor="var-weight">Berat (gram)</Label>
            <Input id="var-weight" type="number" min={0} value={variation.weightGram}
              onChange={e => onChange({ weightGram: e.target.value })} placeholder={weightPlaceholder} />
          </div>
          <div className="col-span-2">
            <Label htmlFor="var-member">Harga Anggota</Label>
            <Input id="var-member" type="number" min={0} value={variation.memberPrice}
              onChange={e => onChange({ memberPrice: e.target.value })}
              placeholder={memberPlaceholder} className={memberInvalid ? "border-destructive" : ""} />
            {memberInvalidKomisi && maxMember != null && (
              <p className="text-xs text-destructive mt-1">
                Maks {Math.floor(maxMember).toLocaleString("id-ID")}
              </p>
            )}
            {memberAbovePublic && (
              <p className="text-xs text-destructive mt-1">
                Tidak boleh lebih tinggi dari Harga Publik ({effectivePublicNum.toLocaleString("id-ID")})
              </p>
            )}
          </div>
          <div className="col-span-2">
            <Label htmlFor="var-sku">SKU</Label>
            <Input id="var-sku" value={variation.sku}
              onChange={e => onChange({ sku: e.target.value })} placeholder={skuPlaceholder} />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Harga Dasar, Harga Publik, Harga Anggota, berat, dan SKU yang dikosongkan otomatis
          mengikuti data produk induk (bukan jadi 0/kosong). Isi di sini hanya kalau varian ini memang berbeda dari produk.
        </p>
      </div>
    </>
  );
}
