export const dynamic = "force-dynamic";
import { NextRequest, NextResponse }           from "next/server";
import { eq, and }                             from "drizzle-orm";
import {
  db, members, tenants, tenantMemberships,
  contacts, addresses, socialMedias,
  refRegencies, refIkpmCabang,
  createTenantDb, getSettings,
  generateMemberNumber,
  syncAutoTenantMemberships,
  encryptPii, decryptPii, hashPiiForLookup,
} from "@jalajogja/db";
import { auth } from "@/lib/auth";

// ─── Helper ──────────────────────────────────────────────────────────────────

async function getSessionMember(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) return { error: "Login diperlukan.", status: 401 as const, member: null };

  const member = await db.query.members.findFirst({
    where: eq(members.betterAuthUserId, session.user.id),
    columns: {
      id: true, name: true, nik: true, stambukNumber: true, gender: true,
      birthDate: true, birthRegencyId: true, birthPlaceText: true,
      graduationYear: true, graduationPeriod: true, professionId: true, memberNumber: true,
      waliSantri: true, photoUrl: true, primaryCabangRefId: true,
      contactId: true, homeAddressId: true, socialMediaId: true, domicileStatus: true,
    },
  });

  if (!member)
    return { error: "Akun ini bukan anggota IKPM.", status: 403 as const, member: null };

  return { error: null, status: 200 as const, member };
}

// ─── GET /api/akun/member-data ────────────────────────────────────────────────
// Fetch data identitas + kontak milik anggota yang sedang login.

export async function GET(req: NextRequest) {
  const { error, status, member } = await getSessionMember(req);
  if (error || !member) return NextResponse.json({ error }, { status });

  // Pre-fill provinsi dari setting tenant jika member belum punya alamat
  const slug = req.nextUrl.searchParams.get("slug")?.trim();
  let tenantProvinceId: number | null = null;
  if (slug && !member.homeAddressId) {
    try {
      const tenantClient = createTenantDb(slug);
      const settings     = await getSettings(tenantClient, "contact");
      const addr         = settings.contact_address as { provinceId?: number } | undefined;
      tenantProvinceId   = addr?.provinceId ?? null;
    } catch { /* tenant tidak ditemukan — abaikan */ }
  }

  // Fetch contact
  let contact: {
    phone: string | null; whatsapp: string | null; email: string | null;
    isPhonePublic: boolean; isWhatsappPublic: boolean; isEmailPublic: boolean;
  } | null = null;
  if (member.contactId) {
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
      .where(eq(contacts.id, member.contactId))
      .limit(1);
    contact = c ?? null;
  }

  // Fetch address
  let address: {
    detail: string | null; country: string | null;
    provinceId: number | null; regencyId: number | null;
    districtId: number | null; villageId: number | null;
    postalCode: string | null;
  } | null = null;
  if (member.homeAddressId) {
    const [a] = await db
      .select({
        detail:     addresses.detail,
        country:    addresses.country,
        provinceId: addresses.provinceId,
        regencyId:  addresses.regencyId,
        districtId: addresses.districtId,
        villageId:  addresses.villageId,
        postalCode: addresses.postalCode,
      })
      .from(addresses)
      .where(eq(addresses.id, member.homeAddressId))
      .limit(1);
    address = a ?? null;
  }

  // Fetch social media
  let social: {
    instagram: string | null; facebook: string | null; linkedin: string | null;
    twitter: string | null; youtube: string | null; tiktok: string | null; website: string | null;
  } | null = null;
  if (member.socialMediaId) {
    const [s] = await db
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
      .where(eq(socialMedias.id, member.socialMediaId))
      .limit(1);
    social = s ?? null;
  }

  return NextResponse.json({
    success: true,
    data: {
      // Identitas
      id:            member.id,
      name:          member.name,
      nik:           decryptPii(member.nik),
      stambukNumber: member.stambukNumber,
      gender:        member.gender,
      birthDate:     member.birthDate,
      birthRegencyId:   member.birthRegencyId,
      birthRegencyName: member.birthRegencyId
        ? await db.select({ name: refRegencies.name })
            .from(refRegencies)
            .where(eq(refRegencies.id, member.birthRegencyId))
            .limit(1)
            .then(r => r[0]?.name ?? null)
        : null,
      birthPlaceText: member.birthPlaceText,
      graduationYear: member.graduationYear,
      professionId:  member.professionId,
      memberNumber:  member.memberNumber,
      graduationPeriod: member.graduationPeriod ?? null,
      waliSantri:         member.waliSantri ?? null,
      photoUrl:           member.photoUrl ?? null,
      domicileStatus:     member.domicileStatus,
      primaryCabangRefId: member.primaryCabangRefId ?? null,
      // Kontak
      contact,
      // Alamat
      address,
      // Sosial media
      social,
      // Hint dari tenant — hanya terisi jika member belum punya alamat sendiri
      tenantProvinceId,
    },
  });
}

