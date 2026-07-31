import { notFound }   from "next/navigation";
import { eq, and, inArray } from "drizzle-orm";
import {
  db, members, tenants, tenantMemberships, createTenantDb,
  memberBusinesses, contacts, addresses, socialMedias,
  refProvinces, refRegencies,
} from "@jalajogja/db";
import Image    from "next/image";
import Link     from "next/link";
import type { Metadata } from "next";
import {
  Briefcase, MapPin, Phone, MessageCircle, Mail,
  Users, ChevronLeft,
} from "lucide-react";
import { displayPhone, toWaDigits } from "@/lib/phone";
import { renderBody }   from "@/lib/letter-render";
import { generateMetadata as buildMetadata } from "@/lib/seo";
import { getTenantSeoBase } from "@/lib/tenant-seo";
import { resolveBaseUrl } from "@/lib/resolve-base-url";
import { getPublicNavMenu } from "@/lib/get-public-nav-menu";
import { SocialLinks } from "@/components/ui/social-links";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { getVariantUrl } from "@/lib/image-processor";
import { EcosystemTagCrossLinks } from "@/components/ekosistem/tag-cross-links";
import { getEnabledEkosistemModules } from "@/lib/ekosistem-modules.server";
import { SingleFeatureImage } from "@/components/website/public/single/single-feature-image";
import { CategoryPill } from "@/components/website/public/single/category-pill";
import { SocialShareCard } from "@/components/website/public/single/social-share-card";

