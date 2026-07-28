export const dynamic = "force-dynamic";
// GET /api/website/export-wxr?slug={slug}
// Unduh export Post tenant ini sebagai file WordPress WXR XML — docs/arsitektur-import-
// export-post-wordpress.md § 2.3, § 8 Fase 3. Anti vendor lock-in: tenant bisa migrasi balik
// ke WordPress kapan saja via Tools -> Import -> WordPress di situs WP mana pun.

import { NextRequest } from "next/server";
import { getTenantAccess } from "@/lib/tenant";
import { hasFullAccess } from "@/lib/permissions";
import { generateWxrExport } from "@/lib/wordpress-wxr-export.server";

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) return Response.json({ error: "slug diperlukan" }, { status: 400 });

  const access = await getTenantAccess(slug);
  if (!access) return Response.json({ error: "Akses ditolak." }, { status: 401 });
  if (!hasFullAccess(access.tenantUser, "website")) {
    return Response.json({ error: "Akses ditolak." }, { status: 403 });
  }

  let xml: string;
  try {
    xml = await generateWxrExport(slug);
  } catch (err) {
    console.error("[export-wxr]", err);
    return Response.json({ error: "Gagal membuat file export." }, { status: 500 });
  }

  const dateStamp = new Date().toISOString().slice(0, 10);

  return new Response(xml, {
    headers: {
      "Content-Type":        "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}-wordpress-export-${dateStamp}.xml"`,
    },
  });
}
