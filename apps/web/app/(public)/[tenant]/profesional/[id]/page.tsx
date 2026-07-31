import { notFound }   from "next/navigation";
import { eq, and, inArray } from "drizzle-orm";
import {
  db, members, tenants, tenantMemberships,
  memberProfessionals, contacts, addresses, socialMedias,
  refProvinces, refRegencies,
} from "@jalajogja/db";
import Image    from "next/image";
import Link     from "next/link";
import type { Metadata } from "next";
import {
  Briefcase, MapPin, Phone, MessageCircle, Mail,
  Users, ChevronLeft, ShieldCheck,
} from "lucide-react";
import { displayPhone, toWaDigits } from "@/lib/phone";
import { renderBody }   from "@/lib/letter-render";
import { generateMetadata as buildMetadata } from "@/lib/seo";
import { getTenantSeoBase } from "@/lib/tenant-seo";
import { SocialLinks } from "@/components/ui/social-links";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { getVariantUrl } from "@/lib/image-processor";
import { EcosystemTagCrossLinks } from "@/components/ekosistem/tag-cross-links";

type Params = Promise<{ tenant: string; id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { tenant: slug, id } = await params;
  const [base, p] = await Promise.all([
    getTenantSeoBase(slug),
    db.select({
      title: memberProfessionals.title, professionType: memberProfessionals.professionType,
      coverUrl: memberProfessionals.coverUrl, description: memberProfessionals.description,
    })
      .from(memberProfessionals).where(eq(memberProfessionals.id, id)).limit(1)
      .then(r => r[0]),
  ]);
  if (!p) return {};
  return buildMetadata({
    title:       [p.title, p.professionType].filter(Boolean).join(" ") || "Profesional",
    description: p.description ?? undefined,
    siteName:    base.siteName,
    canonicalUrl: `${base.baseUrl}/profesional/${id}`,
    ogImageUrl:  p.coverUrl ?? base.logoUrl,
    ogType:      "profile",
  });
}

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3 py-2.5 border-b border-border/50 last:border-0 text-sm">
      <dt className="text-muted-foreground sm:w-40 shrink-0">{label}</dt>
      <dd className="font-medium">{String(value)}</dd>
    </div>
  );
}

