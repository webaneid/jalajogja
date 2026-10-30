import { NextResponse } from "next/server";
import { isActiveTenant } from "@/lib/tenant-active";
import { parseIconSize, renderTenantIconPng } from "@/lib/tenant-icon.server";

// Ikon PNG persegi per tenant — docs/arsitektur-favicon.md § 3.1. `size` hanya dari daftar tetap.
// Tanpa sumber ikon → 302 ke ikon platform (cadangan terakhir).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tenant: string; size: string }> },
) {
  const { tenant: slug, size: rawSize } = await params;
  const size = parseIconSize(rawSize);
  if (!size) return new NextResponse("Not Found", { status: 404 });
  if (!(await isActiveTenant(slug))) return new NextResponse("Not Found", { status: 404 });

  const png = await renderTenantIconPng(slug, size);
  if (!png) {
    // Location RELATIF (bukan new URL(.., req.url)) — di balik proxy req.url bisa berisi host internal.
    return new NextResponse(null, { status: 302, headers: { Location: size >= 180 ? "/apple-icon.png" : "/icon.svg" } });
  }
  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type":  "image/png",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
