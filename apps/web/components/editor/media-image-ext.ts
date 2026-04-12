// Custom Image extension — simpan mediaId dari Media Library
// Extend @tiptap/extension-image, tambah attribute data-media-id di HTML output
// Name tetap "image" untuk replace base Image (StarterKit tidak include Image)

import { Image } from "@tiptap/extension-image";
import type { CommandProps } from "@tiptap/core";

export const MediaImage = Image.extend({
  // Tetap "image" — replace base extension, bukan tambah baru
  name: "image",

  addAttributes() {
    return {
      // Inherit: src, alt, title dari base Image
      ...this.parent?.(),

      // ID dari media library (media.id di DB)
      mediaId: {
        default: null,
        parseHTML: (element) =>
          element.getAttribute("data-media-id") ?? null,
        renderHTML: (attributes) => {
          if (!attributes.mediaId) return {};
          return { "data-media-id": attributes.mediaId };
        },
      },
    };
  },
});

// Type helper untuk command insertMediaImage
export type InsertMediaImageAttrs = {
  src: string;       // URL publik MinIO (untuk render)
  alt?: string;      // altText dari media DB
  title?: string;    // title dari media DB
  mediaId: string;   // media.id — referensi ke DB
};

// Extend command types agar TypeScript aware
declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    mediaImage: {
      insertMediaImage: (attrs: InsertMediaImageAttrs) => ReturnType;
    };
  }
}

// Re-export dengan commands helper
export const MediaImageExtension = MediaImage.extend({
  addCommands() {
    return {
      ...this.parent?.(),
      insertMediaImage:
        (attrs: InsertMediaImageAttrs) =>
        ({ commands }: CommandProps) => {
          return commands.setImage(attrs);
        },
    };
  },
});
