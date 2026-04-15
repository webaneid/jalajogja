// Render body surat: Tiptap JSON → HTML, atau plain text → escaped HTML
// Dipakai di halaman detail surat dan template PDF (server-side)
//
// PENTING: semua extension di sini harus server-safe (tidak boleh akses window/document).
// - Jangan import @tiptap/extension-link langsung — pakai ServerLink (tanpa click handler)
// - Jangan import @tiptap/extension-table langsung — pakai ServerTable* (tanpa resizable)
// - Jangan import extension yang pakai ReactNodeViewRenderer (@tiptap/react)
// - EmbedBlock → stub server-safe (tanpa addNodeView)
// - MediaImageExtension → aman (extends @tiptap/extension-image, tanpa browser API)

import { generateHTML, Node, Mark, mergeAttributes } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import { MediaImageExtension } from "@/components/editor/media-image-ext";

// Link server-safe: hanya renderHTML, tanpa click handler / window access
const ServerLink = Mark.create({
  name: "link",
  addAttributes() {
    return {
      href:   { default: null },
      target: { default: "_blank" },
      rel:    { default: "noopener noreferrer" },
      class:  { default: null },
      title:  { default: null },
    };
  },
  parseHTML() { return [{ tag: "a[href]" }]; },
  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return ["a", mergeAttributes(HTMLAttributes as Record<string, string>), 0];
  },
});

// Table server-safe: tanpa resizable (resizable pakai DOM/window)
const ServerTable = Node.create({
  name: "table",
  group: "block",
  content: "tableRow+",
  parseHTML() { return [{ tag: "table" }]; },
  renderHTML() { return ["table", 0]; },
});
const ServerTableRow = Node.create({
  name: "tableRow",
  content: "(tableCell | tableHeader)*",
  parseHTML() { return [{ tag: "tr" }]; },
  renderHTML() { return ["tr", 0]; },
});
const ServerTableCell = Node.create({
  name: "tableCell",
  content: "block+",
  addAttributes() { return { colspan: { default: 1 }, rowspan: { default: 1 } }; },
  parseHTML() { return [{ tag: "td" }]; },
  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return ["td", mergeAttributes(HTMLAttributes as Record<string, string>), 0];
  },
});
const ServerTableHeader = Node.create({
  name: "tableHeader",
  content: "block+",
  addAttributes() { return { colspan: { default: 1 }, rowspan: { default: 1 } }; },
  parseHTML() { return [{ tag: "th" }]; },
  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return ["th", mergeAttributes(HTMLAttributes as Record<string, string>), 0];
  },
});

// Stub server-safe untuk EmbedBlock — sama persis schema-nya tapi tanpa addNodeView
// (ReactNodeViewRenderer tidak bisa dipakai di server)
const EmbedBlockRender = Node.create({
  name: "embedBlock",
  group: "block",
  atom: true,
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
    return [{ tag: 'div[data-type="embed-block"]' }];
  },
  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return ["div", mergeAttributes(HTMLAttributes as Record<string, string>, { "data-type": "embed-block" })];
  },
});

const RENDER_EXTENSIONS = [
  StarterKit,
  Underline,
  ServerLink,
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  TextStyle,
  Color.configure({ types: ["textStyle"] }),
  Highlight.configure({ multicolor: true }),
  ServerTable,
  ServerTableRow,
  ServerTableCell,
  ServerTableHeader,
  MediaImageExtension,
  EmbedBlockRender,
];

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Sanitasi Tiptap JSON: hapus text node kosong yang menyebabkan
// "Empty text nodes are not allowed" di generateHTML.
// Terjadi saat autolink memecah {{variable}} menjadi link node + text node kosong.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sanitizeTiptapJson(node: any): any {
  if (!node || typeof node !== "object") return node;
  if (node.content) {
    node.content = (node.content as any[])
      .map(sanitizeTiptapJson)
      .filter((child: any) => {
        // Buang text node dengan text kosong atau undefined
        if (child.type === "text") return child.text != null && child.text !== "";
        return true;
      });
  }
  return node;
}

export function renderBody(body: string | null | undefined): string {
  if (!body) return "";
  try {
    const json = JSON.parse(body);
    // Pastikan ini memang Tiptap doc
    if (json?.type !== "doc") return escapeHtml(body).replace(/\n/g, "<br>");
    return generateHTML(sanitizeTiptapJson(json), RENDER_EXTENSIONS);
  } catch {
    // Plain text fallback — escape HTML + newline → <br>
    return escapeHtml(body).replace(/\n/g, "<br>");
  }
}
