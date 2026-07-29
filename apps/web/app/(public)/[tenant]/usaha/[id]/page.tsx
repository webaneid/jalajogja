import { notFound }   from "next/navigation";
import { eq, and, inArray } from "drizzle-orm";
import {
  db, members, tenants, tenantMemberships,
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
import { SocialLinks } from "@/components/ui/social-links";
import { EcosystemTagCrossLinks } from "@/components/ekosistem/tag-cross-links";

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

  const [row] = await db
    .select({
      id:          memberBusinesses.id,
      name:        memberBusinesses.name,
      brand:       memberBusinesses.brand,
      description: memberBusinesses.description,
      coverUrl:    memberBusinesses.coverUrl,
      category:    memberBusinesses.category,
      sector:      memberBusinesses.sector,
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

  const descHtml = row.description ? renderBody(row.description) : null;

  return (
    <div className="py-10">
      <div className="max-w-4xl mx-auto px-4 space-y-6">
        {/* Breadcrumb */}
        <Link href={`/${slug}/usaha`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft size={16} />
          Direktori Usaha
        </Link>

        {/* Logo */}
        {row.coverUrl && (
          <div className="relative aspect-video rounded-2xl overflow-hidden bg-muted/30 flex items-center justify-center">
            <Image src={row.coverUrl} alt={row.name} fill className="object-contain p-6" unoptimized />
          </div>
        )}

        {/* Header */}
        <div>
          <div className="flex flex-wrap gap-2 mb-2">
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
          <h1 className="text-2xl font-bold">
            {row.name}
            {row.brand && row.brand !== row.name && (
              <span className="font-normal text-muted-foreground text-lg ml-2">({row.brand})</span>
            )}
          </h1>
          {(provinceName || regencyName) && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1.5">
              <MapPin size={14} />
              {regencyName ? `${regencyName}, ` : ""}{provinceName}
            </div>
          )}
        </div>

        {/* Deskripsi */}
        {descHtml && (
          <div
            className="prose prose-sm max-w-none text-foreground [&_p]:my-2 [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-0.5"
            dangerouslySetInnerHTML={{ __html: descHtml }}
          />
        )}

        {/* Detail info */}
        <div className="rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Briefcase size={15} className="text-primary" /> Informasi Usaha
          </h2>
          <dl className="space-y-0">
            <InfoRow label="Kategori"      value={row.category} />
            <InfoRow label="Sektor"        value={row.sector} />
            <InfoRow label="Legalitas"     value={row.legality} />
            <InfoRow label="Peran Pemilik" value={row.position} />
            <InfoRow label="Karyawan"      value={row.employees} />
            <InfoRow label="Cabang"        value={row.branches} />
            <InfoRow label="Lokasi"        value={[regencyName, provinceName].filter(Boolean).join(", ")} />
          </dl>
          {(row.offeredTags.length > 0 || row.neededTags.length > 0) && (
            <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
              {row.offeredTags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Menawarkan:</span>
                  {row.offeredTags.map(t => (
                    <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{t}</span>
                  ))}
                </div>
              )}
              {row.neededTags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Membutuhkan:</span>
                  {row.neededTags.map(t => (
                    <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{t}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <EcosystemTagCrossLinks
          slug={slug}
          currentModule="usaha"
          offeredTags={row.offeredTags}
          neededTags={row.neededTags}
        />

        {/* Kontak */}
        {(phone || whatsapp || email) && (
          <div className="rounded-xl border border-border p-5 space-y-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Phone size={15} className="text-primary" /> Kontak Usaha
            </h2>
            <div className="space-y-2 text-sm">
              {phone    && <a href={`tel:${phone}`} className="flex items-center gap-2 hover:text-primary"><Phone size={14} className="text-muted-foreground" />{phone}</a>}
              {whatsapp && whatsappWaLink && <a href={whatsappWaLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-primary"><MessageCircle size={14} className="text-muted-foreground" />{whatsapp}</a>}
              {email    && <a href={`mailto:${email}`} className="flex items-center gap-2 hover:text-primary"><Mail size={14} className="text-muted-foreground" />{email}</a>}
            </div>
          </div>
        )}

        {/* Social media */}
        {Object.keys(socials).length > 0 && <SocialLinks value={socials} />}

        {/* Pemilik */}
        <div className="rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Users size={15} className="text-primary" /> Pemilik / Pengelola IKPM
          </h2>
          <div className="flex items-center gap-3">
            {row.ownerPhoto ? (
              <Image src={row.ownerPhoto} alt={row.ownerName} width={40} height={40} className="rounded-full object-cover" unoptimized />
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                {row.ownerName.split(" ").slice(0,2).map(w=>w[0]).join("").toUpperCase()}
              </div>
            )}
            <p className="font-medium text-sm">{row.ownerName}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
