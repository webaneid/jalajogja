// Daftar ekstensi Tiptap untuk generateJSON() saat commit import WordPress —
// docs/arsitektur-import-export-post-wordpress.md § 7.2.
//
// WAJIB SAMA SCHEMA-nya (attrs/parseHTML/renderHTML) dengan components/editor/tiptap-editor.tsx
// (§ 7.2: "kalau tidak, hasil parse HTML akan kehilangan/salah-petakan elemen yang harusnya jadi
// node/mark custom"). SENGAJA DIDUPLIKASI di sini (bukan diekstrak jadi 1 modul dipakai bersama
// editor client) — tiptap-editor.tsx adalah komponen client yang sangat sering dipakai admin,
// pola project ini (lihat CLAUDE.md — "duplikasi demi isolasi") lebih suka duplikasi kecil yang
// eksplisit ketimbang risiko menyentuh file editor live untuk kepentingan fitur import ini.
//
// PENTING — 3 extension (EmbedBlock, GalleryBlock, RelatedLinkBlock) pakai versi SCHEMA-ONLY
// dari `wordpress-import-tiptap-nodes.server.ts`, BUKAN versi live dari `components/editor/*`.
// Versi live meng-import `ReactNodeViewRenderer` dari `@tiptap/react` (paket browser-only) untuk
// `addNodeView()` — begitu diimpor (bahkan cuma untuk schema, addNodeView tidak pernah dipanggil
// oleh generateJSON()), Next.js's bundler mencoba mem-bundle `@tiptap/react` ke server bundle
// Server Action ini dan crash ("Class extends value undefined is not a constructor"). Bug ini
// TIDAK ketangkap POC Fase 0 (bare `bun run`, tidak ada transform RSC/server-bundle Next.js) —
// baru muncul saat benar-benar dipakai lewat halaman Next.js sungguhan. Lihat lesson CLAUDE.md
// untuk detail lengkap.
//
// ATURAN: setiap kali components/editor/tiptap-editor.tsx's daftar `extensions:[...]` diubah
// (tambah/hapus ekstensi, ubah opsi .configure(), ubah attrs/parseHTML/renderHTML salah satu
// dari 3 node di atas), file ini (dan wordpress-import-tiptap-nodes.server.ts untuk 3 node itu)
// WAJIB disamakan manual.

import "server-only";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import CharacterCount from "@tiptap/extension-character-count";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import { MediaImageExtension } from "@/components/editor/media-image-ext";
import { EnhancedBlockquote } from "@/components/editor/enhanced-blockquote-ext";
import {
  EmbedBlockSchemaOnly as EmbedBlock,
  GalleryBlockSchemaOnly as GalleryBlock,
  RelatedLinkBlockSchemaOnly as RelatedLinkBlock,
} from "./wordpress-import-tiptap-nodes.server";

export const WORDPRESS_IMPORT_TIPTAP_EXTENSIONS = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3, 4] },
    codeBlock: {},
    blockquote: false,
    link: false,
  }),
  EnhancedBlockquote,
  MediaImageExtension.configure({ inline: false, allowBase64: false }),
  Link.configure({
    openOnClick: false,
    autolink: false,
    HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" },
  }),
  CharacterCount.configure({ limit: undefined }),
  Placeholder.configure({ placeholder: "" }),
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  Underline,
  TextStyle,
  Color.configure({ types: ["textStyle"] }),
  Highlight.configure({ multicolor: true }),
  Table.configure({ resizable: true }),
  TableRow,
  TableHeader,
  TableCell,
  EmbedBlock,
  GalleryBlock,
  RelatedLinkBlock,
];
