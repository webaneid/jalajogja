import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { ChevronLeft, Pencil } from "lucide-react";
import {
  db,
  members,
  tenantMemberships,
  contacts,
  addresses,
  socialMedias,
  memberEducations,
  memberBusinesses,
  refProfessions,
  refRegencies,
  refProvinces,
  refDistricts,
} from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { DeleteMemberButton } from "./delete-button";

// ─── Alias untuk join tabel yang sama lebih dari sekali ──────────────────────
// (kelahiran vs alamat rumah; alamat rumah vs alamat usaha)
const addrRegencies  = alias(refRegencies, "addr_regency");
const addrProvinces  = alias(refProvinces, "addr_province");
const addrDistricts  = alias(refDistricts, "addr_district");
const bizContacts    = alias(contacts,     "biz_contact");
const bizAddresses   = alias(addresses,    "biz_address");
const bizSocialMedias = alias(socialMedias, "biz_social");
const bizRegencies   = alias(refRegencies, "biz_regency");
const bizProvinces   = alias(refProvinces, "biz_province");
const bizDistricts   = alias(refDistricts, "biz_district");

// ─── Label maps ──────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  active: "Aktif",
  inactive: "Tidak Aktif",
  alumni: "Alumni",
};
const STATUS_COLOR: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  inactive: "bg-zinc-100 text-zinc-600",
  alumni: "bg-blue-100 text-blue-700",
};
const GENDER_LABEL: Record<string, string> = {
  male: "Laki-laki",
  female: "Perempuan",
};
const DOMICILE_LABEL: Record<string, string> = {
  permanent: "Permanen",
  temporary: "Sementara / Perantau",
};

