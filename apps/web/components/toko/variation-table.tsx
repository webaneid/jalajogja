"use client";

import { useState } from "react";
import { Trash2, Image as ImageIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { MediaPicker, type MediaItem } from "@/components/media/media-picker";
import type { AttributeGroup } from "@jalajogja/db";
import type { ProductImage } from "@/app/(dashboard)/[tenant]/toko/actions";

export type VariationLocal = {
  _key:        string;   // React key, tidak dikirim ke server
  id?:         string;   // existing DB id
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
  minKomisi?:      number;   // untuk mitra — validasi member_price
};

export function VariationTable({ slug, variations, attributeGroups, onChange, minKomisi }: Props) {
  const [pickerKey, setPickerKey] = useState<string | null>(null);

  function updateVariation(key: string, patch: Partial<VariationLocal>) {
    onChange(variations.map(v => v._key === key ? { ...v, ...patch } : v));
  }

  function removeVariation(key: string) {
    onChange(variations.filter(v => v._key !== key));
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
    <div className="space-y-2">
      <div className="grid text-xs font-medium text-muted-foreground uppercase tracking-wide px-2"
        style={{ gridTemplateColumns: `${attributeGroups.map(() => "1fr").join(" ")} 1fr 1fr 1fr 80px 32px` }}>
        {attributeGroups.map(g => <span key={g.name}>{g.name}</span>)}
        <span>Harga</span>
        <span>Stok</span>
        <span>Aktif</span>
        <span>Foto</span>
        <span></span>
      </div>

      {variations.map(v => {
        const priceNum = parseFloat(v.price) || 0;
        const maxMember = minKomisi != null && priceNum > 0
          ? priceNum * (1 - minKomisi / 100)
          : null;
        const memberInvalid = maxMember != null && v.memberPrice
          ? parseFloat(v.memberPrice) > maxMember
          : false;

        return (
          <div key={v._key}
            className={`grid items-center gap-2 rounded-lg border px-2 py-2 ${
              v.isActive ? "border-border bg-card" : "border-border/50 bg-muted/20 opacity-60"
            }`}
            style={{ gridTemplateColumns: `${attributeGroups.map(() => "1fr").join(" ")} 1fr 1fr 1fr 80px 32px` }}>

            {/* Atribut values — read only */}
            {attributeGroups.map(g => (
              <span key={g.name} className="text-xs font-medium">
                {v.attributeCombo[g.name] ?? "—"}
              </span>
            ))}

            {/* Harga */}
            <div className="space-y-0.5">
              <Input type="number" min={0} value={v.price}
                onChange={e => updateVariation(v._key, { price: e.target.value })}
                placeholder="Harga" className="h-7 text-xs" />
              <Input type="number" min={0} value={v.publicPrice}
                onChange={e => updateVariation(v._key, { publicPrice: e.target.value })}
                placeholder="Publik" className="h-6 text-[11px]" />
              <Input type="number" min={0} value={v.memberPrice}
                onChange={e => updateVariation(v._key, { memberPrice: e.target.value })}
                placeholder="Anggota" className={`h-6 text-[11px] ${memberInvalid ? "border-destructive" : ""}`} />
              {memberInvalid && maxMember != null && (
                <p className="text-[10px] text-destructive">Maks Rp {Math.floor(maxMember).toLocaleString("id-ID")}</p>
              )}
            </div>

            {/* Stok */}
            <Input type="number" min={0} value={v.stock}
              onChange={e => updateVariation(v._key, { stock: e.target.value })}
              placeholder="0" className="h-7 text-xs" />

            {/* Toggle aktif */}
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={v.isActive}
                onChange={e => updateVariation(v._key, { isActive: e.target.checked })}
                className="accent-primary h-4 w-4" />
              <span className="text-xs">{v.isActive ? "Aktif" : "Off"}</span>
            </label>

            {/* Foto */}
            <button type="button" onClick={() => setPickerKey(v._key)}
              className="flex flex-col items-center gap-0.5 text-muted-foreground hover:text-primary transition-colors">
              {v.images[0]?.variants?.square ?? v.images[0]?.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={v.images[0].variants?.square ?? v.images[0].url}
                  alt="" className="w-10 h-10 rounded object-cover" />
              ) : (
                <div className="w-10 h-10 rounded border border-dashed border-border flex items-center justify-center">
                  <ImageIcon className="h-4 w-4" />
                </div>
              )}
              <span className="text-[10px]">{v.images.length > 0 ? `${v.images.length} foto` : "+"}</span>
            </button>

            {/* Hapus */}
            <button type="button" onClick={() => removeVariation(v._key)}
              className="text-muted-foreground hover:text-destructive transition-colors">
              <Trash2 className="h-4 w-4" />
            </button>
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
