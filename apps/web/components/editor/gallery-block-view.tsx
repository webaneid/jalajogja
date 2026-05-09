"use client";

import { useState } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { Images, Settings2 } from "lucide-react";
import { GalleryPicker } from "@/components/gallery/gallery-picker";
import type { GalleryItem, GalleryLayout } from "@/lib/gallery";
import { getGalleryThumb } from "@/lib/gallery";

export function GalleryBlockView({ node, updateAttributes, selected, editor }: NodeViewProps) {
  const { items, layout, columns } = node.attrs as {
    items:   GalleryItem[];
    layout:  GalleryLayout;
    columns: 2 | 3 | 4;
  };

  const [editing, setEditing] = useState(false);

  // Ambil slug dari editor storage (di-set saat TiptapEditor init)
  const slug = (editor.storage as { slug?: string }).slug ?? "";

  return (
    <NodeViewWrapper>
      <div
        className={`rounded-lg border-2 transition-colors ${
          selected ? "border-primary" : "border-border"
        } bg-muted/5 p-3 space-y-2`}
        data-drag-handle
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Images className="h-4 w-4" />
            <span>Gallery Block</span>
            <span className="text-xs">({items.length} gambar · {layout} {columns} kolom)</span>
          </div>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted transition-colors"
          >
            <Settings2 className="h-3 w-3" />
            {editing ? "Tutup" : "Edit Gallery"}
          </button>
        </div>

        {/* Preview thumbnail grid */}
        {!editing && items.length > 0 && (
          <div className="grid grid-cols-4 gap-1.5">
            {items.slice(0, 8).map((item) => (
              <div key={item.id} className="aspect-square rounded overflow-hidden bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getGalleryThumb(item, "website")}
                  alt={item.alt ?? ""}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
            {items.length > 8 && (
              <div className="aspect-square rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">
                +{items.length - 8}
              </div>
            )}
          </div>
        )}

        {!editing && items.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            Belum ada gambar. Klik &quot;Edit Gallery&quot; untuk memilih.
          </p>
        )}

        {/* Edit panel */}
        {editing && (
          <div className="space-y-3 pt-2 border-t border-border">
            {/* Layout config */}
            <div className="flex items-center gap-3 text-xs">
              <span className="text-muted-foreground shrink-0">Layout:</span>
              {(["grid", "masonry", "carousel"] as GalleryLayout[]).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => updateAttributes({ layout: l })}
                  className={`px-2 py-0.5 rounded-full border transition-colors ${
                    layout === l ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary"
                  }`}
                >
                  {l}
                </button>
              ))}
              <span className="text-muted-foreground shrink-0 ml-2">Kolom:</span>
              {([2, 3, 4] as (2 | 3 | 4)[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => updateAttributes({ columns: c })}
                  className={`px-2 py-0.5 rounded-full border transition-colors ${
                    columns === c ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>

            {/* GalleryPicker */}
            <GalleryPicker
              slug={slug}
              items={items}
              onChange={(newItems) => updateAttributes({ items: newItems })}
              module="website"
              caption
            />
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}
