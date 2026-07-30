export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createTenantDb, upsertSetting } from "@jalajogja/db";
import {
  verifyState,
  exchangeCodeForShortLivedToken,
  exchangeForLongLivedToken,
  fetchInstagramProfile,
  normalizeIgUsername,
} from "@/lib/instagram-oauth.server";

// Callback dari Meta setelah admin consent — lihat docs/arsitektur-instagram-embed.md § 3.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code   = params.get("code");
  const state  = params.get("state");
  const error  = params.get("error_description") ?? params.get("error");

  const fail = (slug: string | null, message: string) => {
    const target = slug ? `/app/${slug}/settings/website` : "/app/login";
    return NextResponse.redirect(
      new URL(`${target}?instagram=error&msg=${encodeURIComponent(message)}`, request.url),
    );
  };

  const stateResult = state ? verifyState(state) : null;
  if (!stateResult) return fail(null, "State tidak valid atau kadaluarsa, coba hubungkan lagi.");
  const { slug, expectedAccount } = stateResult;

  if (error || !code) return fail(slug, error ?? "Instagram tidak mengembalikan authorization code.");

  try {
    const { accessToken: shortToken } = await exchangeCodeForShortLivedToken(code);
    const { accessToken: longToken, expiresInSec } = await exchangeForLongLivedToken(shortToken);
    const { igUserId, username } = await fetchInstagramProfile(longToken);

    // Validasi akun — kalau admin menspesifikasikan "Nama Akun (Linimasa)" sebelum klik
    // "Hubungkan Instagram", username hasil login WAJIB cocok persis (case-insensitive, "@"
    // diabaikan). Cegah salah akun ter-connect diam-diam tanpa admin sadari.
    if (expectedAccount && normalizeIgUsername(expectedAccount) !== normalizeIgUsername(username)) {
      return fail(
        slug,
        `Anda login sebagai @${username}, tapi section ini disetel untuk akun @${normalizeIgUsername(expectedAccount)}. ` +
        `Hubungkan ulang dengan akun yang benar, atau kosongkan field "Nama Akun (Linimasa)" kalau ingin menerima akun ini.`,
      );
    }

    const tenantClient = createTenantDb(slug);
    await upsertSetting(tenantClient, "instagram_config", "website", {
      igUserId,
      username,
      accessToken:    longToken,
      tokenExpiresAt: new Date(Date.now() + expiresInSec * 1000).toISOString(),
      connectedAt:    new Date().toISOString(),
    });

    return NextResponse.redirect(
      new URL(`/app/${slug}/settings/website?instagram=connected`, request.url),
    );
  } catch (err) {
    console.error("[instagram/oauth/callback] Gagal menghubungkan Instagram:", err);
    return fail(slug, "Gagal menghubungkan akun Instagram. Coba lagi atau cek log server.");
  }
}
