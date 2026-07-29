import type { TenantDb } from "@jalajogja/db";
import { getSetting } from "@jalajogja/db";
import { fetchInstagramMedia, refreshLongLivedToken } from "./instagram-oauth.server";
import type { InstagramSectionData, InstagramItem } from "./instagram-section-designs";

type InstagramConfig = {
  igUserId:       string;
  username:       string;
  accessToken:    string;
  tokenExpiresAt: string;
  connectedAt:    string;
};

export type InstagramFeedResult = {
  connected:   boolean;
  accountName: string;
  accountUrl:  string;
  items:       InstagramItem[];
};

/**
 * Resolver Feed Instagram — SATU-SATUNYA sumber data adalah Instagram Graph API milik akun yang
 * benar-benar terhubung (OAuth, lihat docs/arsitektur-instagram-embed.md). TIDAK ADA fallback ke
 * post blog sendiri atau foto stok — kalau belum terhubung, `connected: false` dan `items: []`,
 * caller (instagram-section.tsx) menampilkan pesan "belum terhubung", bukan mengarang data.
 */
export async function resolveInstagramFeed(
  tenantClient: TenantDb,
  tenantSlug: string,
  data: InstagramSectionData,
): Promise<InstagramFeedResult> {
  const count = data.count ?? 8;
  const config = await getSetting<InstagramConfig>(tenantClient, "instagram_config", "website");

  if (!config?.accessToken || !config.igUserId) {
    return {
      connected:   false,
      accountName: data.accountName ?? "",
      accountUrl:  data.accountUrl ?? "",
      items:       [],
    };
  }

  const accountName = data.accountName || config.username;
  const accountUrl  = data.accountUrl || `https://instagram.com/${config.username}`;

  try {
    let accessToken = config.accessToken;

    // Safety net kalau cron refresh belum sempat jalan (mis. baru terhubung, atau cron belum
    // dijadwalkan di crontab VPS) — refresh inline kalau token sudah dekat expired (<10 hari).
    // Kalau baru berumur <24 jam, Meta menolak refresh (aturan Meta) — itu wajar, dibiarkan
    // gagal senyap di titik ini, cron harian yang akan menanganinya nanti.
    const daysLeft = (new Date(config.tokenExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    if (daysLeft < 10) {
      try {
        const refreshed = await refreshLongLivedToken(accessToken);
        accessToken = refreshed.accessToken;
      } catch {
        // Token mungkin belum berumur 24 jam atau sudah expired total — lanjut pakai token lama,
        // fetch media di bawah akan gagal sendiri kalau memang sudah tidak valid.
      }
    }

    const media = await fetchInstagramMedia(accessToken, config.igUserId, count);
    const items: InstagramItem[] = media
      .filter(m => m.mediaUrl || m.thumbnailUrl)
      .map(m => ({
        id:       m.id,
        imageUrl: (m.mediaType === "VIDEO" ? m.thumbnailUrl : m.mediaUrl) ?? m.mediaUrl ?? m.thumbnailUrl ?? "",
        caption:  m.caption,
        postUrl:  m.permalink,
      }));

    return { connected: true, accountName, accountUrl, items };
  } catch (err) {
    console.error(`[resolveInstagramFeed] Gagal fetch media Instagram untuk tenant ${tenantSlug}:`, err);
    // Koneksi ADA tapi fetch gagal (token invalid/dicabut user di sisi Instagram, dst) — tetap
    // laporkan connected:true supaya UI tidak salah menyuruh admin "hubungkan lagi" padahal
    // settingnya ada; tapi items kosong, caller tampilkan pesan error generik.
    return { connected: true, accountName, accountUrl, items: [] };
  }
}
