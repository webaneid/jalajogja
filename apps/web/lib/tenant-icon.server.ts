import "server-only";
import sharp from "sharp";
import { createTenantDb, getSettings } from "@jalajogja/db";
import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { getFile, s3, tenantBucket } from "@/lib/minio";

// Ikon tenant (favicon / apple-touch-icon / ikon manifest) — docs/arsitektur-favicon.md § 3.1.
// Sumber: settings.general.favicon_url, lalu logo_url sebagai cadangan. Hanya URL MinIO milik bucket
// TENANT ITU SENDIRI yang diterima; berkas dibaca lewat SDK S3 (bukan fetch URL) → tanpa SSRF dan
// tenant tidak bisa membaca bucket tenant lain.

export const TENANT_ICON_SIZES = [32, 48, 180, 192, 512] as const;
export type TenantIconSize = typeof TENANT_ICON_SIZES[number];

export function parseIconSize(raw: string): TenantIconSize | null {
  const n = Number(raw);
  return (TENANT_ICON_SIZES as readonly number[]).includes(n) ? (n as TenantIconSize) : null;
}

const MAX_SOURCE_BYTES = 5 * 1024 * 1024;

// Hanya format raster. SVG/PDF DITOLAK: SVG dirasterisasi librsvg dan dapat memuat referensi eksternal.
const RASTER_FORMATS = new Set(["png", "jpeg", "webp", "gif", "avif", "heif", "tiff"]);

// Cache negatif: sumber rusak/tidak terbaca tidak boleh memicu baca S3 + Sharp berulang di tiap request bot.
const failures = new Map<string, number>();
const FAILURE_TTL_MS = 5 * 60_000;

/** Path objek di bucket tenant dari URL publik MinIO; null bila bukan milik bucket tenant ini. */
export function extractOwnObjectPath(slug: string, url: unknown): string | null {
  if (typeof url !== "string" || !url) return null;
  const base = process.env.MINIO_PUBLIC_URL ?? "http://localhost:9000";
  const prefix = `${base}/${tenantBucket(slug)}/`;
  if (!url.startsWith(prefix)) return null;
  const path = url.slice(prefix.length).split(/[?#]/)[0];
  if (!path || path.includes("..") || path.startsWith("/")) return null;
  return path;
}

/** Path objek sumber ikon: favicon dulu, lalu logo. null = tenant belum punya ikon yang bisa dipakai. */
export async function resolveIconSourcePath(slug: string): Promise<string | null> {
  const general = await getSettings(createTenantDb(slug), "general");
  return extractOwnObjectPath(slug, general.favicon_url) ?? extractOwnObjectPath(slug, general.logo_url);
}

// Cache LRU sederhana. Kunci memuat path objek sumber → ganti favicon = kunci baru = otomatis segar.
const cache = new Map<string, Buffer>();
const MAX_CACHE = 200;

/** Render ikon PNG persegi. null bila tidak ada sumber / sumber tidak terbaca. */
export async function renderTenantIconPng(slug: string, size: TenantIconSize): Promise<Buffer | null> {
  const path = await resolveIconSourcePath(slug);
  if (!path) return null;

  const key = `${slug}:${size}:${path}`;
  const hit = cache.get(key);
  if (hit) { cache.delete(key); cache.set(key, hit); return hit; }

  const failedAt = failures.get(key);
  if (failedAt && Date.now() - failedAt < FAILURE_TTL_MS) return null;
  const fail = (): null => {
    failures.set(key, Date.now());
    if (failures.size > MAX_CACHE) failures.delete(failures.keys().next().value as string);
    return null;
  };

  try {
    // Cek ukuran lewat HEAD SEBELUM mengunduh — objek besar di bucket tenant tidak boleh dimuat penuh ke memori.
    const head = await s3.send(new HeadObjectCommand({ Bucket: tenantBucket(slug), Key: path }));
    if (!head.ContentLength || head.ContentLength > MAX_SOURCE_BYTES) return fail();

    const source = await getFile(slug, path);
    if (source.length === 0 || source.length > MAX_SOURCE_BYTES) return fail();

    const meta = await sharp(source, { limitInputPixels: 25_000_000 }).metadata();
    if (!meta.format || !RASTER_FORMATS.has(meta.format)) return fail();

    let img = sharp(source, { limitInputPixels: 25_000_000 })
      .resize(size, size, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } });
    // iOS menghitamkan transparansi pada apple-touch-icon; manifest juga lebih aman berlatar putih.
    if (size >= 180) img = img.flatten({ background: "#ffffff" });
    const png = await img.png().toBuffer();

    cache.set(key, png);
    if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value as string);
    return png;
  } catch (err) {
    console.error(`[tenant-icon] gagal render ${slug} ${size}px:`, err);
    return fail();
  }
}
