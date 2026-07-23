export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { eq, and, inArray } from "drizzle-orm";
import { rateLimitGuard }   from "@/lib/rate-limit";
import {
  db, members, tenants, tenantMemberships,
  contacts, addresses, socialMedias, refProfessions,
  refProvinces, refRegencies, memberBusinesses, memberOwnedPesantren,
} from "@jalajogja/db";
import { displayPhone, toWaDigits } from "@/lib/phone";

// GET /api/member-public/[id]?slug={tenantSlug}
// Publik — tidak butuh auth. Return hanya field yang sesuai aturan visibilitas.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const blocked = rateLimitGuard(req, "member-public", 30, 60_000);
  if (blocked) return blocked;

  try {
  const { id } = await params;
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug diperlukan" }, { status: 400 });

  // Validasi UUID format — cegah DB error jika id bukan UUID valid
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });

  // 1. Resolve tenant
  const [tenant] = await db
    .select({ id: tenants.id, isActive: tenants.isActive })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);
  if (!tenant?.isActive) return NextResponse.json({ error: "Tenant tidak ditemukan" }, { status: 404 });

  // 2. Verifikasi scope: member harus terdaftar di tenant ini
  const [membership] = await db
    .select({ id: tenantMemberships.id, status: tenantMemberships.status })
    .from(tenantMemberships)
    .where(
      and(
        eq(tenantMemberships.tenantId, tenant.id),
        eq(tenantMemberships.memberId, id),
        inArray(tenantMemberships.status, ["active", "alumni"]),
      ),
    )
    .limit(1);
  if (!membership) return NextResponse.json({ error: "Anggota tidak ditemukan" }, { status: 404 });

  // 3. Fetch data member
  const [m] = await db
    .select({
      id:               members.id,
      name:             members.name,
      photoUrl:         members.photoUrl,
      gender:           members.gender,
      graduationYear:   members.graduationYear,
      graduationPeriod: members.graduationPeriod,
      birthRegencyId:   members.birthRegencyId,
      professionId:     members.professionId,
      homeAddressId:    members.homeAddressId,
      contactId:        members.contactId,
      socialMediaId:    members.socialMediaId,
    })
    .from(members)
    .where(eq(members.id, id))
    .limit(1);
  if (!m) return NextResponse.json({ error: "Anggota tidak ditemukan" }, { status: 404 });

  // 4. Profession
  let professionName: string | null = null;
  let professionCategory: string | null = null;
  if (m.professionId) {
    const [prof] = await db
      .select({ name: refProfessions.name, category: refProfessions.category })
      .from(refProfessions)
      .where(eq(refProfessions.id, m.professionId))
      .limit(1);
    if (prof) { professionName = prof.name; professionCategory = prof.category; }
  }

  // 5. Domisili (provinsi + kabupaten saja — bukan detail)
  let domicileProvince: string | null = null;
  let domicileRegency: string | null = null;
  if (m.homeAddressId) {
    const [addr] = await db
      .select({ provinceId: addresses.provinceId, regencyId: addresses.regencyId })
      .from(addresses)
      .where(eq(addresses.id, m.homeAddressId))
      .limit(1);
    if (addr?.provinceId) {
      const [prov] = await db
        .select({ name: refProvinces.name })
        .from(refProvinces)
        .where(eq(refProvinces.id, addr.provinceId))
        .limit(1);
      domicileProvince = prov?.name ?? null;
    }
    if (addr?.regencyId) {
      const [reg] = await db
        .select({ name: refRegencies.name })
        .from(refRegencies)
        .where(eq(refRegencies.id, addr.regencyId))
        .limit(1);
      domicileRegency = reg?.name ?? null;
    }
  }

  // 6. Tempat lahir — hanya provinsi asal
  let birthProvince: string | null = null;
  if (m.birthRegencyId) {
    const [reg] = await db
      .select({ provinceId: refRegencies.provinceId })
      .from(refRegencies)
      .where(eq(refRegencies.id, m.birthRegencyId))
      .limit(1);
    if (reg?.provinceId) {
      const [prov] = await db
        .select({ name: refProvinces.name })
        .from(refProvinces)
        .where(eq(refProvinces.id, reg.provinceId))
        .limit(1);
      birthProvince = prov?.name ?? null;
    }
  }

  // 7. Kontak — hanya yang is_*_public = true
  let phone: string | null = null;
  let whatsapp: string | null = null;
  let whatsappWaLink: string | null = null;
  let email: string | null = null;
  if (m.contactId) {
    const [c] = await db
      .select({
        phone:            contacts.phone,
        whatsapp:         contacts.whatsapp,
        email:            contacts.email,
        isPhonePublic:    contacts.isPhonePublic,
        isWhatsappPublic: contacts.isWhatsappPublic,
        isEmailPublic:    contacts.isEmailPublic,
      })
      .from(contacts)
      .where(eq(contacts.id, m.contactId))
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

  // 8. Social media — semua yang diisi
  let socials: Record<string, string> = {};
  if (m.socialMediaId) {
    const [sm] = await db
      .select({
        instagram: socialMedias.instagram,
        facebook:  socialMedias.facebook,
        linkedin:  socialMedias.linkedin,
        twitter:   socialMedias.twitter,
        youtube:   socialMedias.youtube,
        tiktok:    socialMedias.tiktok,
        website:   socialMedias.website,
      })
      .from(socialMedias)
      .where(eq(socialMedias.id, m.socialMediaId))
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

  // 9. Usaha milik (ringkasan maks 3)
  const businesses = await db
    .select({ id: memberBusinesses.id, name: memberBusinesses.name, sector: memberBusinesses.sector, category: memberBusinesses.category })
    .from(memberBusinesses)
    .where(and(eq(memberBusinesses.memberId, id), eq(memberBusinesses.isActive, true)))
    .limit(3);

  // 10. Pesantren milik (ringkasan maks 3)
  const pesantrenList = await db
    .select({ id: memberOwnedPesantren.id, name: memberOwnedPesantren.name, kurikulum: memberOwnedPesantren.kurikulum })
    .from(memberOwnedPesantren)
    .where(eq(memberOwnedPesantren.memberId, id))
    .limit(3);

  return NextResponse.json({
    id:               m.id,
    name:             m.name,
    photoUrl:         m.photoUrl,
    gender:           m.gender,
    graduationYear:   m.graduationYear,
    graduationPeriod: m.graduationPeriod,
    professionName,
    professionCategory,
    domicileProvince,
    domicileRegency,
    birthProvince,
    membershipStatus: membership.status,
    phone,
    whatsapp,
    whatsappWaLink,
    email,
    socials,
    businesses,
    pesantrenList,
  });
  } catch (err) {
    console.error("[member-public] Error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
