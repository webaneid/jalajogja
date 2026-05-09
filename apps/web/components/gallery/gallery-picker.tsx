"use client";

import { useState } from "react";
import { ChevronUp, ChevronDown, X, Plus, ChevronDown as ChevronDownIcon } from "lucide-react";
import { MediaPicker, type MediaItem } from "@/components/media/media-picker";
import type { GalleryItem } from "@/lib/gallery";
import { getGalleryThumb } from "@/lib/gallery";

type Props = {
  slug:      string;
  items:     GalleryItem[];
  onChange:  (items: GalleryItem[]) => void;
  module?:   string;  // "shop" | "website" | "event" | "general" — default "website"
  max?:      number;  // batas jumlah gambar (opsional)
  caption?:  boolean; // tampilkan input caption per item — default false
};

export function GalleryPicker({
  slug,
  items,
  onChange,
  module = "website",
  max,
  caption = false,
}: Props) {
  const [pickerOpen, setPickerOpen]       = useState(false);
  const [expandedId, setExpandedId]       = useState<string | null>(null);

  function handleSelect(media: MediaItem) {
    if (items.some((i) => i.id === media.id)) return;
    if (max && items.length >= max) return;
    onChange([...items, {
      id:       media.id,
      url:      media.url,
      variants: media.variants ?? null,
      alt:      media.altText ?? media.originalName,
      order:    items.length,
    }]);
  }

  function remove(id: string) {
    onChange(items.filter((i) => i.id !== id).map((i, idx) => ({ ...i, order: idx })));
  }

  function move(index: number, dir: "up" | "down") {
    const next = [...items];
    const swap = dir === "up" ? index - 1 : index + 1;
    if (swap < 0 || swap >= next.length) return;
    [next[index], next[swap]] = [next[swap], next[index]];
    onChange(next.map((i, idx) => ({ ...i, order: idx })));
  }

  function setCaption(id: string, value: string) {
    onChange(items.map((i) => i.id === id ? { ...i, caption: value } : i));
  }

  const canAdd = !max || items.length < max;

  return (
    <div className="space-y-2">
      {/* Grid gambar */}
      {items.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {items.map((item, idx) => (
            <div key={item.id} className="space-y-1">
              <div className="group relative rounded-md border border-border overflow-hidden aspect-square bg-muted/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getGalleryThumb(item, module)}
                  alt={item.alt ?? ""}
                  className="w-full h-full object-cover"
                />

                {/* Overlay aksi */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-1">
                  {/* Reorder */}
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => move(idx, "up")}
                      className="p-0.5 rounded bg-white/20 hover:bg-white/40 text-white disabled:opacity-30"
                      aria-label="Pindah ke atas"
                    >
                      <ChevronUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === items.length - 1}
                      onClick={() => move(idx, "down")}
                      className="p-0.5 rounded bg-white/20 hover:bg-white/40 text-white disabled:opacity-30"
                      aria-label="Pindah ke bawah"
                    >
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </div>
                  {/* Hapus */}
                  <button
                    type="button"
                    onClick={() => remove(item.id)}
                    className="self-end p-0.5 rounded bg-destructive/80 hover:bg-destructive text-white"
                    aria-label="Hapus gambar"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {/* Caption (opsional) */}
              {caption && (
                <div>
                  <button
                    type="button"
                    onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                    className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground w-full"
                  >
                    <ChevronDownIcon className={`h-3 w-3 transition-transform ${expandedId === item.id ? "rotate-180" : ""}`} />
                    Caption
                  </button>
                  {expandedId === item.id && (
                    <input
                      type="text"
                      value={item.caption ?? ""}
                      onChange={(e) => setCaption(item.id, e.target.value)}
                      placeholder="Keterangan gambar..."
                      className="mt-1 w-full rounded border border-input bg-background px-2 py-1 text-[11px] placeholder:text-muted-foreground outline-none focus:border-primary"
                    />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tombol tambah */}
      {canAdd && (
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors w-full"
        >
          <Plus className="h-4 w-4" />
          {items.length === 0 ? "Pilih Gambar" : "Tambah Gambar"}
          {max && <span className="ml-auto text-xs">{items.length}/{max}</span>}
        </button>
      )}

      <MediaPicker
        slug={slug}
        open={pickerOpen}
        module={module as "general" | "website" | "members" | "letters" | "shop"}
        accept={["image/"]}
        multiple
        onSelect={(media) => { handleSelect(media); }}
        onClose={() => setPickerOpen(false)}
      />
    </div>
  );
}
