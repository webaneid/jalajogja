export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getTenantAccess } from "@/lib/tenant";
import { buildInstagramAuthorizeUrl } from "@/lib/instagram-oauth.server";

// Mulai alur OAuth "Connect Instagram" — dipanggil dari tombol "Hubungkan Instagram" di
// InstagramEditor (section builder landing page, components/website/section-editors.tsx).
// Auth: harus login sebagai admin tenant itu (getTenantAccess), bukan endpoint publik.
export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug wajib diisi" }, { status: 400 });

  const access = await getTenantAccess(slug);
  if (!access) {
    return NextResponse.redirect(new URL(`/app/login`, request.url));
  }

  if (!process.env.META_APP_ID) {
    return NextResponse.json(
      { error: "META_APP_ID belum diset di environment server. Hubungi admin platform." },
      { status: 500 },
    );
  }

  return NextResponse.redirect(buildInstagramAuthorizeUrl(slug));
}
