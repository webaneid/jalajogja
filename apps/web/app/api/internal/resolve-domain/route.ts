export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db, tenants } from "@jalajogja/db";
import { eq, and } from "drizzle-orm";

// Route internal — dipanggil hanya oleh middleware untuk resolve custom domain → slug.
// Tidak perlu auth, tapi dibatasi hanya dari loopback (enforced via Nginx / trust headers).
export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get("domain");
  if (!domain) return NextResponse.json({ slug: null }, { status: 400 });

  const tenant = await db.query.tenants.findFirst({
    where: and(
      eq(tenants.customDomain, domain),
      eq(tenants.customDomainStatus, "active"),
      eq(tenants.isActive, true),
    ),
    columns: { slug: true },
  });

  return NextResponse.json({ slug: tenant?.slug ?? null });
}
