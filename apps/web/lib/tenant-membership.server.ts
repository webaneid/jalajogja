// SATU aturan "anggota tenant" untuk seluruh app (Harga Anggota via session-type.server.ts, Produsen
// anggota via lib/producer.server.ts). Ubah di SINI kalau aturannya berubah — berlaku ke semuanya.
//
// Aturan: baris tenant_memberships untuk tenant itu dengan status IN ('active','alumni'); khusus tenant
// tipe FORUM wajib forum_status = 'active' (forum = opt-in, harus resmi — bukan pending/rejected/
// suspended). ⚠️ User sempat bilang "anggota tenant aktif"; implementasi ikut aturan tiket event
// (aktif + alumni). Kalau mau "aktif saja": ubah MEMBERSHIP_STATUSES di bawah (berlaku juga untuk
// Harga Anggota). Catatan: syarat tiket event (event/actions.ts) memakai query sendiri dan TIDAK
// mengecek forum_status — celah lama, sengaja tidak disentuh di sini.
import "server-only";
import { and, eq, inArray, type SQL } from "drizzle-orm";
import { db, tenantMemberships } from "@jalajogja/db";

export const MEMBERSHIP_STATUSES = ["active", "alumni"] as const;

/** Kondisi WHERE atas `tenant_memberships` untuk "anggota sah tenant ini" (tanpa kondisi memberId). */
export function tenantMembershipConditions(tenantId: string, tenantType: string | null | undefined): SQL[] {
  return [
    eq(tenantMemberships.tenantId, tenantId),
    inArray(tenantMemberships.status, [...MEMBERSHIP_STATUSES]),
    ...(tenantType === "forum" ? [eq(tenantMemberships.forumStatus, "active")] : []),
  ];
}

/** Apakah satu anggota adalah anggota sah tenant ini? */
export async function isTenantMember(
  memberId: string,
  tenant: { id: string; tenantType: string | null | undefined },
): Promise<boolean> {
  const [row] = await db
    .select({ id: tenantMemberships.id })
    .from(tenantMemberships)
    .where(and(eq(tenantMemberships.memberId, memberId), ...tenantMembershipConditions(tenant.id, tenant.tenantType)))
    .limit(1);
  return !!row;
}

/** Himpunan memberId (dari daftar) yang anggota sah tenant ini — untuk cek massal tanpa N+1. */
export async function filterTenantMembers(
  memberIds: string[],
  tenant: { id: string; tenantType: string | null | undefined },
): Promise<Set<string>> {
  if (memberIds.length === 0) return new Set();
  const rows = await db
    .select({ memberId: tenantMemberships.memberId })
    .from(tenantMemberships)
    .where(and(inArray(tenantMemberships.memberId, memberIds), ...tenantMembershipConditions(tenant.id, tenant.tenantType)));
  return new Set(rows.map((r) => r.memberId));
}
