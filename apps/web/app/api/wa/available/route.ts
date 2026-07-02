export const dynamic = "force-dynamic";
// GET /api/wa/available?slug={slug}
// Cek apakah WA gateway aktif untuk tenant ini + toggle OTP mana yang diaktifkan.
// Dipakai oleh register form dan forgot-password untuk memutuskan apakah tampilkan OTP step.
// Endpoint publik — tidak butuh auth, aman karena hanya return boolean.

import { NextRequest, NextResponse } from "next/server";
import { createTenantDb, getSettings, db, tenants } from "@jalajogja/db";
import { eq } from "drizzle-orm";
import type { WaNotifConfig } from "@/lib/whatsapp";

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.json({ available: false });

  const [tenantRow] = await db.select({ id: tenants.id, isActive: tenants.isActive })
    .from(tenants).where(eq(tenants.slug, slug)).limit(1);
  if (!tenantRow?.isActive) return NextResponse.json({ available: false });

  try {
    const tenantClient = createTenantDb(slug);
    const settings     = await getSettings(tenantClient, "notif");
    const config       = settings["whatsapp_config"] as WaNotifConfig | undefined;

    const available     = !!(config?.device_id && config.verified);
    const registerOtp   = available && !!(config?.notifications?.otp_register);
    const resetOtp      = available && !!(config?.notifications?.otp_reset_password);

    return NextResponse.json({ available, registerOtp, resetOtp });
  } catch {
    return NextResponse.json({ available: false });
  }
}
