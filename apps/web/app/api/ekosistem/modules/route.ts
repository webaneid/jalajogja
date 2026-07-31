export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { getEnabledEkosistemModules } from "@/lib/ekosistem-modules.server";

// Modul ekosistem (Usaha/Pesantren/Profesional) yang aktif untuk tenant ini — dipanggil
// client-side oleh DirectoryEditor (section builder, components/website/section-editors.tsx)
// supaya opsi "Tipe Direktori" cuma menawarkan modul yang benar-benar dinyalakan admin di
// /settings/general. Lihat lib/ekosistem-modules.ts + docs/arsitektur-ekosistem.md.
export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug wajib diisi" }, { status: 400 });

  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const enabledModules = await getEnabledEkosistemModules(createTenantDb(slug));
  return NextResponse.json(enabledModules);
}
