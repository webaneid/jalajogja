// Render body surat: Tiptap JSON → HTML, atau plain text → escaped HTML
// Dipakai di halaman detail surat dan template PDF (server-side)
//
// PENTING: jangan import extension yang pakai @tiptap/react (ReactNodeViewRenderer)
// karena file ini di-import di server components.
// EmbedBlock → buat stub server-safe di sini (tanpa addNodeView).
// MediaImageExtension → aman, hanya import dari @tiptap/extension-image.

import { generateHTML, Node, mergeAttributes } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import { MediaImageExtension } from "@/components/editor/media-image-ext";

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
  Link.configure({ openOnClick: false }),
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  TextStyle,
  Color.configure({ types: ["textStyle"] }),
  Highlight.configure({ multicolor: true }),
  Table.configure({ resizable: false }),
  TableRow,
  TableHeader,
  TableCell,
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

export function renderBody(body: string | null | undefined): string {
  if (!body) return "";
  try {
    const json = JSON.parse(body);
    // Pastikan ini memang Tiptap doc
    if (json?.type !== "doc") return escapeHtml(body).replace(/\n/g, "<br>");
    return generateHTML(json, RENDER_EXTENSIONS);
  } catch {
    // Plain text fallback — escape HTML + newline → <br>
    return escapeHtml(body).replace(/\n/g, "<br>");
  }
}
