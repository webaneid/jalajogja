export const dynamic = "force-dynamic";
import { NextRequest, NextResponse }   from "next/server";
import { eq }                           from "drizzle-orm";
import {
  db, members, memberOwnedPesantren,
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

// ── GET /api/akun/member-pesantren ────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { error, status, member } = await getSessionMember(req);
  if (error || !member) return NextResponse.json({ error }, { status });

  const rows = await db
    .select({
      id:           memberOwnedPesantren.id,
      name:         memberOwnedPesantren.name,
      tahunBerdiri: memberOwnedPesantren.tahunBerdiri,
      luasArea:     memberOwnedPesantren.luasArea,
      namaPimpinan: memberOwnedPesantren.namaPimpinan,
      hpPimpinan:   memberOwnedPesantren.hpPimpinan,
      kurikulum:       memberOwnedPesantren.kurikulum,
      jenisPondok:     memberOwnedPesantren.jenisPondok,
      modelPendidikan: memberOwnedPesantren.modelPendidikan,
      kategoriSantri:  memberOwnedPesantren.kategoriSantri,
      santriPutra:  memberOwnedPesantren.santriPutra,
      santriPutri:  memberOwnedPesantren.santriPutri,
      asatidz:      memberOwnedPesantren.asatidz,
      asatidzah:    memberOwnedPesantren.asatidzah,
      coverUrl:     memberOwnedPesantren.coverUrl,
      // Kontak
      phone:            contacts.phone,
      whatsapp:         contacts.whatsapp,
      email:            contacts.email,
      isPhonePublic:    contacts.isPhonePublic,
      isWhatsappPublic: contacts.isWhatsappPublic,
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
    .from(memberOwnedPesantren)
    .leftJoin(contacts,    eq(contacts.id,    memberOwnedPesantren.contactId))
    .leftJoin(addresses,   eq(addresses.id,   memberOwnedPesantren.addressId))
    .leftJoin(socialMedias, eq(socialMedias.id, memberOwnedPesantren.socialMediaId))
    .leftJoin(refProvinces, eq(refProvinces.id, addresses.provinceId))
    .leftJoin(refRegencies, eq(refRegencies.id, addresses.regencyId))
    .leftJoin(refDistricts, eq(refDistricts.id, addresses.districtId))
    .leftJoin(refVillages,  eq(refVillages.id,  addresses.villageId))
    .where(eq(memberOwnedPesantren.memberId, member.id));

  return NextResponse.json({ success: true, data: rows });
}

// ── POST /api/akun/member-pesantren — replace-all ─────────────────────────────
export async function POST(req: NextRequest) {
  const { error, status, member } = await getSessionMember(req);
  if (error || !member) return NextResponse.json({ error }, { status });

  const body = await req.json() as {
    entries: {
      name: string;
      tahunBerdiri?: number | null;
      luasArea?: string;
      namaPimpinan?: string;
      hpPimpinan?: string;
      kurikulum?: string;
      jenisPondok?: string;
      modelPendidikan?: string;
      kategoriSantri?: string;
      santriPutra?: number | null;
      santriPutri?: number | null;
      asatidz?: number | null;
      asatidzah?: number | null;
      phone?: string; whatsapp?: string; email?: string;
      isPhonePublic?: boolean; isWhatsappPublic?: boolean;
      addressCountry?: string; addressProvinceId?: number; addressRegencyId?: number;
      addressDistrictId?: number; addressVillageId?: number;
      addressDetail?: string; addressPostalCode?: string;
      instagram?: string; facebook?: string; linkedin?: string;
      twitter?: string; youtube?: string; tiktok?: string; website?: string;
      coverUrl?: string;
    }[];
  };

  const valid = (body.entries ?? []).filter(e => e.name?.trim());

  try {
    await db.delete(memberOwnedPesantren)
      .where(eq(memberOwnedPesantren.memberId, member.id));

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
          })
          .returning({ id: contacts.id });
        contactId = c.id;
      }

      if (e.addressCountry || e.addressProvinceId || e.addressDetail) {
        const isOverseas = !!e.addressCountry;
        const [a] = await db.insert(addresses)
          .values({
            label:      "usaha" as const,
            country:    e.addressCountry?.trim()   || null,
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

      if (e.instagram || e.facebook || e.linkedin || e.twitter ||
          e.youtube   || e.tiktok   || e.website) {
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

      await db.insert(memberOwnedPesantren).values({
        memberId:     member.id,
        name:         e.name.trim(),
        tahunBerdiri: e.tahunBerdiri   ?? null,
        luasArea:     e.luasArea?.trim()     || null,
        namaPimpinan: e.namaPimpinan?.trim() || null,
        hpPimpinan:   normalizePhone(e.hpPimpinan),
        kurikulum:       (e.kurikulum       || null) as typeof memberOwnedPesantren.$inferInsert["kurikulum"],
        jenisPondok:     (e.jenisPondok     || null) as typeof memberOwnedPesantren.$inferInsert["jenisPondok"],
        modelPendidikan: (e.modelPendidikan || null) as typeof memberOwnedPesantren.$inferInsert["modelPendidikan"],
        kategoriSantri:  (e.kategoriSantri  || null) as typeof memberOwnedPesantren.$inferInsert["kategoriSantri"],
        santriPutra:  e.santriPutra  ?? null,
        santriPutri:  e.santriPutri  ?? null,
        asatidz:      e.asatidz      ?? null,
        asatidzah:    e.asatidzah    ?? null,
        coverUrl:     e.coverUrl?.trim() || null,
        contactId, addressId, socialMediaId,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[POST /api/akun/member-pesantren]", err);
    return NextResponse.json({ error: "Gagal menyimpan." }, { status: 500 });
  }
}
