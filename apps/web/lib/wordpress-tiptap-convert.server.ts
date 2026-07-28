// Konversi HTML bersih (WordPress, sudah lewat sanitizeGutenbergHtml + rewriteInlineImages)
// ke Tiptap JSON string — docs/arsitektur-import-export-post-wordpress.md § 7.2 Tahap B.
// Dibuktikan bekerja di Fase 0 POC (2026-07-27) — generateJSON() dari @tiptap/html/server
// TIDAK crash server-side dengan ekstensi custom project ini.

import "server-only";
import { generateJSON } from "@tiptap/html/server";
import { WORDPRESS_IMPORT_TIPTAP_EXTENSIONS } from "./wordpress-tiptap-extensions.server";

// Return null kalau parsing gagal — JANGAN throw, biarkan pemanggil (commitImportChunkAction)
// tandai baris itu status='error' + simpan HTML mentah untuk review manual, TANPA menggagalkan
// baris lain dalam chunk yang sama (§ 7.2).
export async function convertHtmlToTiptapJson(html: string): Promise<string | null> {
  try {
    const json = await generateJSON(html, WORDPRESS_IMPORT_TIPTAP_EXTENSIONS);
    return JSON.stringify(json);
  } catch {
    return null;
  }
}
