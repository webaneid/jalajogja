import { notFound }   from "next/navigation";
import { eq, and, inArray } from "drizzle-orm";
import {
  db, members, tenants, tenantMemberships,
  memberOwnedPesantren, contacts, addresses, socialMedias,
  refProvinces, refRegencies,
} from "@jalajogja/db";
import Image    from "next/image";
import Link     from "next/link";
import type { Metadata } from "next";
import {
  School, MapPin, Phone, MessageCircle, Mail, Globe,
  Users, BookOpen, ChevronLeft,
} from "lucide-react";
import { displayPhone } from "@/lib/phone";
import { generateMetadata as buildMetadata, getTenantSeoBase } from "@/lib/seo";

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
  let phone:    string | null = null;
  let whatsapp: string | null = null;
  let email:    string | null = null;
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
      if (c.isWhatsappPublic) whatsapp = displayPhone(c.whatsapp);
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

  return (
    <div className="py-10">
      <div className="max-w-4xl mx-auto px-4 space-y-6">
        {/* Breadcrumb */}
        <Link href={`/${slug}/pesantren`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft size={16} />
          Direktori Pesantren
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
            {row.kurikulum && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{row.kurikulum}</span>
            )}
            {row.kategoriSantri && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground">{row.kategoriSantri}</span>
            )}
          </div>
          <h1 className="text-2xl font-bold">{row.name}</h1>
          {(provinceName || regencyName) && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1.5">
              <MapPin size={14} />
              {regencyName ? `${regencyName}, ` : ""}{provinceName}
            </div>
          )}
        </div>

        {/* Statistik ringkas */}
        {(totalSantri > 0 || totalAsatidz > 0) && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {row.santriPutra !== null && row.santriPutra !== undefined && (
              <div className="rounded-xl border border-border p-4 text-center">
                <p className="text-2xl font-bold">{row.santriPutra.toLocaleString("id-ID")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Santri Putra</p>
              </div>
            )}
            {row.santriPutri !== null && row.santriPutri !== undefined && (
              <div className="rounded-xl border border-border p-4 text-center">
                <p className="text-2xl font-bold">{row.santriPutri.toLocaleString("id-ID")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Santri Putri</p>
              </div>
            )}
            {row.asatidz !== null && row.asatidz !== undefined && (
              <div className="rounded-xl border border-border p-4 text-center">
                <p className="text-2xl font-bold">{row.asatidz.toLocaleString("id-ID")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Asatidz (Putra)</p>
              </div>
            )}
            {row.asatidzah !== null && row.asatidzah !== undefined && (
              <div className="rounded-xl border border-border p-4 text-center">
                <p className="text-2xl font-bold">{row.asatidzah.toLocaleString("id-ID")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Asatidzah (Putri)</p>
              </div>
            )}
          </div>
        )}

        {/* Detail info */}
        <div className="rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <BookOpen size={15} className="text-primary" /> Informasi Pesantren
          </h2>
          <dl className="space-y-0">
            <InfoRow label="Tahun Berdiri"    value={row.tahunBerdiri} />
            <InfoRow label="Luas Area"        value={row.luasArea} />
            <InfoRow label="Nama Pimpinan"    value={row.namaPimpinan} />
            <InfoRow label="Kurikulum"        value={row.kurikulum} />
            <InfoRow label="Jenis Pondok"     value={row.jenisPondok} />
            <InfoRow label="Model Pendidikan" value={row.modelPendidikan} />
            <InfoRow label="Kategori Santri"  value={row.kategoriSantri} />
            <InfoRow label="Lokasi"           value={[regencyName, provinceName].filter(Boolean).join(", ")} />
          </dl>
        </div>

        {/* Kontak */}
        {(phone || whatsapp || email) && (
          <div className="rounded-xl border border-border p-5 space-y-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Phone size={15} className="text-primary" /> Kontak Pesantren
            </h2>
            <div className="space-y-2 text-sm">
              {phone    && <a href={`tel:${phone}`}    className="flex items-center gap-2 hover:text-primary"><Phone size={14} className="text-muted-foreground" />{phone}</a>}
              {whatsapp && <a href={`https://wa.me/${whatsapp.replace(/\D/g,"")}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-primary"><MessageCircle size={14} className="text-muted-foreground" />{whatsapp}</a>}
              {email    && <a href={`mailto:${email}`} className="flex items-center gap-2 hover:text-primary"><Mail size={14} className="text-muted-foreground" />{email}</a>}
            </div>
          </div>
        )}

        {/* Social media */}
        {Object.keys(socials).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {socials.instagram && <a href={`https://instagram.com/${socials.instagram}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border hover:bg-muted/50 transition-colors"><Globe size={12} />@{socials.instagram}</a>}
            {socials.youtube   && <a href={socials.youtube}                               target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border hover:bg-muted/50 transition-colors"><Globe size={12} />YouTube</a>}
            {socials.facebook  && <a href={`https://facebook.com/${socials.facebook}`}   target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border hover:bg-muted/50 transition-colors"><Globe size={12} />Facebook</a>}
            {socials.tiktok    && <a href={`https://tiktok.com/@${socials.tiktok}`}      target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border hover:bg-muted/50 transition-colors"><Globe size={12} />@{socials.tiktok}</a>}
            {socials.twitter   && <a href={`https://twitter.com/${socials.twitter}`}     target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border hover:bg-muted/50 transition-colors"><Globe size={12} />@{socials.twitter}</a>}
            {socials.linkedin  && <a href={socials.linkedin}                              target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border hover:bg-muted/50 transition-colors"><Globe size={12} />LinkedIn</a>}
            {socials.website   && <a href={socials.website}                               target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border hover:bg-muted/50 transition-colors"><Globe size={12} />Website</a>}
          </div>
        )}

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