// ─── PATCH /api/akun/member-data ──────────────────────────────────────────────
// Update identitas anggota (Step 1).
// Admin-only fields (status, joinedAt, memberNumber) tidak bisa diubah di sini.

export async function PATCH(req: NextRequest) {
  const { error, status, member } = await getSessionMember(req);
  if (error || !member) return NextResponse.json({ error }, { status });


  const body = await req.json() as {
    name?:           string;
    nik?:            string;
    stambukNumber?:  string;
    gender?:         "male" | "female" | null;
    birthDate?:      string | null;
    birthRegencyId?: number | null;
    birthPlaceText?: string | null;
    graduationYear?:   number | null;
    graduationPeriod?: "awal" | "akhir" | null;
    professionId?:     number | null;
    waliSantri?:          "gontor" | "alumni" | "lain" | "bukan" | null;
    photoUrl?:            string | null;
    primaryCabangRefId?:  string | null;
  };

  if (body.name !== undefined && !body.name?.trim())
    return NextResponse.json({ error: "Nama tidak boleh kosong." }, { status: 400 });

  // graduationYear wajib diisi (tidak boleh dikosongkan) dan harus tahun 4-digit lengkap —
  // cegah entri disingkat 2 digit (mis. "99" dikira mewakili 1999) yang lolos secara numerik
  // tapi salah secara semantik. Cuma divalidasi kalau field ini benar-benar disentuh (endpoint
  // ini partial-update — field yang tidak dikirim tidak boleh ikut divalidasi/diubah).
  if (body.graduationYear !== undefined) {
    const y = body.graduationYear;
    if (y === null || !Number.isInteger(y) || y < 1920 || y > new Date().getFullYear()) {
      return NextResponse.json(
        { error: "Tahun lulus KMI wajib diisi dengan tahun 4-digit lengkap (mis. 1999), bukan disingkat 2 digit." },
        { status: 400 },
      );
    }
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (body.name          !== undefined) updateData.name           = body.name.trim();
  if (body.nik           !== undefined) {
    updateData.nik     = encryptPii(body.nik);
    updateData.nikHash = hashPiiForLookup(body.nik);
  }
  if (body.stambukNumber !== undefined) updateData.stambukNumber  = body.stambukNumber?.trim() || null;
  if (body.gender        !== undefined) updateData.gender         = body.gender               || null;
  if (body.birthDate     !== undefined) updateData.birthDate      = body.birthDate            || null;
  if (body.birthRegencyId !== undefined) updateData.birthRegencyId = body.birthRegencyId      ?? null;
  if (body.birthPlaceText !== undefined) updateData.birthPlaceText = body.birthPlaceText?.trim() || null;
  if (body.graduationYear   !== undefined) updateData.graduationYear   = body.graduationYear   ?? null;
  if (body.graduationPeriod !== undefined) updateData.graduationPeriod = body.graduationPeriod ?? null;
  if (body.professionId     !== undefined) updateData.professionId     = body.professionId     ?? null;
  if (body.waliSantri          !== undefined) updateData.waliSantri         = body.waliSantri         ?? null;
  if (body.photoUrl            !== undefined) updateData.photoUrl           = body.photoUrl?.trim()    || null;
  if (body.primaryCabangRefId  !== undefined) updateData.primaryCabangRefId = body.primaryCabangRefId  ?? null;

  // Auto-generate No. Anggota saat birthDate diisi dan member belum punya nomor
  if (!member.memberNumber) {
    const effectiveBirthDate = (body.birthDate ?? member.birthDate) || null;
    updateData.memberNumber = await generateMemberNumber(db, effectiveBirthDate);
  }

  await db.update(members).set(updateData).where(eq(members.id, member.id));

  // Auto-sync keanggotaan ke tenant PC IKPM Cabang & Marhalah jika tenant tersebut ada & aktif
  const finalCabangRefId = body.primaryCabangRefId !== undefined ? body.primaryCabangRefId : member.primaryCabangRefId;
  const finalGraduationYear = body.graduationYear !== undefined ? body.graduationYear : member.graduationYear;
  const finalGraduationPeriod = body.graduationPeriod !== undefined ? body.graduationPeriod : member.graduationPeriod;

  await syncAutoTenantMemberships(
    db,
    member.id,
    finalCabangRefId,
    finalGraduationYear,
    finalGraduationPeriod,
  );

  return NextResponse.json({ success: true });
}
