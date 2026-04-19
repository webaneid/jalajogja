import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq, and, asc } from "drizzle-orm";
import { ChevronLeft } from "lucide-react";
import {
  db,
  members,
  tenantMemberships,
  tenants,
  contacts,
  addresses,
  socialMedias,
  memberEducations,
  memberBusinesses,
  refProfessions,
  refRegencies,
} from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { MemberEditShell } from "@/components/members/member-edit-shell";
import type { EducationEntry } from "@/components/members/wizard/step3-education";
import type { BusinessEntry } from "@/components/members/wizard/step4-business";
import type { Step1DefaultValues } from "@/components/members/wizard/step1-identity";
import type { Step2DefaultValues } from "@/components/members/wizard/step2-contact";

export default async function EditMemberPage({
  params,
}: {
  params: Promise<{ tenant: string; id: string }>;
}) {
  const { tenant: slug, id: memberId } = await params;

  const access = await getTenantAccess(slug);
  if (!access) redirect("/dashboard-redirect");

  // Ambil semua data anggota secara paralel
  const [memberRow, professions, educations, businesses, tenantRow] = await Promise.all([
    // Data identitas + kontak/alamat/sosmed
    db
      .select({
        id: members.id,
        name: members.name,
        nik: members.nik,
        stambukNumber: members.stambukNumber,
        gender: members.gender,
        birthDate: members.birthDate,
        birthRegencyId: members.birthRegencyId,
        birthPlaceText: members.birthPlaceText,
        graduationYear: members.graduationYear,
        professionId: members.professionId,
        // Kontak
        contactId: members.contactId,
        phone: contacts.phone,
        whatsapp: contacts.whatsapp,
        contactEmail: contacts.email,
        // Alamat
        homeAddressId: members.homeAddressId,
        addrProvinceId: addresses.provinceId,
        addrRegencyId: addresses.regencyId,
        addrDistrictId: addresses.districtId,
        addrVillageId: addresses.villageId,
        addrDetail: addresses.detail,
        addrPostalCode: addresses.postalCode,
        // Sosial media
        socialMediaId: members.socialMediaId,
        instagram: socialMedias.instagram,
        facebook: socialMedias.facebook,
        linkedin: socialMedias.linkedin,
        twitter: socialMedias.twitter,
        youtube: socialMedias.youtube,
        tiktok: socialMedias.tiktok,
        website: socialMedias.website,
        // Keanggotaan
        status: tenantMemberships.status,
        joinedAt: tenantMemberships.joinedAt,
        domicileStatus: members.domicileStatus,
        // Provinsi kelahiran (dari regency → province)
        birthProvinceId: refRegencies.provinceId,
      })
      .from(members)
      .innerJoin(
        tenantMemberships,
        and(
          eq(tenantMemberships.memberId, members.id),
          eq(tenantMemberships.tenantId, access.tenant.id)
        )
      )
      .leftJoin(contacts, eq(contacts.id, members.contactId))
      .leftJoin(addresses, eq(addresses.id, members.homeAddressId))
      .leftJoin(socialMedias, eq(socialMedias.id, members.socialMediaId))
      .leftJoin(refRegencies, eq(refRegencies.id, members.birthRegencyId))
      .where(eq(members.id, memberId))
      .limit(1)
      .then((r) => r[0]),

    // Daftar profesi untuk combobox
    db
      .select()
      .from(refProfessions)
      .orderBy(asc(refProfessions.order), asc(refProfessions.name)),

    // Riwayat pendidikan
    db
      .select()
      .from(memberEducations)
      .where(eq(memberEducations.memberId, memberId)),

    // Data usaha
    db
      .select({
        id: memberBusinesses.id,
        name: memberBusinesses.name,
        brand: memberBusinesses.brand,
        description: memberBusinesses.description,
        category: memberBusinesses.category,
        sector: memberBusinesses.sector,
        legality: memberBusinesses.legality,
        position: memberBusinesses.position,
        employees: memberBusinesses.employees,
        branches: memberBusinesses.branches,
        revenue: memberBusinesses.revenue,
        // Kontak usaha
        bizPhone: contacts.phone,
        bizWhatsapp: contacts.whatsapp,
        bizEmail: contacts.email,
        // Alamat usaha
        bizCountry: addresses.country,
        bizProvinceId: addresses.provinceId,
        bizRegencyId: addresses.regencyId,
        bizDistrictId: addresses.districtId,
        bizVillageId: addresses.villageId,
        bizAddrDetail: addresses.detail,
        bizPostalCode: addresses.postalCode,
        // Sosial media usaha
        bizInstagram: socialMedias.instagram,
        bizFacebook: socialMedias.facebook,
        bizLinkedin: socialMedias.linkedin,
        bizTwitter: socialMedias.twitter,
        bizYoutube: socialMedias.youtube,
        bizTiktok: socialMedias.tiktok,
        bizWebsite: socialMedias.website,
      })
      .from(memberBusinesses)
      .leftJoin(contacts, eq(contacts.id, memberBusinesses.contactId))
      .leftJoin(addresses, eq(addresses.id, memberBusinesses.addressId))
      .leftJoin(socialMedias, eq(socialMedias.id, memberBusinesses.socialMediaId))
      .where(eq(memberBusinesses.memberId, memberId)),

    // Tenant info
    db
      .select({ name: tenants.name })
      .from(tenants)
      .where(eq(tenants.id, access.tenant.id))
      .limit(1)
      .then((r) => r[0]),
  ]);

  if (!memberRow) notFound();

  // ── Bangun defaultValues untuk masing-masing step ──────────────────────────

  const defaultStep1: Step1DefaultValues = {
    name: memberRow.name,
    nik: memberRow.nik ?? undefined,
    stambukNumber: memberRow.stambukNumber ?? undefined,
    gender: memberRow.gender as "male" | "female" | undefined,
    birthDate: memberRow.birthDate ?? undefined,
    birthRegencyId: memberRow.birthRegencyId ?? undefined,
    birthProvinceId: memberRow.birthProvinceId ?? undefined,
    birthType: memberRow.birthRegencyId ? "id" : (memberRow.birthPlaceText ? "ln" : "id"),
    birthPlaceText: memberRow.birthPlaceText ?? undefined,
    graduationYear: memberRow.graduationYear ?? undefined,
    professionId: memberRow.professionId ?? undefined,
    status: (memberRow.status as "active" | "inactive" | "alumni") ?? "active",
    joinedAt: memberRow.joinedAt ?? undefined,
  };

  const defaultStep2: Step2DefaultValues = {
    phone: memberRow.phone ?? undefined,
    whatsapp: memberRow.whatsapp ?? undefined,
    email: memberRow.contactEmail ?? undefined,
    domicileStatus: (memberRow.domicileStatus as "permanent" | "temporary") ?? undefined,
    addressProvinceId: memberRow.addrProvinceId ?? undefined,
    addressRegencyId: memberRow.addrRegencyId ?? undefined,
    addressDistrictId: memberRow.addrDistrictId ?? undefined,
    addressVillageId: memberRow.addrVillageId ?? undefined,
    addressDetail: memberRow.addrDetail ?? undefined,
    addressPostalCode: memberRow.addrPostalCode ?? undefined,
    instagram: memberRow.instagram ?? undefined,
    facebook: memberRow.facebook ?? undefined,
    linkedin: memberRow.linkedin ?? undefined,
    twitter: memberRow.twitter ?? undefined,
    youtube: memberRow.youtube ?? undefined,
    tiktok: memberRow.tiktok ?? undefined,
    website: memberRow.website ?? undefined,
  };

  const defaultEducations: EducationEntry[] = educations.map((e) => ({
    id: e.id,
    level: e.level,
    institutionName: e.institutionName,
    major: e.major ?? "",
    startYear: e.startYear?.toString() ?? "",
    endYear: e.endYear?.toString() ?? "",
    isGontor: e.isGontor,
    gontorCampus: e.gontorCampus ?? "",
  }));

  const defaultBusinesses: BusinessEntry[] = businesses.map((b) => ({
    id: b.id,
    name: b.name,
    brand: b.brand ?? "",
    description: b.description ?? "",
    category: b.category,
    sector: b.sector,
    legality: b.legality ?? "",
    position: b.position ?? "",
    employees: b.employees ?? "",
    branches: b.branches ?? "",
    revenue: b.revenue ?? "",
    addressCountry: b.bizCountry ?? "",
    provinceId: b.bizProvinceId ?? null,
    regencyId: b.bizRegencyId ?? null,
    districtId: b.bizDistrictId ?? null,
    villageId: b.bizVillageId ?? null,
    addressDetail: b.bizAddrDetail ?? "",
    postalCode: b.bizPostalCode ?? "",
    phone: b.bizPhone ?? "",
    whatsapp: b.bizWhatsapp ?? "",
    email: b.bizEmail ?? "",
    instagram: b.bizInstagram ?? "",
    facebook: b.bizFacebook ?? "",
    linkedin: b.bizLinkedin ?? "",
    twitter: b.bizTwitter ?? "",
    youtube: b.bizYoutube ?? "",
    tiktok: b.bizTiktok ?? "",
    website: b.bizWebsite ?? "",
  }));

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link
        href={`/${slug}/members/${memberId}`}
        className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Kembali ke Detail
      </Link>

      <h1 className="mb-1 text-2xl font-bold">Edit Anggota</h1>
      <p className="mb-6 text-sm text-muted-foreground">{memberRow.name}</p>

      <MemberEditShell
        memberId={memberId}
        slug={slug}
        tenantId={access.tenant.id}
        tenantName={tenantRow?.name ?? slug}
        professions={professions}
        defaultStep1={defaultStep1}
        defaultStep2={defaultStep2}
        defaultEducations={defaultEducations}
        defaultBusinesses={defaultBusinesses}
      />
    </div>
  );
}
