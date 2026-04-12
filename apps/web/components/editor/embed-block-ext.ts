// EmbedBlock — custom Tiptap Node extension untuk oEmbed universal
// Flow: user paste URL → fetch noembed.com → insert node dengan HTML hasil oEmbed
// Fetch dilakukan di UI (toolbar), command hanya terima data yang sudah siap
// Render via ReactNodeViewRenderer agar bisa handle iframe + script injection

import { Node, mergeAttributes, type CommandProps } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { EmbedBlockView } from "./embed-block-view";

// ── Types ─────────────────────────────────────────────────────────────────────

export type OEmbedResult = {
  url: string;
  html: string;           // HTML dari oEmbed provider
  provider: string;       // "YouTube", "Twitter", dll
  title?: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
};

// ── noembed.com fetch helper ──────────────────────────────────────────────────

export async function fetchOEmbed(url: string): Promise<OEmbedResult | null> {
  try {
    const apiUrl = `https://noembed.com/embed?url=${encodeURIComponent(url)}&maxwidth=800`;
    const res = await fetch(apiUrl);
    if (!res.ok) return null;
    const data = await res.json();

    // noembed mengembalikan { error } jika URL tidak dikenali
    if (data.error || !data.html) return null;

    return {
      url,
      html:         data.html,
      provider:     data.provider_name ?? "Embed",
      title:        data.title,
      thumbnailUrl: data.thumbnail_url,
      width:        data.width,
      height:       data.height,
    };
  } catch {
    return null;
  }
}

// ── Command type augmentation ─────────────────────────────────────────────────

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    embedBlock: {
      insertEmbed: (data: OEmbedResult) => ReturnType;
    };
  }
}

// ── EmbedBlock Extension ──────────────────────────────────────────────────────

export const EmbedBlock = Node.create({
  name: "embedBlock",
  group: "block",
  atom: true,       // tidak bisa di-edit langsung — treated sebagai satu unit
  draggable: true,

  addAttributes() {
    return {
      url:          { default: null },
      html:         { default: null },
      provider:     { default: null },
      title:        { default: null },
      thumbnailUrl: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="embed-block"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    // atom: true → leaf node, tidak boleh ada content hole (tanpa angka 0 di akhir)
    return [
      "div",
      mergeAttributes(HTMLAttributes as Record<string, string>, { "data-type": "embed-block" }),
    ];
  },

  addCommands() {
    return {
      insertEmbed:
        (data: OEmbedResult) =>
        ({ commands }: CommandProps) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              url:          data.url,
              html:         data.html,
              provider:     data.provider,
              title:        data.title ?? null,
              thumbnailUrl: data.thumbnailUrl ?? null,
            },
          });
        },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(EmbedBlockView);
  },
});