// ─── Sub-komponen ─────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-3 border-b last:border-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="col-span-2 text-sm font-medium">{value || "—"}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-5 mb-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ tenant: string; id: string }>;
}) {
  const { tenant: slug, id: memberId } = await params;

  const access = await getTenantAccess(slug);
  if (!access) redirect("/dashboard-redirect");

  // Ambil semua data anggota secara paralel
  const [row, educations, businesses] = await Promise.all([
    // Identitas + kontak + alamat + sosmed + profesi + kelahiran
    db
      .select({
        id: members.id,
        memberNumber: members.memberNumber,
        stambukNumber: members.stambukNumber,
        nik: members.nik,
        name: members.name,
        gender: members.gender,
        birthDate: members.birthDate,
        birthPlaceText: members.birthPlaceText,
        birthRegencyName: refRegencies.name,
        birthProvinceName: refProvinces.name,
        graduationYear: members.graduationYear,
        professionName: refProfessions.name,
        domicileStatus: members.domicileStatus,
        // Kontak
        phone: contacts.phone,
        whatsapp: contacts.whatsapp,
        contactEmail: contacts.email,
        // Alamat rumah
        addrProvinceName: addrProvinces.name,
        addrRegencyName:  addrRegencies.name,
        addrDistrictName: addrDistricts.name,
        addrDetail:       addresses.detail,
        addrPostalCode:   addresses.postalCode,
        // Sosial media
        instagram: socialMedias.instagram,
        facebook:  socialMedias.facebook,
        linkedin:  socialMedias.linkedin,
        twitter:   socialMedias.twitter,
        youtube:   socialMedias.youtube,
        tiktok:    socialMedias.tiktok,
        website:   socialMedias.website,
        // Keanggotaan
        status:        tenantMemberships.status,
        joinedAt:      tenantMemberships.joinedAt,
        registeredVia: tenantMemberships.registeredVia,
      })
      .from(members)
      .innerJoin(
        tenantMemberships,
        and(
          eq(tenantMemberships.memberId, members.id),
          eq(tenantMemberships.tenantId, access.tenant.id)
        )
      )
      .leftJoin(contacts,       eq(contacts.id,       members.contactId))
      .leftJoin(addresses,      eq(addresses.id,      members.homeAddressId))
      .leftJoin(socialMedias,   eq(socialMedias.id,   members.socialMediaId))
      .leftJoin(refProfessions, eq(refProfessions.id, members.professionId))
      .leftJoin(refRegencies,   eq(refRegencies.id,   members.birthRegencyId))
      .leftJoin(refProvinces,   eq(refProvinces.id,   refRegencies.provinceId))
      .leftJoin(addrDistricts,  eq(addrDistricts.id,  addresses.districtId))
      .leftJoin(addrRegencies,  eq(addrRegencies.id,  addresses.regencyId))
      .leftJoin(addrProvinces,  eq(addrProvinces.id,  addresses.provinceId))
      .where(eq(members.id, memberId))
      .limit(1)
      .then((r) => r[0]),

    // Riwayat pendidikan
    db
      .select()
      .from(memberEducations)
      .where(eq(memberEducations.memberId, memberId)),

    // Data usaha — semua field + alamat + kontak + sosmed per usaha
    db
      .select({
        id:          memberBusinesses.id,
        name:        memberBusinesses.name,
        brand:       memberBusinesses.brand,
        description: memberBusinesses.description,
        category:    memberBusinesses.category,
        sector:      memberBusinesses.sector,
        legality:    memberBusinesses.legality,
        position:    memberBusinesses.position,
        employees:   memberBusinesses.employees,
        branches:    memberBusinesses.branches,
        revenue:     memberBusinesses.revenue,
        // Kontak usaha
        bizPhone:    bizContacts.phone,
        bizWhatsapp: bizContacts.whatsapp,
        bizEmail:    bizContacts.email,
        // Alamat usaha
        bizAddrDetail:    bizAddresses.detail,
        bizAddrPostal:    bizAddresses.postalCode,
        bizDistrictName:  bizDistricts.name,
        bizRegencyName:   bizRegencies.name,
        bizProvinceName:  bizProvinces.name,
        // Sosial media usaha
        bizInstagram: bizSocialMedias.instagram,
        bizFacebook:  bizSocialMedias.facebook,
        bizLinkedin:  bizSocialMedias.linkedin,
        bizTwitter:   bizSocialMedias.twitter,
        bizYoutube:   bizSocialMedias.youtube,
        bizTiktok:    bizSocialMedias.tiktok,
        bizWebsite:   bizSocialMedias.website,
      })
      .from(memberBusinesses)
      .leftJoin(bizContacts,    eq(bizContacts.id,    memberBusinesses.contactId))
      .leftJoin(bizAddresses,   eq(bizAddresses.id,   memberBusinesses.addressId))
      .leftJoin(bizSocialMedias,eq(bizSocialMedias.id,memberBusinesses.socialMediaId))
      .leftJoin(bizDistricts,   eq(bizDistricts.id,   bizAddresses.districtId))
      .leftJoin(bizRegencies,   eq(bizRegencies.id,   bizAddresses.regencyId))
      .leftJoin(bizProvinces,   eq(bizProvinces.id,   bizAddresses.provinceId))
      .where(eq(memberBusinesses.memberId, memberId)),
  ]);

  if (!row) notFound();

  // Format tempat lahir
  const birthPlace = row.birthRegencyName
    ? `${row.birthRegencyName}${row.birthProvinceName ? `, ${row.birthProvinceName}` : ""}`
    : (row.birthPlaceText ?? null);

  // Format tanggal lahir
  const birthDateFormatted = row.birthDate
    ? new Date(row.birthDate).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  // Sosial media anggota yang terisi
  const socialLinks = [
    { label: "Instagram", value: row.instagram },
    { label: "Facebook",  value: row.facebook },
    { label: "LinkedIn",  value: row.linkedin },
    { label: "Twitter/X", value: row.twitter },
    { label: "YouTube",   value: row.youtube },
    { label: "TikTok",    value: row.tiktok },
    { label: "Website",   value: row.website },
  ].filter((s) => s.value);

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Breadcrumb */}
      <Link
        href={`/${slug}/members`}
        className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Daftar Anggota
      </Link>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{row.name}</h1>
          <div className="mt-2 flex items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLOR[row.status ?? "active"]}`}
            >
              {STATUS_LABEL[row.status ?? "active"]}
            </span>
            {row.memberNumber && (
              <span className="font-mono text-xs text-muted-foreground">
                {row.memberNumber}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link
            href={`/${slug}/members/${memberId}/edit`}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-accent transition-colors"
          >
            <Pencil className="h-4 w-4" /> Edit
          </Link>
          <DeleteMemberButton slug={slug} memberId={memberId} memberName={row.name} />
        </div>
      </div>

      {/* ── Identitas Pribadi ── */}
      <Section title="Identitas Pribadi">
        <dl>
          <Row label="Nomor Stambuk" value={row.stambukNumber} />
          <Row label="NIK"           value={row.nik} />
          <Row label="Jenis Kelamin" value={row.gender ? GENDER_LABEL[row.gender] : null} />
          <Row label="Tempat Lahir"  value={birthPlace} />
          <Row label="Tanggal Lahir" value={birthDateFormatted} />
          <Row label="Tahun Lulus Gontor" value={row.graduationYear?.toString()} />
          <Row label="Profesi"       value={row.professionName} />
        </dl>
      </Section>

      {/* ── Keanggotaan ── */}
      <Section title="Keanggotaan">
        <dl>
          <Row label="Status"        value={STATUS_LABEL[row.status ?? "active"]} />
          <Row label="Bergabung"     value={row.joinedAt ?? undefined} />
          <Row label="Didaftarkan via" value={row.registeredVia ?? undefined} />
        </dl>
      </Section>

      {/* ── Kontak ── */}
      {(row.phone || row.whatsapp || row.contactEmail || row.domicileStatus) && (
        <Section title="Kontak">
          <dl>
            <Row label="Telepon"  value={row.phone} />
            <Row label="WhatsApp" value={row.whatsapp} />
            <Row label="Email"    value={row.contactEmail} />
            {row.domicileStatus && (
              <Row label="Status Domisili" value={DOMICILE_LABEL[row.domicileStatus]} />
            )}
          </dl>
        </Section>
      )}

      {/* ── Alamat Rumah ── */}
      {(row.addrProvinceName || row.addrRegencyName || row.addrDetail || row.addrPostalCode) && (
        <Section title="Alamat Rumah">
          <dl>
            <Row label="Detail Alamat"  value={row.addrDetail} />
            {row.addrDistrictName && <Row label="Kecamatan"      value={row.addrDistrictName} />}
            {row.addrRegencyName  && <Row label="Kabupaten / Kota" value={row.addrRegencyName} />}
            {row.addrProvinceName && <Row label="Provinsi"        value={row.addrProvinceName} />}
            <Row label="Kode Pos"       value={row.addrPostalCode} />
          </dl>
        </Section>
      )}

      {/* ── Sosial Media ── */}
      {socialLinks.length > 0 && (
        <Section title="Sosial Media">
          <dl>
            {socialLinks.map((s) => (
              <Row key={s.label} label={s.label} value={s.value} />
            ))}
          </dl>
        </Section>
      )}

      {/* ── Riwayat Pendidikan ── */}
      {educations.length > 0 && (
        <Section title="Riwayat Pendidikan">
          <div className="space-y-4">
            {educations.map((edu, i) => (
              <div key={edu.id} className={i > 0 ? "border-t pt-4" : ""}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{edu.institutionName}</p>
                    <p className="text-xs text-muted-foreground">
                      {edu.level}{edu.major ? ` — ${edu.major}` : ""}
                    </p>
                    {(edu.startYear || edu.endYear) && (
                      <p className="text-xs text-muted-foreground">
                        {edu.startYear ?? "?"} – {edu.endYear ?? "sekarang"}
                      </p>
                    )}
                  </div>
                  {edu.isGontor && (
                    <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                      {edu.gontorCampus ?? "Gontor"}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Data Usaha ── */}
      {businesses.length > 0 && (
        <Section title="Data Usaha">
          <div className="space-y-6">
            {businesses.map((biz, i) => {
              const bizSocials = [
                { label: "Instagram", value: biz.bizInstagram },
                { label: "Facebook",  value: biz.bizFacebook },
                { label: "LinkedIn",  value: biz.bizLinkedin },
                { label: "Twitter/X", value: biz.bizTwitter },
                { label: "YouTube",   value: biz.bizYoutube },
                { label: "TikTok",    value: biz.bizTiktok },
                { label: "Website",   value: biz.bizWebsite },
              ].filter((s) => s.value);

              const hasAddress = biz.bizAddrDetail || biz.bizDistrictName || biz.bizRegencyName || biz.bizProvinceName || biz.bizAddrPostal;
              const hasContact = biz.bizPhone || biz.bizWhatsapp || biz.bizEmail;
              const hasScale   = biz.employees || biz.branches || biz.revenue;

              return (
                <div key={biz.id} className={i > 0 ? "border-t pt-6" : ""}>
                  {/* Nama + posisi */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <p className="text-sm font-semibold">
                        {biz.name}
                        {biz.brand ? <span className="font-normal text-muted-foreground"> ({biz.brand})</span> : null}
                      </p>
                      {biz.description && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{biz.description}</p>
                      )}
                    </div>
                    {biz.position && (
                      <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                        {biz.position}
                      </span>
                    )}
                  </div>

                  <dl>
                    {/* Klasifikasi */}
                    <Row label="Kategori"  value={biz.category} />
                    <Row label="Sektor"    value={biz.sector} />
                    {biz.legality  && <Row label="Legalitas" value={biz.legality} />}

                    {/* Skala */}
                    {hasScale && (
                      <>
                        {biz.employees && <Row label="Jumlah Karyawan" value={biz.employees} />}
                        {biz.branches  && <Row label="Jumlah Cabang"   value={biz.branches} />}
                        {biz.revenue   && <Row label="Omzet / Tahun"   value={biz.revenue} />}
                      </>
                    )}

                    {/* Alamat */}
                    {hasAddress && (
                      <>
                        {biz.bizAddrDetail  && <Row label="Detail Alamat"    value={biz.bizAddrDetail} />}
                        {biz.bizDistrictName && <Row label="Kecamatan"        value={biz.bizDistrictName} />}
                        {biz.bizRegencyName  && <Row label="Kabupaten / Kota" value={biz.bizRegencyName} />}
                        {biz.bizProvinceName && <Row label="Provinsi"          value={biz.bizProvinceName} />}
                        {biz.bizAddrPostal   && <Row label="Kode Pos"          value={biz.bizAddrPostal} />}
                      </>
                    )}

                    {/* Kontak */}
                    {hasContact && (
                      <>
                        {biz.bizPhone    && <Row label="Telepon"  value={biz.bizPhone} />}
                        {biz.bizWhatsapp && <Row label="WhatsApp" value={biz.bizWhatsapp} />}
                        {biz.bizEmail    && <Row label="Email"    value={biz.bizEmail} />}
                      </>
                    )}

                    {/* Sosial media */}
                    {bizSocials.map((s) => (
                      <Row key={s.label} label={s.label} value={s.value} />
                    ))}
                  </dl>
                </div>
              );
            })}
          </div>
        </Section>
      )}
    </div>
  );
}
