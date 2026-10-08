// Tier harga pembeli berdasarkan SESI login + keanggotaan — sumber kebenaran SERVER-SIDE untuk
// checkout DAN tampilan halaman produk. Server TIDAK PERNAH menerima tier dari client.
//   "public" → tamu, atau akun login non-anggota IKPM
//   "ikpm"   → punya public.members (anggota IKPM terdaftar), tapi BUKAN anggota tenant ini
//   "tenant" → anggota IKPM yang juga anggota tenant ini
// Aturan "anggota tenant ini" SAMA dengan syarat tiket event requiresMembership
// (event/actions.ts): tenant_memberships status IN ('active','alumni'); khusus tenant tipe forum
// wajib forum_status = 'active' (forum = opt-in, harus resmi terdaftar — bukan pending/rejected/
// suspended; pola sama resolve-akun-branding.ts). Lihat docs/arsitektur-product.md
// § "Model Harga Baru".
import "server-only";
import { cache } from "react";
import { and, eq, inArray } from "drizzle-orm";
import { db, members, tenants, tenantMemberships, type ViewerTier } from "@jalajogja/db";

export const resolveViewerTier = cache(async (
  userId: string | null | undefined,
  slug:   string,
): Promise<ViewerTier> => {
  if (!userId) return "public";

  const [member] = await db
    .select({ id: members.id })
    .from(members)
    .where(eq(members.betterAuthUserId, userId))
    .limit(1);
  if (!member) return "public";

  const [tenant] = await db
    .select({ id: tenants.id, tenantType: tenants.tenantType })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);
  if (!tenant) return "ikpm";

  const [membership] = await db
    .select({ id: tenantMemberships.id })
    .from(tenantMemberships)
    .where(and(
      eq(tenantMemberships.tenantId, tenant.id),
      eq(tenantMemberships.memberId, member.id),
      inArray(tenantMemberships.status, ["active", "alumni"]),
      ...(tenant.tenantType === "forum" ? [eq(tenantMemberships.forumStatus, "active")] : []),
    ))
    .limit(1);

  return membership ? "tenant" : "ikpm";
});
