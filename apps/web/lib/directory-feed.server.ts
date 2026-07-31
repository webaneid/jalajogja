import "server-only";
import { eq, and, inArray, desc } from "drizzle-orm";
import type { TenantDb } from "@jalajogja/db";
import {
  db as publicDb,
  tenants, tenantMemberships,
  memberBusinesses, memberProfessionals, memberOwnedPesantren,
  members, addresses,
} from "@jalajogja/db";
import { getTenantSeoBase } from "@/lib/tenant-seo";
import { getEnabledEkosistemModules } from "@/lib/ekosistem-modules.server";
import type { DirectorySectionData, DirectoryItem, DirectoryType } from "./directory-section-designs";

type DirectoryLabels = { defaultTitle: string; archiveHref: string; typeLabel: string };

const LABELS_MAP: Record<DirectoryType, (slug: string) => DirectoryLabels> = {
  usaha:       (slug) => ({ defaultTitle: "Usaha & Bisnis Anggota",          archiveHref: `/${slug}/usaha`,       typeLabel: "Usaha" }),
  profesional: (slug) => ({ defaultTitle: "Komunitas & Praktik Profesional", archiveHref: `/${slug}/profesional`, typeLabel: "Profesional" }),
  pesantren:   (slug) => ({ defaultTitle: "Pesantren Alumni & Mitra",        archiveHref: `/${slug}/pesantren`,   typeLabel: "Pesantren" }),
};

export type DirectoryFeedResult = {
  title:       string;
  items:       DirectoryItem[];
  archiveHref: string;
  typeLabel:   string;
  orgName:     string;
};

/**
 * Resolver Direktori Organisasi (Usaha/Profesional/Pesantren) untuk section landing page.
 * SATU-SATUNYA sumber data adalah `public.member_businesses`/`member_professionals`/
 * `member_owned_pesantren` milik anggota TENANT INI (di-scope via `tenant_memberships`,
 * pola identik `/usaha`, `/profesional`, `/pesantren` archive pages) — TIDAK ADA fallback
 * mock/fake data apa pun. Kalau data kosong, `items` kosong — caller yang memutuskan
 * tampilannya, bukan resolver yang mengarang data.
 *
 * `tenantClient` dipakai untuk cek toggle modul ekosistem tenant ini
 * (lib/ekosistem-modules.ts) — kalau `directoryType` section ini dimatikan admin, `items`
 * dikembalikan kosong (data tidak dihapus, cuma tidak ditawarkan di sini).
 */
