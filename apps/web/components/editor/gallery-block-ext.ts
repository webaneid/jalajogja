// GalleryBlock — custom Tiptap Node extension untuk gallery gambar di editor
// Admin pilih gambar via MediaPicker (multiple), disimpan sebagai GalleryItem[]
// Render via ReactNodeViewRenderer agar bisa preview + edit di editor

import { Node, mergeAttributes, type CommandProps } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { GalleryBlockView } from "./gallery-block-view";
import type { GalleryItem, GalleryLayout } from "@/lib/gallery";

export type InsertGalleryAttrs = {
  items:   GalleryItem[];
  layout:  GalleryLayout;
  columns: 2 | 3 | 4;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    galleryBlock: {
      insertGallery: (attrs: InsertGalleryAttrs) => ReturnType;
      updateGallery: (attrs: Partial<InsertGalleryAttrs>) => ReturnType;
    };
  }
}

export const GalleryBlock = Node.create({
  name: "galleryBlock",
  group: "block",
  atom: true,       // leaf node — tidak bisa dimasuki kursor
  draggable: true,

  addAttributes() {
    return {
      items:   { default: [] },
      layout:  { default: "grid" },
      columns: { default: 3 },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="gallery-block"]' }];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes as Record<string, string>, { "data-type": "gallery-block" }),
    ];
  },

  addCommands() {
    return {
      insertGallery:
        (attrs: InsertGalleryAttrs) =>
        ({ commands }: CommandProps) => {
          return commands.insertContent({ type: this.name, attrs });
        },
      updateGallery:
        (attrs: Partial<InsertGalleryAttrs>) =>
        ({ commands }: CommandProps) => {
          return commands.updateAttributes(this.name, attrs);
        },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(GalleryBlockView);
  },
});
