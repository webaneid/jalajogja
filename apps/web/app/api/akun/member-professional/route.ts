export const dynamic = "force-dynamic";
import { NextRequest, NextResponse }                        from "next/server";
import { eq }                                                from "drizzle-orm";
import {
  db, members, memberProfessionals,
  contacts, addresses, socialMedias,
  refProvinces, refRegencies, refDistricts, refVillages,
} from "@jalajogja/db";
import { auth }           from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";

async function getSessionMember(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) return { error: "Login diperlukan.", status: 401 as const, member: null };
  const member = await db.query.members.findFirst({
    where: eq(members.betterAuthUserId, session.user.id),
    columns: { id: true },
  });
  if (!member) return { error: "Bukan anggota IKPM.", status: 403 as const, member: null };
  return { error: null, status: 200 as const, member };
}

// ── GET /api/akun/member-professional ──────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { error, status, member } = await getSessionMember(req);
  if (error || !member) return NextResponse.json({ error }, { status });

  const rows = await db
    .select({
      id:                 memberProfessionals.id,
      title:               memberProfessionals.title,
      professionCategory:  memberProfessionals.professionCategory,
      professionType:      memberProfessionals.professionType,
      specialization:      memberProfessionals.specialization,
      description:         memberProfessionals.description,
      offeredTags:         memberProfessionals.offeredTags,
      neededTags:          memberProfessionals.neededTags,
      licenseType:         memberProfessionals.licenseType,
      licenseNumber:       memberProfessionals.licenseNumber,
      employmentType:      memberProfessionals.employmentType,
      institution:         memberProfessionals.institution,
      startYear:           memberProfessionals.startYear,
      coverUrl:            memberProfessionals.coverUrl,
      // Kontak
      phone:              contacts.phone,
      whatsapp:           contacts.whatsapp,
      email:              contacts.email,
      isPhonePublic:      contacts.isPhonePublic,
      isWhatsappPublic:   contacts.isWhatsappPublic,
      isEmailPublic:      contacts.isEmailPublic,
      // Alamat
      addressCountry:    addresses.country,
      addressProvinceId: addresses.provinceId,
      addressRegencyId:  addresses.regencyId,
      addressDistrictId: addresses.districtId,
      addressVillageId:  addresses.villageId,
      addressDetail:     addresses.detail,
      addressPostalCode: addresses.postalCode,
      // Nama wilayah (resolved dari ref tables)
      addressProvinceName: refProvinces.name,
      addressRegencyName:  refRegencies.name,
      addressDistrictName: refDistricts.name,
      addressVillageName:  refVillages.name,
      // Sosmed
      instagram: socialMedias.instagram,
      facebook:  socialMedias.facebook,
      linkedin:  socialMedias.linkedin,
      twitter:   socialMedias.twitter,
      youtube:   socialMedias.youtube,
      tiktok:    socialMedias.tiktok,
      website:   socialMedias.website,
    })
    .from(memberProfessionals)
    .leftJoin(contacts,     eq(contacts.id,     memberProfessionals.contactId))
    .leftJoin(addresses,    eq(addresses.id,    memberProfessionals.addressId))
    .leftJoin(socialMedias, eq(socialMedias.id, memberProfessionals.socialMediaId))
    .leftJoin(refProvinces, eq(refProvinces.id, addresses.provinceId))
    .leftJoin(refRegencies, eq(refRegencies.id, addresses.regencyId))
    .leftJoin(refDistricts, eq(refDistricts.id, addresses.districtId))
    .leftJoin(refVillages,  eq(refVillages.id,  addresses.villageId))
    .where(eq(memberProfessionals.memberId, member.id));

  return NextResponse.json({ success: true, data: rows });
}

