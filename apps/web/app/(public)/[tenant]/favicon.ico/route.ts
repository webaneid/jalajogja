import { NextResponse } from "next/server";
import { isActiveTenant } from "@/lib/tenant-active";
import { renderTenantIconPng } from "@/lib/tenant-icon.server";

// /favicon.ico di CUSTOM DOMAIN tenant (middleware me-rewrite ke /{slug}/favicon.ico) — docs/arsitektur-favicon.md § 3.3.
// Berisi PNG 48px (semua browser modern menerima PNG pada /favicon.ico). Tanpa ikon tenant → ikon platform.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const { tenant: slug } = await params;
  if (!(await isActiveTenant(slug))) return new NextResponse("Not Found", { status: 404 });

  const png = await renderTenantIconPng(slug, 48);
  if (!png) return new NextResponse(null, { status: 302, headers: { Location: "/icon.svg" } });
  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type":  "image/png",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
