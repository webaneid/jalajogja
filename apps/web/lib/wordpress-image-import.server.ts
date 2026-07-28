// Download + import 1 gambar dari URL WordPress lama ke Media Library Jalakarta —
// docs/arsitektur-import-export-post-wordpress.md § 7.1. Dipakai untuk featured image, OG
// image (Yoast), DAN gambar inline di konten (§ 7.2) — 3 use case, satu pipeline yang sama.
//
// Pola & modul SAMA PERSIS upload manual admin (app/api/media/upload/route.ts): getVariantsForModule
// + processImage() (generate variant Sharp) + upload ke MinIO + insert tenant.media dengan
// variants JSONB terisi — BUKAN insert mentah tanpa variant (akan merusak semua tempat yang
// mengandalkan resolveMediaUrl()/fallback variant).
//
// Kegagalan (404, network error, bukan gambar valid) TIDAK PERNAH throw — return null. Sesuai
// § 7.1: "Jika gambar lama 404 atau koneksi terputus, coverId di-set null. Artikel tetap
// berhasil di-import tanpa menggagalkan proses."

import "server-only";
import { randomUUID } from "node:crypto";
import { Window } from "happy-dom";
import { createTenantDb } from "@jalajogja/db";
import { safeFetch } from "./wordpress-import-security";
import { processImage, getVariantsForModule, shouldBypass, type VariantKey } from "@/lib/image-processor";
import { uploadFile, ensureBucket, publicUrl } from "@/lib/minio";

const MODULE = "website";
const MAX_SIZE = 20 * 1024 * 1024; // 20 MB — sama dengan cap upload manual

const VARIANT_SUFFIXES: Record<VariantKey, string> = {
  original: "_ori", large: "_lg", medium: "_md", thumbnail: "_th",
  square: "_sq", "square-large": "_sql", profile: "_pf",
};
// Variant seaspek (large/medium/thumbnail, 1.91:1) didahulukan dari variant kotak
// (square-large/square, 1:1) sebelum profile/original — gambar dari the_content()/gallery
// WordPress biasanya ~700-800px (lebih kecil dari target "large" 1200px), kalau langsung
// loncat ke "square" akan memotong paksa gambar landscape jadi kotak. Bug ditemukan dari
// laporan user: gambar konten hasil import selalu square. Sama persis pola di
// app/api/media/upload/route.ts (§ "SAMA PERSIS upload manual admin").
const PATH_PRIORITY: VariantKey[] = ["large", "medium", "thumbnail", "square-large", "square", "profile", "original"];

export type ImportedImage = { mediaId: string; url: string };

export async function downloadAndImportImage(
  slug: string,
  imageUrl: string,
  altText: string | null,
  importBatchId: string,
): Promise<ImportedImage | null> {
  try {
    const res = await safeFetch(imageUrl);
    if (!res.ok) return null;

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/") || shouldBypass(contentType)) {
      // Bukan gambar raster (atau SVG — di luar scope pipeline Sharp) — lewati, bukan error.
      return null;
    }

    const contentLength = res.headers.get("content-length");
    if (contentLength && Number(contentLength) > MAX_SIZE) return null;

    const arrayBuffer = await res.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_SIZE) return null;
    const buffer = Buffer.from(arrayBuffer);

    const variantKeys = getVariantsForModule(MODULE);
    const allVariants = await processImage(buffer, variantKeys, {});

    await ensureBucket(slug);
    const now = new Date();
    const basePath = `${MODULE}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}`;
    const uuid = randomUUID();

    const variantPaths: Record<string, string> = {};
    await Promise.all(
      variantKeys.map(async (name) => {
        const output = allVariants[name];
        if (!output) return; // sengaja dilewati (sumber terlalu kecil untuk variant ini) — bukan error
        const filePath = `${basePath}/${uuid}${VARIANT_SUFFIXES[name]}.webp`;
        await uploadFile(slug, filePath, output, "image/webp");
        variantPaths[name] = filePath;
      }),
    );

    const primaryKey = PATH_PRIORITY.find((k) => variantPaths[k]) ?? variantKeys[0];
    const primaryPath = variantPaths[primaryKey];
    if (!primaryPath) return null; // semua variant gagal (seharusnya tidak pernah terjadi, "original" selalu ada)

    const originalName = deriveOriginalName(imageUrl);

    const { db, schema } = createTenantDb(slug);
    const [media] = await db.insert(schema.media).values({
      filename: primaryPath.split("/").pop() ?? `${uuid}.webp`,
      originalName,
      mimeType: "image/webp",
      originalMime: contentType,
      size: allVariants[primaryKey]?.length ?? 0,
      path: primaryPath,
      module: MODULE,
      altText: altText || null,
      variants: variantPaths,
      processingStatus: "done",
      importBatchId,
      originalExpiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    }).returning({ id: schema.media.id });

    return { mediaId: media.id, url: publicUrl(slug, primaryPath) };
  } catch {
    // Sharp gagal decode (bukan gambar valid/corrupt), koneksi terputus, dll — jangan gagalkan
    // seluruh baris import karena satu gambar bermasalah (§ 7.1).
    return null;
  }
}

// ── Rewrite gambar inline di konten (§ 7.2, temuan KRITIS § 15.3) ─────────────────────────────
// WAJIB dipanggil SETELAH sanitizeGutenbergHtml() (Tahap A), SEBELUM generateJSON() (Tahap B) —
// <img src> polos WordPress ter-parse jadi node `image` Tiptap tapi mediaId-nya NULL SELAMANYA
// kalau HTML tidak di-rewrite dulu (MediaImage extension baca mediaId dari attribute
// data-media-id, bukan dari src). Pakai happy-dom (peer dependency @tiptap/html yang sudah ada)
// untuk parsing+rewrite yang robust — bukan regex string-replace yang rawan salah terhadap
// variasi urutan/quoting atribut HTML.
//
// Dedup per URL UNIK dalam SATU artikel — gambar yang sama dipakai berkali-kali (jarang, tapi
// mungkin) tidak diunduh ulang. Gambar yang GAGAL diunduh (404/error) DIBIARKAN APA ADANYA
// (src lama, tanpa data-media-id) — bukan dihapus, konsisten prinsip non-destruktif: <img> tetap
// mencoba load dari server WordPress lama (mungkin masih hidup selama masa transisi migrasi).
export async function rewriteInlineImages(
  slug: string,
  html: string,
  importBatchId: string,
): Promise<string> {
  const window = new Window();
  const document = window.document;
  document.body.innerHTML = html;

  const imgs = Array.from(document.querySelectorAll("img"));
  if (imgs.length === 0) return html;

  const cache = new Map<string, ImportedImage | null>();

  for (const img of imgs) {
    const src = img.getAttribute("src");
    if (!src || cache.has(src)) continue;
    const alt = img.getAttribute("alt");
    cache.set(src, await downloadAndImportImage(slug, src, alt, importBatchId));
  }

  for (const img of imgs) {
    const src = img.getAttribute("src");
    if (!src) continue;
    const imported = cache.get(src);
    if (!imported) continue; // gagal unduh — biarkan src lama apa adanya
    img.setAttribute("src", imported.url);
    img.setAttribute("data-media-id", imported.mediaId);
  }

  return document.body.innerHTML;
}

function deriveOriginalName(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const last = pathname.split("/").pop();
    return last && last.length > 0 ? decodeURIComponent(last) : "imported-image";
  } catch {
    return "imported-image";
  }
}
