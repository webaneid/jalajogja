import { and, eq } from "drizzle-orm";
import { db, members, tenants, tenantMemberships, platformSettings, createTenantDb, getSettings } from "@jalajogja/db";
import { getTenantSeoBase } from "@/lib/tenant-seo";
import { resolveOrgLabels } from "@/lib/tenant-org-label";
import { checkMemberEligibility } from "@/lib/member-eligibility";
import { getEnabledEkosistemModules } from "@/lib/ekosistem-modules.server";
import { enabledModuleList } from "@/lib/ekosistem-modules";

const DEFAULT_COLOR = "#2563eb"; // sama dengan default warna tenant baru (settings/display)

async function getTenantPrimaryColor(slug: string): Promise<string> {
  const tenantClient = createTenantDb(slug);
  const displaySettings = await getSettings(tenantClient, "display");
  return (displaySettings.primary_color as string | undefined) || DEFAULT_COLOR;
}

// Resolusi branding kartu anggota `/akun` — TIDAK selalu tenant yang sedang dibrowsing.
// Lihat docs/arsitektur-akun.md § Resolusi Branding Kartu Anggota untuk konteks lengkap.
//
// Prinsip "1 ID for all": member bisa browsing /akun di tenant manapun meski bukan
// anggota genuine tenant itu. Urutan resolusi (berlaku sama untuk logo, nama, DAN
// warna — ketiganya selalu diambil dari tenant hasil resolusi yang SAMA, tidak pernah
// campur, mis. logo dari tenant A tapi warna dari tenant B):
//   1. Genuine member tenant yang sedang dibrowsing:
//      - Cabang/marhalah: ada baris tenant_memberships apa pun (status/type tidak jadi
//        filter tambahan — auto-populate tidak punya "tahap verifikasi" terpisah).
//      - Forum: baris tenant_memberships HARUS forum_status = 'active' — genuinely
//        sudah menyelesaikan alur `/gabung`, bukan sekadar "ada baris" (baris bisa saja
//        hasil registrasi biasa lama sebelum fix ini, atau forum_status masih
//        pending/rejected). Lihat docs/arsitektur-backbone-ikpm.md § "Alur Pendaftaran
//        Forum v2" — standar label keanggotaan, dikunci 2026-07-24.
//   2. Bukan genuine member → cari tenant cabang resmi member sendiri via
//      members.primaryCabangRefId → tenants.refCabangId (kalau cabangnya sudah
//      onboard jadi tenant aktif).
//   3. Cabang resmi belum onboard sama sekali → fallback ke branding default
//      platform (public.platform_settings, dikelola dari /platform/settings).
//
// Prasyarat BARU sebelum ketiga langkah di atas dievaluasi jadi "Anggota X": profil
// member harus lolos checkMemberEligibility() (data pribadi Step1+2 lengkap + minimal 1
// dari usaha/pesantren/profesional) — SAMA untuk SEMUA tipe tenant, bukan cuma forum.
// Belum lolos → memberLabel selalu "Lengkapi Data" + verified:false (checkmark tidak
// ditampilkan caller), TAPI logo/orgName/primaryColor tetap di-resolve normal (identitas
// visual kartu tidak berubah, cuma klaim status keanggotaannya yang jujur).
//
// Hanya berlaku untuk akun bertipe "member" — akun publik tidak punya konsep
// cabang, selalu pakai tenant yang sedang dibrowsing (lihat caller).

export type ResolvedAkunBranding = {
  logoUrl:      string | null;
  orgName:      string;
  memberLabel:  string;
  primaryColor: string; // hex, mis. "#2563eb"
  verified:     boolean; // false = "Lengkapi Data" — caller tidak boleh render checkmark
};

export async function resolveAkunBranding(
  memberId: string,
  browsedSlug: string,
): Promise<ResolvedAkunBranding> {
  // Eligibility dinilai terhadap modul yang aktif di tenant yang SEDANG DIBROWSING —
  // konsisten prinsip "logo/nama/warna/label semua dari tenant hasil resolusi yang sama".
  const enabledModulesConfig = await getEnabledEkosistemModules(createTenantDb(browsedSlug));
  const eligibility = await checkMemberEligibility(memberId, enabledModuleList(enabledModulesConfig));

  type Resolved = Omit<ResolvedAkunBranding, "verified">;
  let resolved: Resolved | null = null;

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
    const isForum = browsedTenant.tenantType === "forum";
    const [membership] = await db
      .select({ id: tenantMemberships.id })
      .from(tenantMemberships)
      .where(and(
        eq(tenantMemberships.memberId, memberId),
        eq(tenantMemberships.tenantId, browsedTenant.id),
        ...(isForum ? [eq(tenantMemberships.forumStatus, "active")] : []),
      ))
      .limit(1);

    if (membership) {
      const [seo, primaryColor] = await Promise.all([
        getTenantSeoBase(browsedSlug),
        getTenantPrimaryColor(browsedSlug),
      ]);
      resolved = {
        logoUrl: seo.logoUrl,
        orgName: browsedTenant.name,
        memberLabel: resolveOrgLabels({
          name:           browsedTenant.name,
          tenantType:     (browsedTenant.tenantType as "cabang" | "marhalah" | "forum") ?? "cabang",
          marhalahYear:   browsedTenant.marhalahYear ?? null,
          marhalahPeriod: (browsedTenant.marhalahPeriod as "awal" | "akhir" | null) ?? null,
        }).memberLabel,
        primaryColor,
      };
    }
  }

  // Bukan genuine member tenant yang dibrowsing → cari cabang resmi member via primaryCabangRefId
  if (!resolved) {
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
        const [seo, primaryColor] = await Promise.all([
          getTenantSeoBase(homeTenant.slug),
          getTenantPrimaryColor(homeTenant.slug),
        ]);
        resolved = {
          logoUrl: seo.logoUrl,
          orgName: homeTenant.name,
          memberLabel: resolveOrgLabels({
            name:           homeTenant.name,
            tenantType:     (homeTenant.tenantType as "cabang" | "marhalah" | "forum") ?? "cabang",
            marhalahYear:   homeTenant.marhalahYear ?? null,
            marhalahPeriod: (homeTenant.marhalahPeriod as "awal" | "akhir" | null) ?? null,
          }).memberLabel,
          primaryColor,
        };
      }
    }
  }

  // Fallback: branding default platform — cabang resmi belum onboard jadi tenant sama sekali
  if (!resolved) {
    const [platformRow] = await db
      .select()
      .from(platformSettings)
      .where(eq(platformSettings.id, "default"))
      .limit(1);

    const orgName = platformRow?.defaultOrgName ?? "IKPM Gontor";
    resolved = {
      logoUrl:      platformRow?.defaultLogoUrl ?? null,
      orgName,
      memberLabel:  `Anggota ${orgName}`,
      primaryColor: platformRow?.defaultColor ?? DEFAULT_COLOR,
    };
  }

  if (!eligibility.eligible) {
    return { ...resolved, memberLabel: "Lengkapi Data", verified: false };
  }
  return { ...resolved, verified: true };
}
