// Custom Permalink Structure (docs/arsitektur-import-export-post-wordpress.md § 5) — SATU
// helper server-only yang menutup SEMUA kebutuhan href-building untuk post di seluruh app
// (post card, header search, hero, arsip, canonical, admin Public Link Picker, WordPress
// import). TIDAK perlu split client-safe — dikonfirmasi tidak ada satu pun consumer client-side
// yang membangun path sendiri, semua konsumsi `href` yang sudah jadi dari server.
import "server-only";
import { getSetting, upsertSetting, type TenantDb } from "@jalajogja/db";
import { getTenantTimezone } from "./tenant-timezone.server";
import { utcIsoToLocalDatetime } from "./tenant-timezone";

export const PERMALINK_STRUCTURES = [
  "default", "post_name", "date_name", "category_name", "category_date_name",
] as const;
export type PermalinkStructure = typeof PERMALINK_STRUCTURES[number];

export const PERMALINK_LABELS: Record<PermalinkStructure, { label: string; example: string }> = {
  default:            { label: "Default (aman & ringkas)",        example: "/post/berita-silaturahmi" },
  post_name:          { label: "Nama Artikel Saja",                example: "/berita-silaturahmi" },
  date_name:          { label: "Tanggal + Nama Artikel",           example: "/2026/07/berita-silaturahmi" },
  category_name:      { label: "Kategori + Nama Artikel",          example: "/post/kegiatan/berita-silaturahmi" },
  category_date_name: { label: "Kategori + Tanggal + Nama Artikel", example: "/kegiatan/2026/07/berita-silaturahmi" },
};

export async function getTenantPermalink(tenantDb: TenantDb): Promise<PermalinkStructure> {
  const value = await getSetting<string>(tenantDb, "permalink_structure", "website");
  return (PERMALINK_STRUCTURES as readonly string[]).includes(value ?? "")
    ? (value as PermalinkStructure)
    : "default";
}

export async function setTenantPermalink(tenantDb: TenantDb, structure: PermalinkStructure): Promise<void> {
  await upsertSetting(tenantDb, "permalink_structure", "website", structure);
}

type PathInput = {
  slug: string;
  categorySlug: string | null;
  year: string | null;
  month: string | null;
};

// Pure, internal — semua cabang fallback ke /post/{slug} kalau data prasyarat (kategori/tanggal)
// kosong, supaya URL tetap valid meski post belum punya kategori atau tanggal publish.
function buildPostPath(permalink: PermalinkStructure, post: PathInput): string {
  switch (permalink) {
    case "post_name":
      return `/${post.slug}`;
    case "date_name":
      return post.year && post.month ? `/${post.year}/${post.month}/${post.slug}` : `/post/${post.slug}`;
    case "category_name":
      return post.categorySlug ? `/post/${post.categorySlug}/${post.slug}` : `/post/${post.slug}`;
    case "category_date_name":
      return post.categorySlug && post.year && post.month
        ? `/${post.categorySlug}/${post.year}/${post.month}/${post.slug}`
        : `/post/${post.slug}`;
    case "default":
    default:
      return `/post/${post.slug}`;
  }
}

type PostRowInput = {
  slug: string;
  categorySlug: string | null;
  publishedAt: Date | string | null;
};

// SATU fungsi yang dipanggil oleh SEMUA query-builder post di seluruh app — fetch permalink
// tenant + timezone tenant SEKALI, lalu tambahkan `href` (relatif, TANPA baseUrl prefix — pola
// sama legacyUrlRedirects.redirectTo) ke setiap baris.
export async function resolvePostHrefs<T extends PostRowInput>(
  tenantDb: TenantDb,
  rows: T[],
): Promise<(T & { href: string })[]> {
  if (rows.length === 0) return [];

  const [permalink, timezone] = await Promise.all([
    getTenantPermalink(tenantDb),
    getTenantTimezone(tenantDb),
  ]);

  return rows.map((r) => {
    let year: string | null = null;
    let month: string | null = null;
    if (r.publishedAt) {
      const iso = typeof r.publishedAt === "string" ? r.publishedAt : r.publishedAt.toISOString();
      const local = utcIsoToLocalDatetime(iso, timezone); // "YYYY-MM-DDTHH:MM"
      year = local.slice(0, 4);
      month = local.slice(5, 7);
    }
    const href = buildPostPath(permalink, { slug: r.slug, categorySlug: r.categorySlug, year, month });
    return { ...r, href };
  });
}
