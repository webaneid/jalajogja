export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { eq }                        from "drizzle-orm";
import {
  db, members,
  contacts, addresses, socialMedias,
} from "@jalajogja/db";
import { auth }           from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";

// ─── PATCH /api/akun/member-contact ──────────────────────────────────────────
// Update kontak + alamat + sosial media anggota (Step 2).
// Upsert pattern: buat helper row baru jika belum ada, update jika sudah ada.

export async function PATCH(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id)
    return NextResponse.json({ error: "Login diperlukan." }, { status: 401 });

  // Auth via members.better_auth_user_id (bukan via profiles)
  const [member] = await db
    .select({
      id:            members.id,
      contactId:     members.contactId,
      homeAddressId: members.homeAddressId,
      socialMediaId: members.socialMediaId,
    })
    .from(members)
    .where(eq(members.betterAuthUserId, session.user.id))
    .limit(1);

  if (!member)
    return NextResponse.json({ error: "Akun ini bukan anggota IKPM." }, { status: 403 });

  const body = await req.json() as {
    // Kontak
    phone?:           string | null;
    whatsapp?:        string | null;
    email?:           string | null;
    isPhonePublic?:    boolean;
    isWhatsappPublic?: boolean;
    isEmailPublic?:    boolean;
    // Domisili
    domicileStatus?: "permanent" | "temporary" | null;
    // Alamat
    addressCountry?:    string | null;
    addressProvinceId?: number | null;
    addressRegencyId?:  number | null;
    addressDistrictId?: number | null;
    addressVillageId?:  number | null;
    addressDetail?:     string | null;
    addressPostalCode?: string | null;
    // Sosial media
    instagram?: string | null;
    facebook?:  string | null;
    linkedin?:  string | null;
    twitter?:   string | null;
    youtube?:   string | null;
    tiktok?:    string | null;
    website?:   string | null;
  };

  if (body.addressCountry?.trim()) {
    // Overseas
  } else if (body.addressProvinceId !== undefined || body.addressRegencyId !== undefined || body.addressDistrictId !== undefined) {
    if (!body.addressProvinceId || !body.addressRegencyId || !body.addressDistrictId) {
      return NextResponse.json(
        { error: "Alamat rumah wajib diisi minimal sampai tingkat Kecamatan." },
        { status: 400 }
      );
    }
  }
  if (body.addressDetail !== undefined && !body.addressDetail?.trim()) {
    return NextResponse.json(
      { error: "Detail alamat domisili wajib diisi." },
      { status: 400 }
    );
  }

  try {
    // ── Upsert contacts ────────────────────────────────────────────────────────
    const hasContact = body.phone || body.whatsapp || body.email;
    let finalContactId = member.contactId;

    if (hasContact) {
      const contactPayload = {
        phone:            normalizePhone(body.phone),
        whatsapp:         normalizePhone(body.whatsapp),
        email:            body.email?.trim()    || null,
        isPhonePublic:    body.isPhonePublic    ?? false,
        isWhatsappPublic: body.isWhatsappPublic ?? false,
        isEmailPublic:    body.isEmailPublic    ?? false,
      };
      if (member.contactId) {
        await db.update(contacts)
          .set({ ...contactPayload, updatedAt: new Date() })
          .where(eq(contacts.id, member.contactId));
      } else {
        const [c] = await db.insert(contacts).values(contactPayload).returning({ id: contacts.id });
        finalContactId = c.id;
      }
    }

    // ── Upsert addresses ───────────────────────────────────────────────────────
    const hasAddress =
      body.addressCountry    || body.addressProvinceId || body.addressRegencyId ||
      body.addressDistrictId || body.addressVillageId  || body.addressDetail    ||
      body.addressPostalCode;
    let finalAddressId = member.homeAddressId;

    if (hasAddress) {
      const isOverseas = !!body.addressCountry;
      const addressPayload = {
        label:      "rumah" as const,
        country:    body.addressCountry?.trim()  || null,
        provinceId: isOverseas ? null : (body.addressProvinceId ?? null),
        regencyId:  isOverseas ? null : (body.addressRegencyId  ?? null),
        districtId: isOverseas ? null : (body.addressDistrictId ?? null),
        villageId:  isOverseas ? null : (body.addressVillageId  ?? null),
        detail:     body.addressDetail?.trim()     || null,
        postalCode: body.addressPostalCode?.trim() || null,
      };
      if (member.homeAddressId) {
        await db.update(addresses)
          .set({ ...addressPayload, updatedAt: new Date() })
          .where(eq(addresses.id, member.homeAddressId));
      } else {
        const [a] = await db.insert(addresses).values(addressPayload).returning({ id: addresses.id });
        finalAddressId = a.id;
      }
    }

    // ── Upsert social_medias ───────────────────────────────────────────────────
    const hasSocial =
      body.instagram || body.facebook || body.linkedin ||
      body.twitter   || body.youtube  || body.tiktok   || body.website;
    let finalSocialMediaId = member.socialMediaId;

    if (hasSocial) {
      const socialPayload = {
        instagram: body.instagram?.trim() || null,
        facebook:  body.facebook?.trim()  || null,
        linkedin:  body.linkedin?.trim()  || null,
        twitter:   body.twitter?.trim()   || null,
        youtube:   body.youtube?.trim()   || null,
        tiktok:    body.tiktok?.trim()    || null,
        website:   body.website?.trim()   || null,
      };
      if (member.socialMediaId) {
        await db.update(socialMedias)
          .set({ ...socialPayload, updatedAt: new Date() })
          .where(eq(socialMedias.id, member.socialMediaId));
      } else {
        const [s] = await db.insert(socialMedias).values(socialPayload).returning({ id: socialMedias.id });
        finalSocialMediaId = s.id;
      }
    }

    // ── Update members: FK + domicile ─────────────────────────────────────────
    await db.update(members)
      .set({
        contactId:      finalContactId,
        homeAddressId:  finalAddressId,
        socialMediaId:  finalSocialMediaId,
        domicileStatus: body.domicileStatus ?? null,
        updatedAt:      new Date(),
      })
      .where(eq(members.id, member.id));

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error("[PATCH /api/akun/member-contact]", err);
    return NextResponse.json({ error: "Terjadi kesalahan. Coba lagi." }, { status: 500 });
  }
}