export async function resolveDirectoryItems(
  tenantClient: TenantDb,
  tenantSlug: string,
  data: DirectorySectionData,
): Promise<DirectoryFeedResult> {
  const directoryType: DirectoryType = data.directoryType ?? "usaha";
  const count = Math.max(1, Math.min(8, data.count ?? 4));

  const meta = LABELS_MAP[directoryType](tenantSlug);
  const sectionTitle = data.title?.trim() || meta.defaultTitle;

  // Nama organisasi dinamis (settings.general.site_name -> tenants.name -> slug) — dipakai
  // untuk label "Direktori {Type} {orgName}". TIDAK PERNAH hardcode nama tenant tertentu.
  const { siteName: orgName } = await getTenantSeoBase(tenantSlug);

  // Modul directoryType dimatikan admin tenant ini — section kosong, DirectorySection
  // (caller) yang memutuskan untuk tidak merender apa pun, bukan resolver ini yang
  // mengarang data pengganti.
  const enabledModules = await getEnabledEkosistemModules(tenantClient);
  if (!enabledModules[directoryType]) {
    return { title: sectionTitle, items: [], archiveHref: meta.archiveHref, typeLabel: meta.typeLabel, orgName };
  }

  const [tenantRow] = await publicDb
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, tenantSlug))
    .limit(1);

  if (!tenantRow) {
    return { title: sectionTitle, items: [], archiveHref: meta.archiveHref, typeLabel: meta.typeLabel, orgName };
  }

  let items: DirectoryItem[] = [];

  if (directoryType === "usaha") {
    const rows = await publicDb
      .select({
        id:          memberBusinesses.id,
        name:        memberBusinesses.name,
        brand:       memberBusinesses.brand,
        description: memberBusinesses.description,
        category:    memberBusinesses.category,
        coverUrl:    memberBusinesses.coverUrl,
        detail:      addresses.detail,
        ownerName:   members.name,
        ownerAvatar: members.photoUrl,
      })
      .from(memberBusinesses)
      .innerJoin(members, eq(members.id, memberBusinesses.memberId))
      .innerJoin(tenantMemberships, and(
        eq(tenantMemberships.memberId, members.id),
        eq(tenantMemberships.tenantId, tenantRow.id),
        inArray(tenantMemberships.status, ["active", "alumni"]),
      ))
      .leftJoin(addresses, eq(addresses.id, memberBusinesses.addressId))
      .where(eq(memberBusinesses.isActive, true))
      .orderBy(desc(memberBusinesses.createdAt))
      .limit(count);

    items = rows.map((r) => ({
      id:          r.id,
      title:       r.brand || r.name,
      description: r.description ?? "",
      imageUrl:    r.coverUrl ?? undefined,
      location:    r.detail ?? undefined,
      category:    r.category ?? undefined,
      ownerName:   r.ownerName ?? undefined,
      ownerAvatar: r.ownerAvatar ?? undefined,
      href:        `/${tenantSlug}/usaha/${r.id}`,
    }));
  } else if (directoryType === "profesional") {
    const rows = await publicDb
      .select({
        id:              memberProfessionals.id,
        title:           memberProfessionals.title,
        professionType:  memberProfessionals.professionType,
        specialization:  memberProfessionals.specialization,
        description:     memberProfessionals.description,
        institution:     memberProfessionals.institution,
        coverUrl:        memberProfessionals.coverUrl,
        detail:          addresses.detail,
        ownerName:       members.name,
        ownerAvatar:     members.photoUrl,
      })
      .from(memberProfessionals)
      .innerJoin(members, eq(members.id, memberProfessionals.memberId))
      .innerJoin(tenantMemberships, and(
        eq(tenantMemberships.memberId, members.id),
        eq(tenantMemberships.tenantId, tenantRow.id),
        inArray(tenantMemberships.status, ["active", "alumni"]),
      ))
      .leftJoin(addresses, eq(addresses.id, memberProfessionals.addressId))
      .where(eq(memberProfessionals.isActive, true))
      .orderBy(desc(memberProfessionals.createdAt))
      .limit(count);

    items = rows.map((r) => {
      const nameDisplay = [r.title, r.ownerName].filter(Boolean).join(" ");
      return {
        id:          r.id,
        title:       nameDisplay || r.professionType,
        description: r.description || r.specialization || r.institution || "",
        imageUrl:    r.coverUrl ?? undefined,
        location:    r.detail ?? undefined,
        category:    r.professionType ?? undefined,
        ownerName:   r.ownerName ?? undefined,
        ownerAvatar: r.ownerAvatar ?? undefined,
        href:        `/${tenantSlug}/profesional/${r.id}`,
      };
    });
  } else if (directoryType === "pesantren") {
    // member_owned_pesantren TIDAK punya kolom isActive (konsisten dengan halaman
    // /pesantren asli — lihat app/(public)/[tenant]/pesantren/page.tsx).
    const rows = await publicDb
      .select({
        id:              memberOwnedPesantren.id,
        name:            memberOwnedPesantren.name,
        modelPendidikan: memberOwnedPesantren.modelPendidikan,
        namaPimpinan:    memberOwnedPesantren.namaPimpinan,
        coverUrl:        memberOwnedPesantren.coverUrl,
        detail:          addresses.detail,
        ownerName:       members.name,
        ownerAvatar:     members.photoUrl,
      })
      .from(memberOwnedPesantren)
      .innerJoin(members, eq(members.id, memberOwnedPesantren.memberId))
      .innerJoin(tenantMemberships, and(
        eq(tenantMemberships.memberId, members.id),
        eq(tenantMemberships.tenantId, tenantRow.id),
        inArray(tenantMemberships.status, ["active", "alumni"]),
      ))
      .leftJoin(addresses, eq(addresses.id, memberOwnedPesantren.addressId))
      .orderBy(desc(memberOwnedPesantren.createdAt))
      .limit(count);

    items = rows.map((r) => ({
      id:          r.id,
      title:       r.name,
      description: r.modelPendidikan ? `Model pendidikan ${r.modelPendidikan}.` : "",
      imageUrl:    r.coverUrl ?? undefined,
      location:    r.detail ?? undefined,
      category:    r.modelPendidikan ?? undefined,
      ownerName:   r.namaPimpinan || r.ownerName || undefined,
      ownerAvatar: r.ownerAvatar ?? undefined,
      href:        `/${tenantSlug}/pesantren/${r.id}`,
    }));
  }

  return { title: sectionTitle, items, archiveHref: meta.archiveHref, typeLabel: meta.typeLabel, orgName };
}