// ── POST /api/akun/member-professional — replace-all ────────────────────────────
export async function POST(req: NextRequest) {
  const { error, status, member } = await getSessionMember(req);
  if (error || !member) return NextResponse.json({ error }, { status });

  const body = await req.json() as {
    entries: {
      title?: string;
      professionCategory: string;
      professionType: string;
      specialization?: string;
      description?: string;
      offeredTags?: string[]; neededTags?: string[];
      licenseType?: string;
      licenseNumber?: string;
      employmentType?: string;
      institution?: string;
      startYear?: number;
      addressCountry?: string; addressProvinceId?: number; addressRegencyId?: number;
      addressDistrictId?: number; addressVillageId?: number;
      addressDetail?: string; addressPostalCode?: string;
      phone?: string; whatsapp?: string; email?: string;
      isPhonePublic?: boolean; isWhatsappPublic?: boolean; isEmailPublic?: boolean;
      instagram?: string; facebook?: string; linkedin?: string;
      twitter?: string; youtube?: string; tiktok?: string; website?: string;
      coverUrl?: string;
    }[];
  };

  const valid = (body.entries ?? []).filter(e => e.professionType?.trim() && e.professionCategory);

  try {
    await db.delete(memberProfessionals).where(eq(memberProfessionals.memberId, member.id));

    for (const e of valid) {
      let contactId:     string | null = null;
      let addressId:     string | null = null;
      let socialMediaId: string | null = null;

      if (e.phone || e.whatsapp || e.email) {
        const [c] = await db.insert(contacts)
          .values({
            phone:            normalizePhone(e.phone),
            whatsapp:         normalizePhone(e.whatsapp),
            email:            e.email?.trim().toLowerCase() || null,
            isPhonePublic:    e.isPhonePublic    ?? false,
            isWhatsappPublic: e.isWhatsappPublic ?? false,
            isEmailPublic:    e.isEmailPublic    ?? false,
          })
          .returning({ id: contacts.id });
        contactId = c.id;
      }

      if (e.addressCountry || e.addressProvinceId || e.addressDetail) {
        const isOverseas = !!e.addressCountry;
        const [a] = await db.insert(addresses)
          .values({
            label:      "profesional" as const,
            country:    e.addressCountry?.trim()  || null,
            provinceId: isOverseas ? null : (e.addressProvinceId ?? null),
            regencyId:  isOverseas ? null : (e.addressRegencyId  ?? null),
            districtId: isOverseas ? null : (e.addressDistrictId ?? null),
            villageId:  isOverseas ? null : (e.addressVillageId  ?? null),
            detail:     e.addressDetail?.trim()    || null,
            postalCode: e.addressPostalCode?.trim() || null,
          })
          .returning({ id: addresses.id });
        addressId = a.id;
      }

      if (e.instagram || e.facebook || e.linkedin || e.twitter || e.youtube || e.tiktok || e.website) {
        const [s] = await db.insert(socialMedias)
          .values({
            instagram: e.instagram?.trim() || null,
            facebook:  e.facebook?.trim()  || null,
            linkedin:  e.linkedin?.trim()  || null,
            twitter:   e.twitter?.trim()   || null,
            youtube:   e.youtube?.trim()   || null,
            tiktok:    e.tiktok?.trim()    || null,
            website:   e.website?.trim()   || null,
          })
          .returning({ id: socialMedias.id });
        socialMediaId = s.id;
      }

      await db.insert(memberProfessionals).values({
        memberId:           member.id,
        title:              e.title?.trim()          || null,
        professionCategory: e.professionCategory as
          "Sains, Teknik & Rekayasa" | "Kesehatan" | "Pendidikan & Akademik" |
          "Bisnis, Keuangan & Manajemen" | "Teknologi Informasi" | "Hukum, Sosial & Budaya" | "Lainnya",
        professionType:     e.professionType.trim(),
        specialization:     e.specialization?.trim() || null,
        description:        e.description?.trim()    || null,
        offeredTags:        e.offeredTags ?? [],
        neededTags:         e.neededTags  ?? [],
        licenseType:        e.licenseType?.trim()     || null,
        licenseNumber:      e.licenseNumber?.trim()   || null,
        employmentType:     (e.employmentType || null) as
          "Praktik Mandiri" | "Karyawan/Pegawai" | "Pemilik Firma/Klinik/Kantor" | "Freelance/Konsultan Lepas" | null,
        institution:        e.institution?.trim()     || null,
        startYear:          e.startYear ?? null,
        coverUrl:           e.coverUrl?.trim()         || null,
        contactId, addressId, socialMediaId,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[POST /api/akun/member-professional]", err);
    return NextResponse.json({ error: "Gagal menyimpan." }, { status: 500 });
  }
}
