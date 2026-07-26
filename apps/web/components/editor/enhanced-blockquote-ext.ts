// EnhancedBlockquote — Tiptap Extension untuk Quote + Citation / Penulis
import { Node, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    blockquote: {
      setBlockquote: () => ReturnType;
      toggleBlockquote: () => ReturnType;
      unsetBlockquote: () => ReturnType;
    };
  }
}

export const EnhancedBlockquote = Node.create({
  name: "blockquote",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      citation: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.querySelector("cite")?.textContent ||
          element.getAttribute("data-citation") ||
          null,
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.citation) return {};
          return { "data-citation": attributes.citation as string };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: "blockquote" }];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return [
      "blockquote",
      mergeAttributes(HTMLAttributes as Record<string, string>),
      0,
    ];
  },

  addCommands() {
    return {
      setBlockquote:
        () =>
        ({ commands }) => {
          return commands.wrapIn(this.name);
        },
      toggleBlockquote:
        () =>
        ({ commands }) => {
          return commands.toggleWrap(this.name);
        },
      unsetBlockquote:
        () =>
        ({ commands }) => {
          return commands.lift(this.name);
        },
    };
  },
});
