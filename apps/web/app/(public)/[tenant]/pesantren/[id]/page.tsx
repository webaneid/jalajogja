import { notFound }   from "next/navigation";
import { eq, and, inArray } from "drizzle-orm";
import {
  db, members, tenants, tenantMemberships, createTenantDb,
  memberOwnedPesantren, contacts, addresses, socialMedias,
  refProvinces, refRegencies,
} from "@jalajogja/db";
import Image    from "next/image";
import Link     from "next/link";
import type { Metadata } from "next";
import {
  School, MapPin, Phone, MessageCircle, Mail,
  Users, BookOpen, ChevronLeft,
} from "lucide-react";
import { displayPhone, toWaDigits } from "@/lib/phone";
import { generateMetadata as buildMetadata } from "@/lib/seo";
import { getTenantSeoBase } from "@/lib/tenant-seo";
import { resolveBaseUrl } from "@/lib/resolve-base-url";
import { getPublicNavMenu } from "@/lib/get-public-nav-menu";
import { SocialLinks } from "@/components/ui/social-links";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { getVariantUrl } from "@/lib/image-processor";
import { EcosystemTagCrossLinks } from "@/components/ekosistem/tag-cross-links";
import { SingleFeatureImage } from "@/components/website/public/single/single-feature-image";
import { CategoryPill } from "@/components/website/public/single/category-pill";
import { SocialShareCard } from "@/components/website/public/single/social-share-card";

