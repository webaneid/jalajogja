// Versi "schema-only" dari 3 custom Tiptap Node extension yang di live editor punya
// `addNodeView()` (EmbedBlock, GalleryBlock, RelatedLinkBlock) — dipakai KHUSUS oleh
// `lib/wordpress-tiptap-extensions.server.ts` untuk `generateJSON()` saat commit import
// WordPress (docs/arsitektur-import-export-post-wordpress.md § 7.2).
//
// KENAPA FILE INI ADA (bug ditemukan lewat testing sungguhan, bukan diantisipasi sejak awal):
// `generateJSON()` hanya butuh SCHEMA node (name/group/attrs/parseHTML/renderHTML/addCommands)
// untuk parsing HTML → Tiptap JSON — TIDAK PERNAH butuh `addNodeView()` (itu murni config
// RENDER INTERAKTIF di browser, tidak relevan untuk konversi satu-arah HTML→JSON). Tapi versi
// LIVE ketiga extension itu (`components/editor/{embed-block,gallery-block,related-link}-ext.ts`)
// meng-import `ReactNodeViewRenderer` dari `@tiptap/react` di level modul — begitu file itu
// di-import (bahkan cuma untuk ambil definisi Node-nya, addNodeView tidak pernah dipanggil),
// Next.js's bundler (Turbopack/webpack) mencoba mem-bundle `@tiptap/react` (paket BROWSER-ONLY,
// butuh react-dom) ke dalam server bundle Server Action `import-wordpress/actions.ts` — crash
// runtime: "Class extends value undefined is not a constructor or null" saat modul
// `embed-block-ext.ts` dievaluasi. Bug ini TIDAK ketangkap saat POC (`bun run` script biasa,
// Fase 0) karena Bun tidak melakukan transform RSC/server-bundle-aware seperti Next.js — POC
// berhasil, tapi itu bukan bukti aman untuk bundling Next.js sungguhan.
//
// Fix: duplikasi PERSIS definisi node (attrs/parseHTML/renderHTML/addCommands) dari ketiga
// extension, TANPA baris `addNodeView()`/import `@tiptap/react`/import komponen View React sama
// sekali. Field `label`/`title`/`url`/dst yang di-generate `generateJSON()` untuk node ini tetap
// identik dengan versi live — cuma kemampuan "di-edit interaktif di browser" yang hilang, yang
// memang tidak pernah dipakai jalur import (hasil konversi langsung disimpan ke `posts.content`,
// dibuka nanti sebagai post biasa dengan kemampuan edit dari editor LIVE, bukan dari sini).
//
// ATURAN: kalau `components/editor/{embed-block,gallery-block,related-link}-ext.ts`'s schema
// (attrs/parseHTML/renderHTML/addCommands) berubah, file ini WAJIB disamakan manual — sama
// seperti aturan di `wordpress-tiptap-extensions.server.ts`.

import { Node, mergeAttributes } from "@tiptap/core";

// `addCommands()` SENGAJA TIDAK diikutkan di ketiganya — `generateJSON()` cuma pakai
// `parseHTML()`/`renderHTML()`/`addAttributes()` (schema murni), commands hanya relevan untuk
// interaksi editor via `editor.commands.xxx()` yang tidak pernah dipanggil di jalur import ini.

// ── EmbedBlock (schema-only) ────────────────────────────────────────────────────────────────
export const EmbedBlockSchemaOnly = Node.create({
  name: "embedBlock",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      url:          { default: null },
      html:         { default: null },
      provider:     { default: null },
      title:        { default: null },
      thumbnailUrl: { default: null },
      videoId:      { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="embed-block"]' }];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return ["div", mergeAttributes(HTMLAttributes as Record<string, string>, { "data-type": "embed-block" })];
  },
});

// ── GalleryBlock (schema-only) ───────────────────────────────────────────────────────────────
export const GalleryBlockSchemaOnly = Node.create({
  name: "galleryBlock",
  group: "block",
  atom: true,
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
    return ["div", mergeAttributes(HTMLAttributes as Record<string, string>, { "data-type": "gallery-block" })];
  },
});

// ── RelatedLinkBlock (schema-only) ──────────────────────────────────────────────────────────
export const RelatedLinkBlockSchemaOnly = Node.create({
  name: "relatedLinkBlock",
  group: "block",
  atom: true,
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
        tag: "p.wp-block-callout",
        getAttrs: (element: HTMLElement) => {
          const a = element.querySelector("a");
          const strong = element.querySelector("strong");
          return {
            label: strong?.textContent || "Baca Juga:",
            title: a?.textContent || element.textContent || "",
            url: a?.getAttribute("href") || "",
            isExternal: (a?.getAttribute("href") || "").startsWith("http"),
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
});
