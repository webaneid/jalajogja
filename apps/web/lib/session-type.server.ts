// Tier harga pembeli berdasarkan SESI login + keanggotaan — sumber kebenaran SERVER-SIDE untuk
// checkout DAN tampilan halaman produk. Server TIDAK PERNAH menerima tier dari client.
//   "public" → tamu, atau akun login non-anggota IKPM
//   "ikpm"   → punya public.members (anggota IKPM terdaftar), tapi BUKAN anggota tenant ini
//   "tenant" → anggota IKPM yang juga anggota tenant ini
// Aturan "anggota tenant ini" ada di SATU tempat: lib/tenant-membership.server.ts (juga dipakai Produsen). Lihat docs/arsitektur-product.md
// § "Model Harga Baru".
import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db, members, tenants, type ViewerTier } from "@jalajogja/db";
import { isTenantMember } from "@/lib/tenant-membership.server";

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

  // Aturan keanggotaan tenant: SATU fungsi bersama (lib/tenant-membership.server.ts).
  const isMember = await isTenantMember(member.id, tenant);

  return isMember ? "tenant" : "ikpm";
});