type Params = Promise<{ tenant: string; id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { tenant: slug, id } = await params;
  const [base, p] = await Promise.all([
    getTenantSeoBase(slug),
    db.select({ name: memberOwnedPesantren.name, coverUrl: memberOwnedPesantren.coverUrl })
      .from(memberOwnedPesantren).where(eq(memberOwnedPesantren.id, id)).limit(1)
      .then(r => r[0]),
  ]);
  if (!p) return {};
  return buildMetadata({
    title:       p.name,
    siteName:    base.siteName,
    canonicalUrl: `${base.baseUrl}/pesantren/${id}`,
    ogImageUrl:  p.coverUrl ?? base.logoUrl,
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

export default async function PesantrenDetailPage({ params }: { params: Params }) {
  const { tenant: slug, id } = await params;

  // Resolve tenant
  const [tenant] = await db
    .select({ id: tenants.id, name: tenants.name, isActive: tenants.isActive })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);
  if (!tenant?.isActive) notFound();

  // Verifikasi scope: pemilik pesantren harus anggota tenant ini
  const [row] = await db
    .select({
      id:              memberOwnedPesantren.id,
      name:            memberOwnedPesantren.name,
      coverUrl:        memberOwnedPesantren.coverUrl,
      tahunBerdiri:    memberOwnedPesantren.tahunBerdiri,
      luasArea:        memberOwnedPesantren.luasArea,
      namaPimpinan:    memberOwnedPesantren.namaPimpinan,
      kurikulum:       memberOwnedPesantren.kurikulum,
      jenisPondok:     memberOwnedPesantren.jenisPondok,
      modelPendidikan: memberOwnedPesantren.modelPendidikan,
      kategoriSantri:  memberOwnedPesantren.kategoriSantri,
      santriPutra:     memberOwnedPesantren.santriPutra,
      santriPutri:     memberOwnedPesantren.santriPutri,
      asatidz:         memberOwnedPesantren.asatidz,
      asatidzah:       memberOwnedPesantren.asatidzah,
      addressId:       memberOwnedPesantren.addressId,
      contactId:       memberOwnedPesantren.contactId,
      socialMediaId:   memberOwnedPesantren.socialMediaId,
      memberId:        memberOwnedPesantren.memberId,
      offeredTags:     memberOwnedPesantren.offeredTags,
      neededTags:      memberOwnedPesantren.neededTags,
      ownerName:       members.name,
      ownerPhoto:      members.photoUrl,
    })
    .from(memberOwnedPesantren)
    .innerJoin(members, eq(members.id, memberOwnedPesantren.memberId))
    .innerJoin(tenantMemberships, and(
      eq(tenantMemberships.memberId, members.id),
      eq(tenantMemberships.tenantId, tenant.id),
      inArray(tenantMemberships.status, ["active", "alumni"]),
    ))
    .where(eq(memberOwnedPesantren.id, id))
    .limit(1);

  if (!row) notFound();

  // Alamat (provinsi + kabupaten saja)
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

  const totalSantri  = (row.santriPutra  ?? 0) + (row.santriPutri  ?? 0);
  const totalAsatidz = (row.asatidz      ?? 0) + (row.asatidzah    ?? 0);

  const hasOfferedTags = (row.offeredTags ?? []).length > 0;
  const hasNeededTags  = (row.neededTags ?? []).length > 0;

  const locationText = [regencyName, provinceName].filter(Boolean).join(", ");
  const hasLocation = Boolean(locationText);

  const hasInfoFields = Boolean(
    row.tahunBerdiri || row.luasArea || row.namaPimpinan ||
    row.kurikulum || row.jenisPondok || row.modelPendidikan ||
    row.kategoriSantri || hasLocation
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
  const pageUrl = `${seoBase.baseUrl}/pesantren/${id}`;
  const coverImg = getVariantUrl(row.coverUrl, "large");

  return (
    <>
      {/* ── Mobile shell — full-bleed cover + overlay back/menu, header situs disembunyikan ── */}
      <div className="md:hidden">
        <SingleFeatureImage
          src={coverImg}
          alt={row.name}
          backHref={`${relativeBaseUrl}/pesantren`}
          navMenu={navMenu}
          siteName={tenant.name}
        />
        <div className="px-4 pt-4 space-y-3">
          {row.kurikulum && <CategoryPill label={row.kurikulum} />}
          <h1 className="text-2xl font-bold tracking-tight leading-tight">{row.name}</h1>
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
        <Link href={`/${slug}/pesantren`} className="hidden md:inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft size={16} />
          Kembali ke Direktori Pesantren
        </Link>

        {/* Banner Sampul (Pesantren: Tanpa Floating Logo) — desktop saja */}
        {row.coverUrl && (
          <div className="hidden md:block relative aspect-video rounded-2xl overflow-hidden bg-muted/30 border border-border">
            <ImageWithFallback
              src={coverImg}
              alt={row.name}
              fill
              className="object-cover"
              unoptimized
            />
          </div>
        )}

        {/* Grid Tata Letak Utama (Kolom Kiri 2/3 : Kolom Kanan 1/3) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start pt-2">
          
          {/* ── KANAN / STICKY SIDEBAR ── */}
          <div className="lg:col-span-1 space-y-6 lg:sticky lg:top-24 order-2 lg:order-2">
            
            {/* Sidebar Card — BORDER SAJA, TANPA SHADOW */}
            {(hasInfoFields || hasContactInfo || hasSocials) && (
              <div className="rounded-2xl border border-border bg-card p-6 space-y-6">
                
                {/* Informasi Ringkas Pesantren */}
                {hasInfoFields && (
                  <div>
                    <h2 className="text-sm font-semibold mb-3 flex items-center gap-2 text-foreground">
                      <BookOpen size={16} className="text-primary" /> Informasi Pesantren
                    </h2>
                    <dl className="space-y-0 text-sm">
                      <InfoRow label="Tahun Berdiri"    value={row.tahunBerdiri} />
                      <InfoRow label="Luas Area"        value={row.luasArea} />
                      <InfoRow label="Nama Pimpinan"    value={row.namaPimpinan} />
                      <InfoRow label="Kurikulum"        value={row.kurikulum} />
                      <InfoRow label="Jenis Pondok"     value={row.jenisPondok} />
                      <InfoRow label="Model Pendidikan" value={row.modelPendidikan} />
                      <InfoRow label="Kategori Santri"  value={row.kategoriSantri} />
                      {hasLocation && <InfoRow label="Lokasi" value={locationText} />}
                    </dl>
                  </div>
                )}

                {/* Aksi Kontak Langsung */}
                {hasContactInfo && (
                  <div className={hasInfoFields ? "pt-5 border-t border-border space-y-3" : "space-y-3"}>
                    <h2 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                      <Phone size={16} className="text-primary" /> Hubungi Pesantren
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
                </div>
              </div>
            </div>

          </div>

          {/* ── KIRI / KONTEN UTAMA ── */}
          <div className="lg:col-span-2 space-y-6 order-1 lg:order-1">
            
            {/* Header Nama Pesantren & Badges — desktop saja, mobile sudah render sendiri di shell atas */}
            <div className="hidden md:block space-y-3">
              {(row.kurikulum || row.kategoriSantri || row.jenisPondok || row.modelPendidikan) && (
                <div className="flex flex-wrap gap-2">
                  {row.kurikulum && (
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{row.kurikulum}</span>
                  )}
                  {row.kategoriSantri && (
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground">{row.kategoriSantri}</span>
                  )}
                  {row.jenisPondok && (
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground">{row.jenisPondok}</span>
                  )}
                  {row.modelPendidikan && (
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground">{row.modelPendidikan}</span>
                  )}
                </div>
              )}

              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground leading-tight">
                {row.name}
              </h1>

              {hasLocation && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground pt-0.5">
                  <MapPin size={15} className="text-primary shrink-0" />
                  <span>{locationText}</span>
                </div>
              )}
            </div>

            {/* Statistik Ringkas Santri & Asatidz */}
            {(totalSantri > 0 || totalAsatidz > 0) && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {row.santriPutra !== null && row.santriPutra !== undefined && (
                  <div className="rounded-2xl border border-border bg-card p-4 text-center">
                    <p className="text-2xl font-bold text-foreground">{row.santriPutra.toLocaleString("id-ID")}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Santri Putra</p>
                  </div>
                )}
                {row.santriPutri !== null && row.santriPutri !== undefined && (
                  <div className="rounded-2xl border border-border bg-card p-4 text-center">
                    <p className="text-2xl font-bold text-foreground">{row.santriPutri.toLocaleString("id-ID")}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Santri Putri</p>
                  </div>
                )}
                {row.asatidz !== null && row.asatidz !== undefined && (
                  <div className="rounded-2xl border border-border bg-card p-4 text-center">
                    <p className="text-2xl font-bold text-foreground">{row.asatidz.toLocaleString("id-ID")}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Asatidz (Putra)</p>
                  </div>
                )}
                {row.asatidzah !== null && row.asatidzah !== undefined && (
                  <div className="rounded-2xl border border-border bg-card p-4 text-center">
                    <p className="text-2xl font-bold text-foreground">{row.asatidzah.toLocaleString("id-ID")}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Asatidzah (Putri)</p>
                  </div>
                )}
              </div>
            )}

            {/* Ekosistem Sinergi (Vertical Listing) */}
            {(hasOfferedTags || hasNeededTags) && (
              <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
                <h2 className="text-base font-semibold text-foreground">Ekosistem Sinergi</h2>
                <div className="space-y-4">
                  {hasOfferedTags && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Menawarkan Program / Layanan:</p>
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
              currentModule="pesantren"
              offeredTags={row.offeredTags}
              neededTags={row.neededTags}
            />

          </div>

        </div>
      </div>
    </div>
    </>
  );
}
