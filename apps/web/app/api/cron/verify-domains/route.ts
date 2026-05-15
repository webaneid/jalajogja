export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db, tenants } from "@jalajogja/db";
import { eq, inArray } from "drizzle-orm";
import { promises as dns } from "dns";

// IP VPS jalakarta — harus update jika server pindah
const VPS_IP = "72.61.215.7";

// Cron secret — panggil dengan header Authorization: Bearer <CRON_SECRET>
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: NextRequest) {
  // Auth check — hanya boleh dipanggil dengan secret yang benar
  if (CRON_SECRET) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // Ambil semua tenant dengan status pending atau failed
  const pendingTenants = await db.query.tenants.findMany({
    where: inArray(tenants.customDomainStatus, ["pending", "failed"]),
    columns: { id: true, slug: true, customDomain: true },
  });

  if (pendingTenants.length === 0) {
    return NextResponse.json({ checked: 0, activated: 0 });
  }

  let activated = 0;
  const results: { domain: string; status: string; ip?: string }[] = [];

  for (const tenant of pendingTenants) {
    if (!tenant.customDomain) continue;

    try {
      // Lookup A record domain
      const addresses = await dns.resolve4(tenant.customDomain);
      const pointsToVps = addresses.includes(VPS_IP);

      results.push({ domain: tenant.customDomain, status: pointsToVps ? "active" : "failed", ip: addresses[0] });

      await db
        .update(tenants)
        .set({
          customDomainStatus:    pointsToVps ? "active" : "failed",
          customDomainVerifiedAt: pointsToVps ? new Date() : null,
          updatedAt:             new Date(),
        })
        .where(eq(tenants.id, tenant.id));

      if (pointsToVps) activated++;
    } catch {
      // DNS lookup gagal (domain tidak ada, atau propagasi belum selesai)
      results.push({ domain: tenant.customDomain, status: "failed" });
      await db
        .update(tenants)
        .set({ customDomainStatus: "failed", updatedAt: new Date() })
        .where(eq(tenants.id, tenant.id));
    }
  }

  return NextResponse.json({ checked: pendingTenants.length, activated, results });
}
