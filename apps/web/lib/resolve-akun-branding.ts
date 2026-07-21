import { and, eq } from "drizzle-orm";
import { db, members, tenants, tenantMemberships, platformSettings } from "@jalajogja/db";
import { getTenantSeoBase } from "@/lib/tenant-seo";
import { resolveOrgLabels } from "@/lib/tenant-org-label";

// Resolusi branding kartu anggota `/akun` — TIDAK selalu tenant yang sedang dibrowsing.
// Lihat docs/arsitektur-akun.md § Resolusi Branding Kartu Anggota untuk konteks lengkap.
//
// Prinsip "1 ID for all": member bisa browsing /akun di tenant manapun meski bukan
// anggota genuine tenant itu. Urutan resolusi:
//   1. Genuine member tenant yang sedang dibrowsing (ada baris tenant_memberships,
//      APAPUN membershipType-nya — kolom itu tidak pernah dipakai sebagai filter
//      di manapun di codebase, jadi "ada baris" = genuine member) → pakai branding
//      tenant itu.
//   2. Bukan genuine member → cari tenant cabang resmi member sendiri via
//      members.primaryCabangRefId → tenants.refCabangId (kalau cabangnya sudah
//      onboard jadi tenant aktif).
//   3. Cabang resmi belum onboard sama sekali → fallback ke branding default
//      platform (public.platform_settings, dikelola dari /platform/settings).
//
// Hanya berlaku untuk akun bertipe "member" — akun publik tidak punya konsep
// cabang, selalu pakai tenant yang sedang dibrowsing (lihat caller).

export type ResolvedAkunBranding = {
  logoUrl:     string | null;
  orgName:     string;
  memberLabel: string;
};

export async function resolveAkunBranding(
  memberId: string,
  browsedSlug: string,
): Promise<ResolvedAkunBranding> {
  const [browsedTenant] = await db
    .select({
      id:             tenants.id,
      name:           tenants.name,
      tenantType:     tenants.tenantType,
      marhalahYear:   tenants.marhalahYear,
      marhalahPeriod: tenants.marhalahPeriod,
    })
    .from(tenants)
    .where(eq(tenants.slug, browsedSlug))
    .limit(1);

  if (browsedTenant) {
    const [membership] = await db
      .select({ id: tenantMemberships.id })
      .from(tenantMemberships)
      .where(and(
        eq(tenantMemberships.memberId, memberId),
        eq(tenantMemberships.tenantId, browsedTenant.id),
      ))
      .limit(1);

    if (membership) {
      const seo = await getTenantSeoBase(browsedSlug);
      return {
        logoUrl: seo.logoUrl,
        orgName: browsedTenant.name,
        memberLabel: resolveOrgLabels({
          name:           browsedTenant.name,
          tenantType:     (browsedTenant.tenantType as "cabang" | "marhalah" | "forum") ?? "cabang",
          marhalahYear:   browsedTenant.marhalahYear ?? null,
          marhalahPeriod: (browsedTenant.marhalahPeriod as "awal" | "akhir" | null) ?? null,
        }).memberLabel,
      };
    }
  }

  // Bukan genuine member tenant yang dibrowsing → cari cabang resmi member via primaryCabangRefId
  const [memberRow] = await db
    .select({ primaryCabangRefId: members.primaryCabangRefId })
    .from(members)
    .where(eq(members.id, memberId))
    .limit(1);

  if (memberRow?.primaryCabangRefId) {
    const [homeTenant] = await db
      .select({
        slug:           tenants.slug,
        name:           tenants.name,
        tenantType:     tenants.tenantType,
        marhalahYear:   tenants.marhalahYear,
        marhalahPeriod: tenants.marhalahPeriod,
      })
      .from(tenants)
      .where(and(
        eq(tenants.refCabangId, memberRow.primaryCabangRefId),
        eq(tenants.isActive, true),
      ))
      .limit(1);

    if (homeTenant) {
      const seo = await getTenantSeoBase(homeTenant.slug);
      return {
        logoUrl: seo.logoUrl,
        orgName: homeTenant.name,
        memberLabel: resolveOrgLabels({
          name:           homeTenant.name,
          tenantType:     (homeTenant.tenantType as "cabang" | "marhalah" | "forum") ?? "cabang",
          marhalahYear:   homeTenant.marhalahYear ?? null,
          marhalahPeriod: (homeTenant.marhalahPeriod as "awal" | "akhir" | null) ?? null,
        }).memberLabel,
      };
    }
  }

  // Fallback: branding default platform — cabang resmi belum onboard jadi tenant sama sekali
  const [platformRow] = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.id, "default"))
    .limit(1);

  const orgName = platformRow?.defaultOrgName ?? "IKPM Gontor";
  return {
    logoUrl:     platformRow?.defaultLogoUrl ?? null,
    orgName,
    memberLabel: `Anggota ${orgName}`,
  };
}
