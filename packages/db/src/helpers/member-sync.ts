import { eq, and } from "drizzle-orm";
import { tenants } from "../schema/public/tenants";
import { tenantMemberships } from "../schema/public/tenant-memberships";
import type { PublicDb } from "../client";

/**
 * Helper untuk meng-autosinkronisasi keanggotaan tenant (tenant_memberships)
 * untuk PC IKPM Cabang (berdasarkan primaryCabangRefId), Marhalah (berdasarkan
 * graduationYear/Period), dan IKPM Pusat (TANPA syarat apa pun — setiap anggota otomatis).
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
): Promise<{ syncedCabang: boolean; syncedMarhalah: boolean; syncedPusat: boolean }> {
  let syncedCabang = false;
  let syncedMarhalah = false;
  let syncedPusat = false;

  if (!memberId) return { syncedCabang, syncedMarhalah, syncedPusat };

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

  // 3. IKPM Pusat Auto-Join — TANPA syarat apa pun, berjalan UNCONDITIONAL untuk setiap
  // pemanggilan fungsi ini (tidak digate parameter apa pun, beda dari cabang/marhalah di
  // atas). Kalau tenant tipe 'pusat' belum dibuat sama sekali, ini no-op — aman terpasang
  // sebelum tenant-nya benar-benar ada. Lihat docs/arsitektur-backbone-ikpm.md
  // § "Tenant Khusus: IKPM Pusat — Keanggotaan Tanpa Batas".
  const [pusatTenant] = await runner
    .select({ id: tenants.id })
    .from(tenants)
    .where(and(eq(tenants.tenantType, "pusat"), eq(tenants.isActive, true)))
    .limit(1);

  if (pusatTenant) {
    await runner
      .insert(tenantMemberships)
      .values({
        tenantId: pusatTenant.id,
        memberId,
        status: "active",
        registeredVia: "auto_pusat",
        membershipType: "pusat",
      })
      .onConflictDoNothing();
    syncedPusat = true;
  }

  return { syncedCabang, syncedMarhalah, syncedPusat };
}
