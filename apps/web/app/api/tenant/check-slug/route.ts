import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, tenants } from "@jalajogja/db";

function isValidSlug(slug: string): boolean {
  if (slug.length < 3 || slug.length > 20) return false;
  if (!/^[a-z0-9-]+$/.test(slug)) return false;
  if (slug.startsWith("-") || slug.endsWith("-")) return false;
  return true;
}

export async function GET(request: NextRequest) {
  // Tolak request tanpa referer yang benar (basic abuse prevention)
  // TODO: ganti dengan rate limiting per-IP via Redis saat production
  const referer = request.headers.get("referer") ?? "";
  const host = request.headers.get("host") ?? "";

  if (!referer.includes(host)) {
    return NextResponse.json(
      { available: false, reason: "forbidden" },
      { status: 403 }
    );
  }

  const slug = request.nextUrl.searchParams.get("slug") ?? "";

  if (!isValidSlug(slug)) {
    return NextResponse.json({ available: false, reason: "invalid" });
  }

  const [existing] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);

  return NextResponse.json({ available: !existing });
}