type Params = Promise<{ tenant: string; id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { tenant: slug, id } = await params;
  const [base, b] = await Promise.all([
    getTenantSeoBase(slug),
    db.select({ name: memberBusinesses.name, coverUrl: memberBusinesses.coverUrl, description: memberBusinesses.description })
      .from(memberBusinesses).where(eq(memberBusinesses.id, id)).limit(1)
      .then(r => r[0]),
  ]);
  if (!b) return {};
  return buildMetadata({
    title:       b.name,
    description: b.description ?? undefined,
    siteName:    base.siteName,
    canonicalUrl: `${base.baseUrl}/usaha/${id}`,
    ogImageUrl:  b.coverUrl ?? base.logoUrl,
    ogType:      "article",
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

export default async function UsahaDetailPage({ params }: { params: Params }) {
  const { tenant: slug, id } = await params;

  const [tenant] = await db
    .select({ id: tenants.id, name: tenants.name, isActive: tenants.isActive })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);
  if (!tenant?.isActive) notFound();

  // Modul Usaha dimatikan admin tenant ini — entri lama tetap ada di DB (single-ID global)
  // tapi tidak lagi ditawarkan/ditampilkan di sini, konsisten dengan arsip.
  const enabledModules = await getEnabledEkosistemModules(createTenantDb(slug));
  if (!enabledModules.usaha) notFound();

  const [row] = await db
    .select({
      id:          memberBusinesses.id,
      name:        memberBusinesses.name,
      brand:       memberBusinesses.brand,
      description: memberBusinesses.description,
      coverUrl:    memberBusinesses.coverUrl,
      logoUrl:     memberBusinesses.logoUrl,
      category:    memberBusinesses.category,
      sector:      memberBusinesses.sector,
      businessFields: memberBusinesses.businessFields,
      legality:    memberBusinesses.legality,
      position:    memberBusinesses.position,
      employees:   memberBusinesses.employees,
      branches:    memberBusinesses.branches,
      offeredTags: memberBusinesses.offeredTags,
      neededTags:  memberBusinesses.neededTags,
      addressId:   memberBusinesses.addressId,
      contactId:   memberBusinesses.contactId,
      socialMediaId: memberBusinesses.socialMediaId,
      memberId:    memberBusinesses.memberId,
      ownerName:   members.name,
      ownerPhoto:  members.photoUrl,
    })
    .from(memberBusinesses)
    .innerJoin(members, eq(members.id, memberBusinesses.memberId))
    .innerJoin(tenantMemberships, and(
      eq(tenantMemberships.memberId, members.id),
      eq(tenantMemberships.tenantId, tenant.id),
      inArray(tenantMemberships.status, ["active", "alumni"]),
    ))
    .where(and(eq(memberBusinesses.id, id), eq(memberBusinesses.isActive, true)))
    .limit(1);

  if (!row) notFound();

  // Alamat
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

  // Kontak (hanya yang publik)
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

  const descHtml          = row.description ? renderBody(row.description) : null;
  const hasBusinessFields = (row.businessFields ?? []).length > 0;
  const hasOfferedTags    = (row.offeredTags ?? []).length > 0;
  const hasNeededTags     = (row.neededTags ?? []).length > 0;

  const locationText = [regencyName, provinceName].filter(Boolean).join(", ");
  const hasLocation = Boolean(locationText);

  const hasInfoFields = Boolean(
    row.category || row.sector || row.legality || row.position ||
    row.employees || row.branches || hasLocation
  );

  const hasContactInfo = Boolean(phone || whatsapp || email);
  const hasSocials = Object.keys(socials).length > 0;

  // Shell mobile — lihat docs/arsitektur-mobile-shell.md, pola disalin dari campaign/[slug].
  const tenantClient = createTenantDb(slug);
  const [relativeBaseUrl, seoBase] = await Promise.all([
    resolveBaseUrl(slug),
    getTenantSeoBase(slug),
  ]);
  const navMenu = await getPublicNavMenu(tenantClient, slug, relativeBaseUrl);
  const pageUrl = `${seoBase.baseUrl}/usaha/${id}`;

  // Cover + floating logo — dihitung sekali, dipakai ULANG identik di mobile (full-bleed,
  // di dalam SingleFeatureImage) dan desktop (kartu berbingkai) — posisi badge logo TIDAK
  // pernah berubah antara keduanya, cuma wrapper luarnya yang beda.
  const coverImg = getVariantUrl(row.coverUrl, "large");
  const logoImg  = row.logoUrl;
  const coverInner = coverImg ? (
    <>
      <ImageWithFallback src={coverImg} alt={row.name} fill className="object-cover" unoptimized />
      {logoImg && (
        <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6 w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-background/95 backdrop-blur-md border border-border p-2 shadow-sm flex items-center justify-center overflow-hidden z-10">
          <Image src={logoImg} alt={row.name} fill className="object-contain p-1" unoptimized />
        </div>
      )}
    </>
  ) : logoImg ? (
    <Image src={logoImg} alt={row.name} fill className="object-contain p-8 sm:p-12" unoptimized />
  ) : null;

  return (
    <>
      {/* ── Mobile shell — full-bleed cover + overlay back/menu, header situs disembunyikan ── */}
      <div className="md:hidden">
        <SingleFeatureImage backHref={`${relativeBaseUrl}/usaha`} navMenu={navMenu} siteName={tenant.name}>
          {(coverImg || logoImg) && (
            <div className="relative w-full aspect-video bg-muted/30 overflow-hidden">{coverInner}</div>
          )}
        </SingleFeatureImage>
        <div className="px-4 pt-4 space-y-3">
          {row.category && <CategoryPill label={row.category} />}
          <h1 className="text-2xl font-bold tracking-tight leading-tight">
            {row.name}
            {row.brand && row.brand !== row.name && (
              <span className="font-normal text-muted-foreground text-lg ml-2">({row.brand})</span>
            )}
          </h1>
          {hasLocation && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin size={15} className="text-primary shrink-0" />
              <span>{locationText}</span>
            </div>
          )}
          <SocialShareCard url={pageUrl} title={row.name} />
        </div>
      </div>

    <div className="py-8 md:py-12">
      <div className="max-w-7xl mx-auto px-4 space-y-6">

        {/* Breadcrumb Navigation — desktop saja, mobile sudah punya tombol back di overlay */}
        <Link href={`/${slug}/usaha`} className="hidden md:inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft size={16} />
          Kembali ke Direktori Usaha
        </Link>

        {/* Banner Sampul & Floating Logo — desktop saja, mobile sudah render sendiri di shell atas */}
        {(coverImg || logoImg) && (
          <div className="hidden md:block relative aspect-video rounded-2xl overflow-hidden bg-muted/30 border border-border">
            {coverInner}
          </div>
        )}

        {/* Grid Tata Letak Utama (Kolom Kiri 2/3 : Kolom Kanan 1/3) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start pt-2">
          
          {/* ── KANAN / STICKY SIDEBAR (Render Dulu untuk Responsif Desktop / Mobile) ── */}
          <div className="lg:col-span-1 space-y-6 lg:sticky lg:top-24 order-2 lg:order-2">
            
            {/* Sidebar Card — BORDER SAJA, TANPA SHADOW */}
            {(hasInfoFields || hasContactInfo || hasSocials) && (
              <div className="rounded-2xl border border-border bg-card p-6 space-y-6">
                
                {/* Informasi Ringkas Usaha */}
                {hasInfoFields && (
                  <div>
                    <h2 className="text-sm font-semibold mb-3 flex items-center gap-2 text-foreground">
                      <Briefcase size={16} className="text-primary" /> Informasi Usaha
                    </h2>
                    <dl className="space-y-0 text-sm">
                      <InfoRow label="Kategori"      value={row.category} />
                      <InfoRow label="Sektor"        value={row.sector} />
                      <InfoRow label="Legalitas"     value={row.legality} />
                      <InfoRow label="Peran Pemilik" value={row.position} />
                      <InfoRow label="Karyawan"      value={row.employees} />
                      <InfoRow label="Cabang"        value={row.branches} />
                      {hasLocation && <InfoRow label="Lokasi" value={locationText} />}
                    </dl>
                  </div>
                )}

                {/* Aksi Kontak Langsung */}
                {hasContactInfo && (
                  <div className={hasInfoFields ? "pt-5 border-t border-border space-y-3" : "space-y-3"}>
                    <h2 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                      <Phone size={16} className="text-primary" /> Hubungi Usaha
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

            {/* Pemilik / Pengelola IKPM */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                <Users size={15} className="text-primary" /> Pemilik / Pengelola
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
                  {row.position && <p className="text-xs text-muted-foreground mt-0.5">{row.position}</p>}
                </div>
              </div>
            </div>

          </div>

          {/* ── KIRI / KONTEN UTAMA ── */}
          <div className="lg:col-span-2 space-y-6 order-1 lg:order-1">
            
            {/* Header Nama Usaha & Badges — desktop saja, mobile sudah render sendiri di shell atas */}
            <div className="hidden md:block space-y-3">
              {(row.category || row.sector || row.legality) && (
                <div className="flex flex-wrap gap-2">
                  {row.category && (
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{row.category}</span>
                  )}
                  {row.sector && (
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground">{row.sector}</span>
                  )}
                  {row.legality && (
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground">{row.legality}</span>
                  )}
                </div>
              )}

              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground leading-tight">
                {row.name}
                {row.brand && row.brand !== row.name && (
                  <span className="font-normal text-muted-foreground text-xl ml-2 sm:ml-3">({row.brand})</span>
                )}
              </h1>

              {hasLocation && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground pt-0.5">
                  <MapPin size={15} className="text-primary shrink-0" />
                  <span>{locationText}</span>
                </div>
              )}
            </div>

            {/* Deskripsi Usaha */}
            {descHtml && (
              <div className="rounded-2xl border border-border bg-card p-6 space-y-3">
                <h2 className="text-base font-semibold text-foreground">Profil & Deskripsi Usaha</h2>
                <div
                  className="prose prose-sm max-w-none text-foreground [&_p]:my-2 [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-0.5"
                  dangerouslySetInnerHTML={{ __html: descHtml }}
                />
              </div>
            )}

            {/* Bidang Usaha */}
            {hasBusinessFields && (
              <div className="rounded-2xl border border-border bg-card p-6 space-y-3">
                <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Briefcase size={16} className="text-primary" /> Bidang Usaha
                </h2>
                <ul className="space-y-1.5 text-sm text-foreground pl-5 list-disc marker:text-primary font-medium">
                  {row.businessFields!.map(bf => (
                    <li key={bf}>{bf}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Ekosistem Sinergi (Vertical Listing) */}
            {(hasOfferedTags || hasNeededTags) && (
              <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
                <h2 className="text-base font-semibold text-foreground">Ekosistem Sinergi</h2>
                <div className="space-y-4">
                  {hasOfferedTags && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Menawarkan Produk / Jasa:</p>
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
              currentModule="usaha"
              offeredTags={row.offeredTags}
              neededTags={row.neededTags}
              enabledModules={enabledModules}
            />

          </div>

        </div>
      </div>
    </div>
    </>
  );
}
