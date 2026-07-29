export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createTenantDb, getSetting } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";

type InstagramConfig = {
  igUserId:       string;
  username:       string;
  accessToken:    string;
  tokenExpiresAt: string;
  connectedAt:    string;
};

// Status koneksi Instagram untuk ditampilkan di admin editor (InstagramEditor) — dipanggil
// client-side, TIDAK mengekspos accessToken sama sekali ke browser.
export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug wajib diisi" }, { status: 400 });

  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantClient = createTenantDb(slug);
  const config = await getSetting<InstagramConfig>(tenantClient, "instagram_config", "website");

  if (!config?.accessToken || !config.igUserId) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({
    connected:   true,
    username:    config.username,
    connectedAt: config.connectedAt,
  });
}
