"use client";

import { useState } from "react";
import { Trash2, ImageIcon, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MediaPicker, type MediaItem } from "@/components/media/media-picker";
import type { AttributeGroup } from "@jalajogja/db";
import type { ProductImage } from "@/app/(dashboard)/[tenant]/toko/actions";

export type VariationLocal = {
  _key:        string;
  id?:         string;
  sku:         string;
  price:       string;
  publicPrice: string;
  memberPrice: string;
  stock:       string;
  images:      ProductImage[];
  attributeCombo: Record<string, string>;
  isActive:    boolean;
};

type Props = {
  slug:            string;
  variations:      VariationLocal[];
  attributeGroups: AttributeGroup[];
  onChange:        (variations: VariationLocal[]) => void;
  minKomisi?:      number;
};

export function VariationTable({ slug, variations, attributeGroups, onChange, minKomisi }: Props) {
  const [pickerKey, setPickerKey] = useState<string | null>(null);

  function updateVariation(key: string, patch: Partial<VariationLocal>) {
    onChange(variations.map(v => v._key === key ? { ...v, ...patch } : v));
  }

  function removeVariation(key: string) {
    onChange(variations.filter(v => v._key !== key));
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

  return (
    <div className="space-y-3">
      {variations.map(v => {
        const priceNum  = parseFloat(v.price) || 0;
        const maxMember = minKomisi != null && priceNum > 0
          ? priceNum * (1 - minKomisi / 100)
          : null;
        const memberInvalid = maxMember != null && v.memberPrice
          ? parseFloat(v.memberPrice) > maxMember
          : false;

        const thumbUrl = v.images[0]?.variants?.square ?? v.images[0]?.url ?? null;
        const comboLabel = attributeGroups
          .map(g => v.attributeCombo[g.name])
          .filter(Boolean)
          .join(" · ");

        return (
          <div
            key={v._key}
            className={`rounded-xl border bg-card transition-opacity ${
              v.isActive ? "border-border" : "border-border/40 opacity-60"
            }`}
          >
            {/* Header: atribut + toggle aktif + hapus */}
            <div className="flex items-center gap-2 px-3 pt-3 pb-2">
              <div className="flex-1 flex flex-wrap gap-1">
                {attributeGroups.map(g => (
                  <span key={g.name}
                    className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {g.name}: {v.attributeCombo[g.name] ?? "—"}
                  </span>
                ))}
                {comboLabel === "" && (
                  <span className="text-xs text-muted-foreground italic">Tanpa atribut</span>
                )}
              </div>

              {/* Toggle aktif */}
              <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={v.isActive}
                  onChange={e => updateVariation(v._key, { isActive: e.target.checked })}
                  className="accent-primary h-3.5 w-3.5"
                />
                <span className="text-xs text-muted-foreground">{v.isActive ? "Aktif" : "Nonaktif"}</span>
              </label>

              {/* Hapus */}
              <button
                type="button"
                onClick={() => removeVariation(v._key)}
                className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Body: foto kiri + field kanan */}
            <div className="flex gap-3 px-3 pb-3">

              {/* Foto variasi */}
              <div className="shrink-0">
                <button
                  type="button"
                  onClick={() => setPickerKey(v._key)}
                  className="relative group block w-16 h-16 rounded-lg border border-dashed border-border overflow-hidden hover:border-primary transition-colors"
                >
                  {thumbUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-muted-foreground group-hover:text-primary transition-colors">
                      <ImageIcon className="h-5 w-5" />
                      <span className="text-[9px]">Foto</span>
                    </div>
                  )}
                  {thumbUrl && (
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                      <ImageIcon className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  )}
                </button>

                {/* Jumlah foto + hapus foto pertama */}
                {v.images.length > 0 && (
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-muted-foreground">{v.images.length} foto</span>
                    <button
                      type="button"
                      onClick={() => removeImage(v._key, v.images[0].id)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>

              {/* Field-field */}
              <div className="flex-1 space-y-1.5 min-w-0">

                {/* Harga baris */}
                <div className="grid grid-cols-3 gap-1.5">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Harga</Label>
                    <Input
                      type="number" min={0}
                      value={v.price}
                      onChange={e => updateVariation(v._key, { price: e.target.value })}
                      placeholder="0"
                      className="h-7 text-xs px-2"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Publik</Label>
                    <Input
                      type="number" min={0}
                      value={v.publicPrice}
                      onChange={e => updateVariation(v._key, { publicPrice: e.target.value })}
                      placeholder="—"
                      className="h-7 text-xs px-2"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Anggota</Label>
                    <Input
                      type="number" min={0}
                      value={v.memberPrice}
                      onChange={e => updateVariation(v._key, { memberPrice: e.target.value })}
                      placeholder="—"
                      className={`h-7 text-xs px-2 ${memberInvalid ? "border-destructive" : ""}`}
                    />
                    {memberInvalid && maxMember != null && (
                      <p className="text-[10px] text-destructive mt-0.5">
                        Maks Rp {Math.floor(maxMember).toLocaleString("id-ID")}
                      </p>
                    )}
                  </div>
                </div>

                {/* Stok + SKU baris */}
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Stok</Label>
                    <Input
                      type="number" min={0}
                      value={v.stock}
                      onChange={e => updateVariation(v._key, { stock: e.target.value })}
                      placeholder="0"
                      className="h-7 text-xs px-2"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">SKU</Label>
                    <Input
                      value={v.sku}
                      onChange={e => updateVariation(v._key, { sku: e.target.value })}
                      placeholder="—"
                      className="h-7 text-xs px-2"
                    />
                  </div>
                </div>

              </div>
            </div>
          </div>
        );
      })}

      {/* MediaPicker untuk foto variasi */}
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
    </div>
  );
}
