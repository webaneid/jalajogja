// RelatedLinkBlock — Tiptap Node Extension untuk Callout "Baca Juga" / Artikel Terkait
import { Node, mergeAttributes, type CommandProps } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { RelatedLinkBlockView } from "./related-link-view";

export type InsertRelatedLinkAttrs = {
  label: string;      // "Baca Juga:", "Artikel Terkait:", "Lihat Juga:", "Rekomendasi:"
  title: string;      // Judul artikel / link
  url: string;        // Tautan (internal path atau full http URL)
  isExternal?: boolean;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    relatedLinkBlock: {
      insertRelatedLink: (attrs: InsertRelatedLinkAttrs) => ReturnType;
      updateRelatedLink: (attrs: Partial<InsertRelatedLinkAttrs>) => ReturnType;
    };
  }
}

export const RelatedLinkBlock = Node.create({
  name: "relatedLinkBlock",
  group: "block",
  atom: true,       // leaf node — tidak bisa dimasuki kursor langsung
  draggable: true,

  addAttributes() {
    return {
      label:      { default: "Baca Juga:" },
      title:      { default: "" },
      url:        { default: "" },
      isExternal: { default: false },
    };
  },

  parseHTML() {
    return [
      { tag: 'div[data-type="related-link-block"]' },
      {
        tag: 'p.wp-block-callout',
        getAttrs: (element: HTMLElement) => {
          const a = element.querySelector('a');
          const strong = element.querySelector('strong');
          return {
            label: strong?.textContent || 'Baca Juga:',
            title: a?.textContent || element.textContent || '',
            url: a?.getAttribute('href') || '',
            isExternal: (a?.getAttribute('href') || '').startsWith('http'),
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes as Record<string, string>, {
        "data-type": "related-link-block",
        "class": "related-link-callout-node",
      }),
    ];
  },

  addCommands() {
    return {
      insertRelatedLink:
        (attrs: InsertRelatedLinkAttrs) =>
        ({ commands }: CommandProps) => {
          const isExternal = attrs.isExternal ?? attrs.url.startsWith("http");
          return commands.insertContent({
            type: this.name,
            attrs: { ...attrs, isExternal },
          });
        },
      updateRelatedLink:
        (attrs: Partial<InsertRelatedLinkAttrs>) =>
        ({ commands }: CommandProps) => {
          return commands.updateAttributes(this.name, attrs);
        },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(RelatedLinkBlockView);
  },
});
