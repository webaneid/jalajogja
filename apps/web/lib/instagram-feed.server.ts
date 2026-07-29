import { eq, desc, inArray } from "drizzle-orm";
import type { TenantDb } from "@jalajogja/db";
import { getSettings } from "@jalajogja/db";
import { getImageUrl } from "./image-url";
import { resolvePostHrefs } from "./post-permalink.server";
import type { InstagramSectionData, InstagramItem } from "./instagram-section-designs";
import { DEFAULT_INSTAGRAM_MOCK_ITEMS } from "./instagram-section-designs";

/**
 * Resolver Otomatis Feed Instagram / Linimasa Karya untuk Super-App Jalakarta.
 *
 * Mengambil data secara otomatis (Zero Manual Copy-Paste) dengan urutan prioritas:
 * 1. Postingan / Karya Santri bertag 'forcreator' atau 'karya' di DB Website Tenant.
 * 2. Media Library terbaru yang di-upload oleh organisasi/anggota.
 * 3. Custom Items yang di-override oleh Admin (jika ada).
 * 4. Fallback Mock Sample Items jika data DB masih kosong.
 */
export async function resolveInstagramFeed(
  tenantClient: TenantDb,
  tenantSlug: string,
  baseUrl: string,
  data: InstagramSectionData
): Promise<{
  accountName: string;
  accountUrl: string;
  items: InstagramItem[];
}> {
  const { db, schema } = tenantClient;
  const count = data.count ?? 8;

  // 1. Resolve Nama & URL Akun Sosial Media dari Settings Tenant
  let accountName = data.accountName?.trim() || "";
  let accountUrl = data.accountUrl?.trim() || "";

  if (!accountName || !accountUrl) {
    try {
      const contactSettings = await getSettings(tenantClient, "contact");
      const socials = (contactSettings as { socials?: Record<string, string> })?.socials ?? {};
      const igHandle = socials.instagram || tenantSlug;

      if (!accountName) {
        accountName = igHandle.replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/$/, "") || tenantSlug;
      }
      if (!accountUrl) {
        accountUrl = socials.instagram?.startsWith("http")
          ? socials.instagram
          : `https://instagram.com/${accountName}`;
      }
    } catch {
      if (!accountName) accountName = tenantSlug;
      if (!accountUrl) accountUrl = `https://instagram.com/${tenantSlug}`;
    }
  }

  // 2. Jika Admin sudah mengisi items custom manual, gunakan items custom tersebut
  if (data.items && data.items.length > 0) {
    return {
      accountName,
      accountUrl,
      items: data.items.slice(0, count),
    };
  }

  // 3. OTOMATIS: Ambil dari DB Posts / Karya Santri Tenant
  try {
    const postRows = await db
      .select({
        id:           schema.posts.id,
        title:        schema.posts.title,
        slug:         schema.posts.slug,
        excerpt:      schema.posts.excerpt,
        coverId:      schema.posts.coverId,
        categorySlug: schema.postCategories.slug,
        publishedAt:  schema.posts.publishedAt,
      })
      .from(schema.posts)
      .leftJoin(schema.postCategories, eq(schema.postCategories.id, schema.posts.categoryId))
      .where(eq(schema.posts.status, "published"))
      .orderBy(desc(schema.posts.publishedAt))
      .limit(count);

    if (postRows.length > 0) {
      // Resolve cover images — inArray (BUKAN fetch semua tabel media lalu filter di JS)
      const coverIds = [...new Set(postRows.map(p => p.coverId).filter((id): id is string => Boolean(id)))];
      const mediaMap = new Map<string, string | null>();

      if (coverIds.length > 0) {
        const mediaRows = await db
          .select({ id: schema.media.id, path: schema.media.path, variants: schema.media.variants })
          .from(schema.media)
          .where(inArray(schema.media.id, coverIds));

        for (const m of mediaRows) {
          // "square" cocok untuk grid Instagram aspect-square, fallback ke large/original bawaan getImageUrl
          mediaMap.set(m.id, getImageUrl(m, tenantSlug, "square"));
        }
      }

      // href relatif (post-permalink aware, ikut setting permalink_structure tenant) + baseUrl
      // (custom-domain aware) — pola sama semua consumer PostCardData lain, jangan hardcode
      // `/${tenantSlug}/post/${slug}`.
      const rowsWithHrefs = await resolvePostHrefs(tenantClient, postRows);

      const dbItems: InstagramItem[] = rowsWithHrefs.map(p => {
        const imgUrl = p.coverId ? (mediaMap.get(p.coverId) ?? null) : null;
        return {
          id: p.id,
          imageUrl: imgUrl || DEFAULT_INSTAGRAM_MOCK_ITEMS[0].imageUrl,
          caption: p.title,
          postUrl: `${baseUrl}${p.href}`,
        };
      });

      // Jika jumlah di DB kurang dari count, lengkapi dengan fallback
      const filledItems = Array.from({ length: count }).map((_, idx) => {
        return dbItems[idx] ?? DEFAULT_INSTAGRAM_MOCK_ITEMS[idx % DEFAULT_INSTAGRAM_MOCK_ITEMS.length];
      });

      return {
        accountName,
        accountUrl,
        items: filledItems,
      };
    }
  } catch (err) {
    console.error("[resolveInstagramFeed] Failed to query DB posts:", err);
  }

  // 4. Fallback Default Sample Items
  return {
    accountName,
    accountUrl,
    items: DEFAULT_INSTAGRAM_MOCK_ITEMS.slice(0, count),
  };
}
