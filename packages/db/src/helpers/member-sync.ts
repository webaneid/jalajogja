import { eq, and } from "drizzle-orm";
import { tenants } from "../schema/public/tenants";
import { tenantMemberships } from "../schema/public/tenant-memberships";
import type { PublicDb } from "../client";

/**
 * Helper untuk meng-autosinkronisasi keanggotaan tenant (tenant_memberships)
 * untuk PC IKPM Cabang (berdasarkan primaryCabangRefId) dan Marhalah (berdasarkan graduationYear/Period).
 *
 * Dipanggil dari:
 * - Admin Create Member (createMemberAction)
 * - Admin Edit Member (updateMemberAction)
 * - Bulk Import Commit (commitImportAction)
 * - User Self-Service Profile Update (PATCH /api/akun/member-data)
 */
export async function syncAutoTenantMemberships(
  runner: PublicDb | any, // Menerima publicDb instance maupun Drizzle Transaction (tx)
  memberId: string,
  primaryCabangRefId?: string | null,
  graduationYear?: number | null,
  graduationPeriod?: "awal" | "akhir" | null,
): Promise<{ syncedCabang: boolean; syncedMarhalah: boolean }> {
  let syncedCabang = false;
  let syncedMarhalah = false;

  if (!memberId) return { syncedCabang, syncedMarhalah };

  // 1. Cabang Auto-Join (PC IKPM Cabang)
  if (primaryCabangRefId) {
    const [cabangTenant] = await runner
      .select({ id: tenants.id })
      .from(tenants)
      .where(
        and(
          eq(tenants.refCabangId, primaryCabangRefId),
          eq(tenants.tenantType, "cabang"),
          eq(tenants.isActive, true),
        )
      )
      .limit(1);

    if (cabangTenant) {
      await runner
        .insert(tenantMemberships)
        .values({
          tenantId: cabangTenant.id,
          memberId,
          status: "active",
          registeredVia: "auto_cabang",
          membershipType: "cabang",
        })
        .onConflictDoNothing();
      syncedCabang = true;
    }
  }

  // 2. Marhalah Auto-Join (Angkatan)
  if (graduationYear) {
    const conditions = [
      eq(tenants.tenantType, "marhalah"),
      eq(tenants.marhalahYear, graduationYear),
      eq(tenants.isActive, true),
    ];
    if (graduationYear === 1999 && graduationPeriod) {
      conditions.push(eq(tenants.marhalahPeriod, graduationPeriod));
    }

    const [marhalahTenant] = await runner
      .select({ id: tenants.id })
      .from(tenants)
      .where(and(...conditions))
      .limit(1);

    if (marhalahTenant) {
      await runner
        .insert(tenantMemberships)
        .values({
          tenantId: marhalahTenant.id,
          memberId,
          status: "active",
          registeredVia: "auto_marhalah",
          membershipType: "marhalah",
        })
        .onConflictDoNothing();
      syncedMarhalah = true;
    }
  }

  return { syncedCabang, syncedMarhalah };
}
