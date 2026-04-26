import { publicUrl } from "@/lib/minio";
import type { ImageVariants } from "@jalajogja/db";

export type ImageVariant = "original" | "large" | "medium" | "thumbnail" | "square" | "profile";

/**
 * Resolve URL lengkap untuk variant gambar tertentu.
 * Fallback chain: variant diminta → large → original → path lama (backward compat)
 */
export function getImageUrl(
  media: { path: string; variants?: ImageVariants | null },
  tenantSlug: string,
  variant: ImageVariant = "large",
): string | null {
  if (media.variants) {
    const path = media.variants[variant]
      ?? media.variants.large
      ?? media.variants.original;
    return path ? publicUrl(tenantSlug, path) : null;
  }
  // Fallback: media lama sebelum sistem variant
  return media.path ? publicUrl(tenantSlug, media.path) : null;
}
