import "server-only";
import crypto from "crypto";

// Semua fungsi OAuth untuk "Connect Instagram" — lihat docs/arsitektur-instagram-embed.md.
// Kredensial platform (META_APP_ID/META_APP_SECRET) dari env var, satu untuk semua tenant.
// Token hasil koneksi tiap tenant disimpan terpisah di tenant.settings (lib/instagram-feed.server.ts).

const AUTHORIZE_URL     = "https://api.instagram.com/oauth/authorize";
const TOKEN_URL         = "https://api.instagram.com/oauth/access_token";
const GRAPH_BASE        = "https://graph.instagram.com";
const SCOPE             = "instagram_business_basic";

function getRedirectUri(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://jalakarta.com";
  return `${base}/api/instagram/oauth/callback`;
}

// State param membawa slug tenant lintas redirect Meta — ditandatangani (HMAC) supaya tidak
// bisa dipalsukan (mis. tenant A memicu callback yang tersimpan ke tenant B). Pola sama dengan
// cookie signing WA OTP login (lesson lama), pakai BETTER_AUTH_SECRET yang sudah ada — bukan
// secret baru.
function signState(slug: string): string {
  const secret = process.env.BETTER_AUTH_SECRET ?? "";
  const payload = Buffer.from(JSON.stringify({ slug, ts: Date.now() })).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyState(state: string): { slug: string } | null {
  const secret = process.env.BETTER_AUTH_SECRET ?? "";
  const [payload, sig] = state.split(".");
  if (!payload || !sig) return null;
  const expectedSig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  if (sig !== expectedSig) return null;
  try {
    const { slug, ts } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    // State kadaluarsa setelah 10 menit — cukup untuk selesaikan alur consent Instagram.
    if (Date.now() - ts > 10 * 60 * 1000) return null;
    return { slug };
  } catch {
    return null;
  }
}

export function buildInstagramAuthorizeUrl(slug: string): string {
  const params = new URLSearchParams({
    client_id:     process.env.META_APP_ID ?? "",
    redirect_uri:  getRedirectUri(),
    response_type: "code",
    scope:         SCOPE,
    state:         signState(slug),
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

type ShortLivedToken = { accessToken: string; userId: string };

export async function exchangeCodeForShortLivedToken(code: string): Promise<ShortLivedToken> {
  const body = new URLSearchParams({
    client_id:     process.env.META_APP_ID ?? "",
    client_secret: process.env.META_APP_SECRET ?? "",
    grant_type:    "authorization_code",
    redirect_uri:  getRedirectUri(),
    code,
  });
  const res = await fetch(TOKEN_URL, { method: "POST", body });
  if (!res.ok) {
    throw new Error(`Gagal tukar code jadi token: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return { accessToken: data.access_token, userId: String(data.user_id) };
}

export async function exchangeForLongLivedToken(shortLivedToken: string): Promise<{ accessToken: string; expiresInSec: number }> {
  const params = new URLSearchParams({
    grant_type:    "ig_exchange_token",
    client_secret: process.env.META_APP_SECRET ?? "",
    access_token:  shortLivedToken,
  });
  const res = await fetch(`${GRAPH_BASE}/access_token?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Gagal tukar ke long-lived token: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return { accessToken: data.access_token, expiresInSec: data.expires_in };
}

export async function refreshLongLivedToken(token: string): Promise<{ accessToken: string; expiresInSec: number }> {
  const params = new URLSearchParams({ grant_type: "ig_refresh_token", access_token: token });
  const res = await fetch(`${GRAPH_BASE}/refresh_access_token?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Gagal refresh token: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return { accessToken: data.access_token, expiresInSec: data.expires_in };
}

export async function fetchInstagramProfile(accessToken: string): Promise<{ igUserId: string; username: string }> {
  const params = new URLSearchParams({ fields: "user_id,username", access_token: accessToken });
  const res = await fetch(`${GRAPH_BASE}/me?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Gagal ambil profil Instagram: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return { igUserId: String(data.user_id), username: data.username };
}

export type InstagramGraphMediaItem = {
  id:              string;
  caption?:        string;
  mediaType:       "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  mediaUrl?:       string;
  thumbnailUrl?:   string;
  permalink:       string;
  timestamp:       string;
};

export async function fetchInstagramMedia(
  accessToken: string,
  igUserId: string,
  limit: number,
): Promise<InstagramGraphMediaItem[]> {
  const params = new URLSearchParams({
    fields:       "id,caption,media_type,media_url,permalink,thumbnail_url,timestamp",
    access_token: accessToken,
    limit:        String(limit),
  });
  const res = await fetch(`${GRAPH_BASE}/${igUserId}/media?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Gagal ambil media Instagram: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return (data.data ?? []).map((m: Record<string, unknown>) => ({
    id:           m.id,
    caption:      m.caption,
    mediaType:    m.media_type,
    mediaUrl:     m.media_url,
    thumbnailUrl: m.thumbnail_url,
    permalink:    m.permalink,
    timestamp:    m.timestamp,
  }));
}
