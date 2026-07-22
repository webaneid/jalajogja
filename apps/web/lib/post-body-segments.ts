// Pecah body post (Tiptap JSON) jadi segmen — teks/HTML biasa (lewat renderBody, server-safe
// string manipulation) diselingi galeri foto (dirender via komponen React <Gallery> asli supaya
// dapat lightbox popup, bukan grid statis <table> yang dipakai renderBody untuk galleryBlock).
//
// TIDAK menyentuh lib/letter-render.ts (dipakai bersama render PDF surat) — cukup panggil
// renderBody() sebagai black box per potongan node, tidak perlu export internal apa pun dari sana.
//
// Kolom SELALU dipaksa 3 (grid-cols-2 sm:grid-cols-3 dari GalleryGrid — otomatis 2 kolom mobile,
// 3 kolom desktop) — mengabaikan `layout`/`columns` yang mungkin tersimpan di node, supaya galeri
// di post selalu konsisten "otomatis", admin tidak perlu (dan tidak akan) mengatur apa pun.

import { renderBody } from "./letter-render";
import type { GalleryItem } from "./gallery";

export type PostBodySegment =
  | { type: "html"; html: string }
  | { type: "gallery"; items: GalleryItem[]; key: string };

type RenderContext = { imageBaseUrl?: string };

export function splitPostBodySegments(
  content: string | null | undefined,
  ctx: RenderContext,
): PostBodySegment[] {
  if (!content) return [];

  let doc: { type?: string; content?: unknown[] };
  try {
    doc = JSON.parse(content) as { type?: string; content?: unknown[] };
  } catch {
    return [{ type: "html", html: renderBody(content, ctx) }];
  }

  if (doc?.type !== "doc" || !Array.isArray(doc.content)) {
    return [{ type: "html", html: renderBody(content, ctx) }];
  }

  const segments: PostBodySegment[] = [];
  let buffer: unknown[] = [];
  let galleryIndex = 0;

  function flushBuffer() {
    if (buffer.length === 0) return;
    const html = renderBody(JSON.stringify({ type: "doc", content: buffer }), ctx);
    if (html) segments.push({ type: "html", html });
    buffer = [];
  }

  for (const node of doc.content) {
    const n = node as { type?: string; attrs?: { items?: GalleryItem[] } };
    if (n.type === "galleryBlock") {
      flushBuffer();
      const items = n.attrs?.items ?? [];
      if (items.length > 0) {
        segments.push({ type: "gallery", items, key: `post-gallery-${galleryIndex}` });
      }
      galleryIndex += 1;
    } else {
      buffer.push(node);
    }
  }
  flushBuffer();

  return segments;
}