export default async function ProfesionalDetailPage({ params }: { params: Params }) {
  const { tenant: slug, id } = await params;

  const [tenant] = await db
    .select({ id: tenants.id, name: tenants.name, isActive: tenants.isActive })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);
  if (!tenant?.isActive) notFound();

  const [row] = await db
    .select({
      id:                 memberProfessionals.id,
      title:              memberProfessionals.title,
      professionCategory: memberProfessionals.professionCategory,
      professionType:     memberProfessionals.professionType,
      specialization:     memberProfessionals.specialization,
      description:        memberProfessionals.description,
      coverUrl:           memberProfessionals.coverUrl,
      licenseType:        memberProfessionals.licenseType,
      licenseNumber:      memberProfessionals.licenseNumber,
      employmentType:     memberProfessionals.employmentType,
      institution:        memberProfessionals.institution,
      startYear:          memberProfessionals.startYear,
      addressId:          memberProfessionals.addressId,
      contactId:          memberProfessionals.contactId,
      socialMediaId:      memberProfessionals.socialMediaId,
      memberId:           memberProfessionals.memberId,
      offeredTags:        memberProfessionals.offeredTags,
      neededTags:         memberProfessionals.neededTags,
      ownerName:          members.name,
      ownerPhoto:         members.photoUrl,
    })
    .from(memberProfessionals)
    .innerJoin(members, eq(members.id, memberProfessionals.memberId))
    .innerJoin(tenantMemberships, and(
      eq(tenantMemberships.memberId, members.id),
      eq(tenantMemberships.tenantId, tenant.id),
      inArray(tenantMemberships.status, ["active", "alumni"]),
    ))
    .where(and(eq(memberProfessionals.id, id), eq(memberProfessionals.isActive, true)))
    .limit(1);

  if (!row) notFound();

  // Alamat (provinsi + kabupaten saja — detail alamat tidak pernah publik)
  let provinceName: string | null = null;
  let regencyName:  string | null = null;
  if (row.addressId) {
    const [addr] = await db
      .select({ provinceId: addresses.provinceId, regencyId: addresses.regencyId })
      .from(addresses)
      .where(eq(addresses.id, row.addressId))
      .limit(1);
    if (addr?.provinceId) {
      const [prov] = await db.select({ name: refProvinces.name }).from(refProvinces).where(eq(refProvinces.id, addr.provinceId)).limit(1);
      provinceName = prov?.name ?? null;
    }
    if (addr?.regencyId) {
      const [reg] = await db.select({ name: refRegencies.name }).from(refRegencies).where(eq(refRegencies.id, addr.regencyId)).limit(1);
      regencyName = reg?.name ?? null;
    }
  }

  // Kontak (hanya yang di-toggle publik)
  let phone:          string | null = null;
  let whatsapp:       string | null = null;
  let whatsappWaLink: string | null = null;
  let email:          string | null = null;
  if (row.contactId) {
    const [c] = await db
      .select({
        phone: contacts.phone, whatsapp: contacts.whatsapp, email: contacts.email,
        isPhonePublic: contacts.isPhonePublic, isWhatsappPublic: contacts.isWhatsappPublic, isEmailPublic: contacts.isEmailPublic,
      })
      .from(contacts)
      .where(eq(contacts.id, row.contactId))
      .limit(1);
    if (c) {
      if (c.isPhonePublic)    phone    = displayPhone(c.phone);
      if (c.isWhatsappPublic) {
        whatsapp       = displayPhone(c.whatsapp);
        whatsappWaLink = c.whatsapp ? `https://wa.me/${toWaDigits(c.whatsapp)}` : null;
      }
      if (c.isEmailPublic)    email    = c.email;
    }
  }

  // Social media
  type SocialMap = { instagram?: string; facebook?: string; linkedin?: string; twitter?: string; youtube?: string; tiktok?: string; website?: string };
  let socials: SocialMap = {};
  if (row.socialMediaId) {
    const [sm] = await db
      .select({ instagram: socialMedias.instagram, facebook: socialMedias.facebook, linkedin: socialMedias.linkedin, twitter: socialMedias.twitter, youtube: socialMedias.youtube, tiktok: socialMedias.tiktok, website: socialMedias.website })
      .from(socialMedias)
      .where(eq(socialMedias.id, row.socialMediaId))
      .limit(1);
    if (sm) {
      if (sm.instagram) socials.instagram = sm.instagram;
      if (sm.facebook)  socials.facebook  = sm.facebook;
      if (sm.linkedin)  socials.linkedin  = sm.linkedin;
      if (sm.twitter)   socials.twitter   = sm.twitter;
      if (sm.youtube)   socials.youtube   = sm.youtube;
      if (sm.tiktok)    socials.tiktok    = sm.tiktok;
      if (sm.website)   socials.website   = sm.website;
    }
  }

  const descHtml  = row.description ? renderBody(row.description) : null;
  const titleLine = [row.title, row.professionType].filter(Boolean).join(" ");

  const hasOfferedTags = (row.offeredTags ?? []).length > 0;
  const hasNeededTags  = (row.neededTags ?? []).length > 0;

  const locationText = [regencyName, provinceName].filter(Boolean).join(", ");
  const hasLocation = Boolean(locationText);

  const hasCredentials = Boolean(row.licenseType || row.licenseNumber);

  const hasInfoFields = Boolean(
    row.professionCategory || row.employmentType || row.institution ||
    row.startYear || row.specialization || hasLocation
  );

  const hasContactInfo = Boolean(phone || whatsapp || email);
  const hasSocials = Object.keys(socials).length > 0;

  return (
    <div className="py-8 md:py-12">
      <div className="max-w-7xl mx-auto px-4 space-y-6">
        
        {/* Breadcrumb Navigation */}
        <Link href={`/${slug}/profesional`} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft size={16} />
          Kembali ke Direktori Profesional
        </Link>

        {/* Banner Sampul & Floating Foto Orang (Avatar Pemilik) */}
        {(() => {
          const coverImg = getVariantUrl(row.coverUrl, "large");
          const personPhoto = row.ownerPhoto;
          if (!coverImg && !personPhoto) return null;
          return (
            <div className="relative aspect-video rounded-2xl overflow-hidden bg-muted/30 border border-border">
              {coverImg ? (
                <>
                  <ImageWithFallback src={coverImg} alt={titleLine} fill className="object-cover" unoptimized />
                  {personPhoto ? (
                    <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6 w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 border-background shadow-md overflow-hidden z-10 bg-background">
                      <Image src={personPhoto} alt={row.ownerName} fill className="object-cover" unoptimized />
                    </div>
                  ) : (
                    <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6 w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 border-background shadow-md overflow-hidden z-10 bg-primary/10 flex items-center justify-center text-primary font-bold text-lg sm:text-xl">
                      {row.ownerName.split(" ").slice(0,2).map(w=>w[0]).join("").toUpperCase()}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-center w-full h-full">
                  <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-background shadow-md overflow-hidden relative bg-primary/10 flex items-center justify-center text-primary font-bold text-2xl sm:text-3xl">
                    {personPhoto ? (
                      <Image src={personPhoto} alt={row.ownerName} fill className="object-cover" unoptimized />
                    ) : (
                      row.ownerName.split(" ").slice(0,2).map(w=>w[0]).join("").toUpperCase()
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Grid Tata Letak Utama (Kolom Kiri 2/3 : Kolom Kanan 1/3) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start pt-2">
          
          {/* ── KANAN / STICKY SIDEBAR ── */}
          <div className="lg:col-span-1 space-y-6 lg:sticky lg:top-24 order-2 lg:order-2">
            
            {/* Sidebar Card — BORDER SAJA, TANPA SHADOW */}
            {(hasInfoFields || hasContactInfo || hasSocials) && (
              <div className="rounded-2xl border border-border bg-card p-6 space-y-6">
                
                {/* Informasi Ringkas Profesional */}
                {hasInfoFields && (
                  <div>
                    <h2 className="text-sm font-semibold mb-3 flex items-center gap-2 text-foreground">
                      <Briefcase size={16} className="text-primary" /> Konteks Karir & Kerja
                    </h2>
                    <dl className="space-y-0 text-sm">
                      <InfoRow label="Institusi / Praktik" value={row.institution} />
                      <InfoRow label="Kategori Profesi"   value={row.professionCategory} />
                      <InfoRow label="Jenis Karir"        value={row.professionType} />
                      <InfoRow label="Tipe Pekerjaan"     value={row.employmentType} />
                      <InfoRow label="Spesialisasi"       value={row.specialization} />
                      <InfoRow label="Mulai Berkarir"     value={row.startYear} />
                      {hasLocation && <InfoRow label="Lokasi" value={locationText} />}
                    </dl>
                  </div>
                )}

                {/* Aksi Kontak Langsung */}
                {hasContactInfo && (
                  <div className={hasInfoFields ? "pt-5 border-t border-border space-y-3" : "space-y-3"}>
                    <h2 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                      <Phone size={16} className="text-primary" /> Hubungi Profesional
                    </h2>
                    <div className="space-y-2.5">
                      {whatsapp && whatsappWaLink && (
                        <a
                          href={whatsappWaLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition-all"
                        >
                          <MessageCircle size={16} /> Hubungi via WhatsApp
                        </a>
                      )}
                      {phone && (
                        <a
                          href={`tel:${phone}`}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-border hover:border-primary/50 text-foreground font-medium text-sm transition-all"
                        >
                          <Phone size={15} className="text-muted-foreground" /> {phone}
                        </a>
                      )}
                      {email && (
                        <a
                          href={`mailto:${email}`}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-border hover:border-primary/50 text-foreground font-medium text-sm transition-all"
                        >
                          <Mail size={15} className="text-muted-foreground" /> {email}
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Social Media Links */}
                {hasSocials && (
                  <div className={(hasInfoFields || hasContactInfo) ? "pt-5 border-t border-border space-y-3" : "space-y-3"}>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Media Sosial & Website</p>
                    <SocialLinks value={socials} />
                  </div>
                )}

              </div>
            )}

            {/* Profil Anggota IKPM */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                <Users size={15} className="text-primary" /> Anggota IKPM
              </h2>
              <div className="flex items-center gap-3">
                {row.ownerPhoto ? (
                  <Image src={row.ownerPhoto} alt={row.ownerName} width={44} height={44} className="rounded-full object-cover shrink-0 border border-border" unoptimized />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                    {row.ownerName.split(" ").slice(0,2).map(w=>w[0]).join("").toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="font-semibold text-sm leading-snug">{row.ownerName}</p>
                </div>
              </div>
            </div>

          </div>

          {/* ── KIRI / KONTEN UTAMA ── */}
          <div className="lg:col-span-2 space-y-6 order-1 lg:order-1">
            
            {/* Header Judul Profesional & Badges */}
            <div className="space-y-3">
              {(row.professionCategory || row.employmentType) && (
                <div className="flex flex-wrap gap-2">
                  {row.professionCategory && (
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{row.professionCategory}</span>
                  )}
                  {row.employmentType && (
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground">{row.employmentType}</span>
                  )}
                </div>
              )}

              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground leading-tight">
                {titleLine}
              </h1>

              {row.specialization && (
                <p className="text-muted-foreground text-base font-medium">{row.specialization}</p>
              )}

              {hasLocation && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground pt-0.5">
                  <MapPin size={15} className="text-primary shrink-0" />
                  <span>{locationText}</span>
                </div>
              )}
            </div>

            {/* Deskripsi / Profil Profesional */}
            {descHtml && (
              <div className="rounded-2xl border border-border bg-card p-6 space-y-3">
                <h2 className="text-base font-semibold text-foreground">Profil & Pengalaman</h2>
                <div
                  className="prose prose-sm max-w-none text-foreground [&_p]:my-2 [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-0.5"
                  dangerouslySetInnerHTML={{ __html: descHtml }}
                />
              </div>
            )}

            {/* Kredensial & Perizinan */}
            {hasCredentials && (
              <div className="rounded-2xl border border-border bg-card p-6 space-y-3">
                <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <ShieldCheck size={16} className="text-primary" /> Kredensial & Perizinan
                </h2>
                <dl className="space-y-0 text-sm">
                  <InfoRow label="Jenis Izin" value={row.licenseType} />
                  <InfoRow label="Nomor Izin" value={row.licenseNumber} />
                </dl>
              </div>
            )}

            {/* Ekosistem Sinergi (Vertical Listing) */}
            {(hasOfferedTags || hasNeededTags) && (
              <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
                <h2 className="text-base font-semibold text-foreground">Ekosistem Sinergi</h2>
                <div className="space-y-4">
                  {hasOfferedTags && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Menawarkan Keahlian / Layanan:</p>
                      <ul className="space-y-1.5 text-sm text-foreground pl-5 list-disc marker:text-primary font-medium">
                        {row.offeredTags.map(t => (
                          <li key={t}>{t}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {hasNeededTags && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Membutuhkan Pasokan / Kemitraan:</p>
                      <ul className="space-y-1.5 text-sm text-foreground pl-5 list-disc marker:text-muted-foreground font-medium">
                        {row.neededTags.map(t => (
                          <li key={t}>{t}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            <EcosystemTagCrossLinks
              slug={slug}
              currentModule="profesional"
              offeredTags={row.offeredTags}
              neededTags={row.neededTags}
            />

          </div>

        </div>
      </div>
    </div>
  );
}
