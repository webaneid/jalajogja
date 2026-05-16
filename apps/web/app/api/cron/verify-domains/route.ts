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

  // Ambil semua tenant dengan status pending atau failed — TIDAK proses active
  // Status active tidak pernah di-downgrade oleh cron (hanya bisa naik: pending → active)
  const pendingTenants = await db.query.tenants.findMany({
    where: inArray(tenants.customDomainStatus, ["pending", "failed"]),
    columns: { id: true, slug: true, customDomain: true, customDomainStatus: true },
  });

  if (pendingTenants.length === 0) {
    return NextResponse.json({ checked: 0, activated: 0 });
  }

  let activated = 0;
  const results: { domain: string; status: string; ip?: string; error?: string }[] = [];
  const now = new Date();

  for (const tenant of pendingTenants) {
    if (!tenant.customDomain) continue;

    try {
      // Lookup A record domain
      const addresses  = await dns.resolve4(tenant.customDomain);
      const pointsToVps = addresses.includes(VPS_IP);

      results.push({ domain: tenant.customDomain, status: pointsToVps ? "active" : "pending", ip: addresses[0] });

      if (pointsToVps) {
        // DNS sudah mengarah ke VPS → aktifkan
        await db
          .update(tenants)
          .set({
            customDomainStatus:    "active",
            customDomainVerifiedAt: now,
            domainLastCheckAt:     now,
            domainLastCheckError:  null,
            updatedAt:             now,
          })
          .where(eq(tenants.id, tenant.id));
        activated++;
      } else {
        // DNS belum mengarah ke VPS — catat hasil cek, tapi JANGAN ubah status active → failed
        // Hanya set failed jika masih pending (belum pernah active)
        await db
          .update(tenants)
          .set({
            ...(tenant.customDomainStatus === "pending" ? { customDomainStatus: "failed" as const } : {}),
            domainLastCheckAt:    now,
            domainLastCheckError: `A record: ${addresses[0] ?? "tidak ada"} (expected ${VPS_IP})`,
            updatedAt:            now,
          })
          .where(eq(tenants.id, tenant.id));
      }
    } catch (err) {
      // DNS lookup gagal (domain tidak ada, propagasi belum selesai, atau network error)
      const errorMsg = err instanceof Error ? err.message : String(err);
      results.push({ domain: tenant.customDomain, status: "error", error: errorMsg });

      // Sama: hanya set failed dari pending, status active tidak disentuh
      await db
        .update(tenants)
        .set({
          ...(tenant.customDomainStatus === "pending" ? { customDomainStatus: "failed" as const } : {}),
          domainLastCheckAt:    now,
          domainLastCheckError: `DNS lookup error: ${errorMsg}`,
          updatedAt:            now,
        })
        .where(eq(tenants.id, tenant.id));
    }
  }

  return NextResponse.json({ checked: pendingTenants.length, activated, results });
}
