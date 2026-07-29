export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createTenantDb, deleteSetting } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";

// Putuskan koneksi Instagram — hapus row settings (bukan set null, kolom JSONB NOT NULL).
export async function POST(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug wajib diisi" }, { status: 400 });

  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantClient = createTenantDb(slug);
  await deleteSetting(tenantClient, "instagram_config", "website");

  return NextResponse.json({ success: true });
}
