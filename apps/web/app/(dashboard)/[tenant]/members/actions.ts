"use server";

import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  db,
  members,
  tenantMemberships,
  contacts,
  addresses,
  socialMedias,
  memberEducations,
  memberBusinesses,
  memberPesantren,
  generateMemberNumber,
} from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { hasFullAccess } from "@/lib/permissions";

// ─── Types ─────────────────────────────────────────────────────────────────
// Catatan: phone/email/address sudah dipindah ke helper tables (contacts, addresses)
// MemberFormData ini untuk Step 1 form wizard — data wajib + data pribadi dasar
// Step 2–4 (kontak, pendidikan, usaha) akan ditangani oleh actions terpisah

export type MemberFormData = {
  name: string;
  stambukNumber?: string;
  nik?: string;
  gender?: "male" | "female";
  birthRegencyId?: number;     // FK ke ref_regencies — untuk lahir di Indonesia
  birthPlaceText?: string;     // Teks bebas: kota/negara jika LN atau data lama
  birthDate?: string;          // YYYY-MM-DD
  graduationYear?: number;     // Tahun lulus/keluar PM Gontor
  professionId?: number;       // FK ke ref_professions
  // Data keanggotaan cabang
  status?: "active" | "inactive" | "alumni";
  joinedAt?: string;           // YYYY-MM-DD
};

type ActionResult =
  | { success: true; memberId: string }
  | { success: false; error: string };

// ─── Helpers ────────────────────────────────────────────────────────────────

function sanitize(data: MemberFormData) {
  return {
    name: data.name.trim(),
    stambukNumber: data.stambukNumber?.trim() || null,
    nik: data.nik?.trim() || null,
    gender: data.gender || null,
    birthRegencyId: data.birthRegencyId ?? null,
    birthPlaceText: data.birthPlaceText?.trim() || null,
    birthDate: data.birthDate || null,
    graduationYear: data.graduationYear || null,
    professionId: data.professionId ?? null,
  };
}

// ─── CREATE ─────────────────────────────────────────────────────────────────

export async function createMemberAction(
  slug: string,
  data: MemberFormData
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "anggota")) return { success: false as const, error: "Akses ditolak." };

  if (!data.name?.trim()) {
    return { success: false, error: "Nama anggota wajib diisi." };
  }

  try {
    // Generate nomor anggota global via PostgreSQL SEQUENCE
    const memberNumber = await generateMemberNumber(db, data.birthDate ?? null);

    const [newMember] = await db
      .insert(members)
      .values({
        ...sanitize(data),
        memberNumber,
      })
      .returning({ id: members.id });

    // Catat keanggotaan di cabang ini
    await db.insert(tenantMemberships).values({
      tenantId: access.tenant.id,
      memberId: newMember.id,
      status: data.status ?? "active",
      joinedAt: data.joinedAt ?? null,
      registeredVia: slug,
    });

    revalidatePath(`/${slug}/members`);
    return { success: true, memberId: newMember.id };

  } catch (err) {
    console.error("[createMemberAction]", err);
    const msg = err instanceof Error ? err.message : "Gagal menyimpan.";
    if (msg.includes("members_nik_not_null_unique")) {
      return { success: false, error: "NIK sudah terdaftar di sistem." };
    }
    return { success: false, error: `Gagal: ${msg}` };
  }
}

// ─── UPDATE ─────────────────────────────────────────────────────────────────

export async function updateMemberAction(
  slug: string,
  memberId: string,
  data: MemberFormData
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "anggota")) return { success: false as const, error: "Akses ditolak." };

  // Pastikan anggota ini memang milik tenant ini
  const [membership] = await db
    .select({ id: tenantMemberships.id })
    .from(tenantMemberships)
    .where(
      and(
        eq(tenantMemberships.tenantId, access.tenant.id),
        eq(tenantMemberships.memberId, memberId)
      )
    )
    .limit(1);

  if (!membership) return { success: false, error: "Anggota tidak ditemukan." };

  if (!data.name?.trim()) {
    return { success: false, error: "Nama anggota wajib diisi." };
  }

  try {
    // Update data identitas global
    await db
      .update(members)
      .set({ ...sanitize(data), updatedAt: new Date() })
      .where(eq(members.id, memberId));

    // Update status keanggotaan di cabang ini
    await db
      .update(tenantMemberships)
      .set({
        status: data.status ?? "active",
        joinedAt: data.joinedAt ?? null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(tenantMemberships.tenantId, access.tenant.id),
          eq(tenantMemberships.memberId, memberId)
        )
      );

    revalidatePath(`/${slug}/members`);
    revalidatePath(`/${slug}/members/${memberId}`);
    return { success: true, memberId };

  } catch (err) {
    console.error("[updateMemberAction]", err);
    const msg = err instanceof Error ? err.message : "Gagal menyimpan.";
    if (msg.includes("members_nik_not_null_unique")) {
      return { success: false, error: "NIK sudah terdaftar di sistem." };
    }
    return { success: false, error: `Gagal: ${msg}` };
  }
}

// ─── UPSERT KONTAK, ALAMAT, SOSIAL MEDIA (Step 2 Wizard) ───────────────────

export type Step2ContactData = {
  // Kontak
  phone?: string;
  whatsapp?: string;
  email?: string;
  // Domisili (langsung di tabel members)
  domicileStatus?: "permanent" | "temporary";
  domicileTenantId?: string;
  // Alamat rumah
  // NULL/undefined = Indonesia; diisi = luar negeri (nama negara)
  addressCountry?: string;
  addressProvinceId?: number;
  addressRegencyId?: number;
  addressDistrictId?: number;
  addressVillageId?: number;
  addressDetail?: string;
  addressPostalCode?: string;
  // Sosial media
  instagram?: string;
  facebook?: string;
  linkedin?: string;
  twitter?: string;
  youtube?: string;
  tiktok?: string;
  website?: string;
};

export async function upsertMemberContactAction(
  slug: string,
  memberId: string,
  data: Step2ContactData
): Promise<{ success: boolean; error?: string }> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "anggota")) return { success: false as const, error: "Akses ditolak." };

  // Pastikan anggota milik tenant ini
  const [membership] = await db
    .select({ id: tenantMemberships.id })
    .from(tenantMemberships)
    .where(
      and(
        eq(tenantMemberships.tenantId, access.tenant.id),
        eq(tenantMemberships.memberId, memberId)
      )
    )
    .limit(1);
  if (!membership) return { success: false, error: "Anggota tidak ditemukan." };

  try {
    // Ambil ID helper tables yang sudah ada di member ini
    const [member] = await db
      .select({
        contactId: members.contactId,
        homeAddressId: members.homeAddressId,
        socialMediaId: members.socialMediaId,
      })
      .from(members)
      .where(eq(members.id, memberId))
      .limit(1);

    // ── Upsert contacts ──────────────────────────────────────────────────────
    const hasContact = data.phone || data.whatsapp || data.email;
    let finalContactId = member.contactId;

    if (hasContact) {
      const contactPayload = {
        phone: data.phone?.trim() || null,
        whatsapp: data.whatsapp?.trim() || null,
        email: data.email?.trim() || null,
      };
      if (member.contactId) {
        await db
          .update(contacts)
          .set({ ...contactPayload, updatedAt: new Date() })
          .where(eq(contacts.id, member.contactId));
      } else {
        const [c] = await db
          .insert(contacts)
          .values(contactPayload)
          .returning({ id: contacts.id });
        finalContactId = c.id;
      }
    }

    // ── Upsert addresses ─────────────────────────────────────────────────────
    const hasAddress =
      data.addressCountry ||
      data.addressProvinceId ||
      data.addressRegencyId ||
      data.addressDistrictId ||
      data.addressVillageId ||
      data.addressDetail ||
      data.addressPostalCode;
    let finalAddressId = member.homeAddressId;

    if (hasAddress) {
      const isOverseas = !!data.addressCountry;
      const addressPayload = {
        label: "rumah" as const,
        country:    data.addressCountry?.trim()  || null,
        // Jika luar negeri, kosongkan semua field wilayah Indonesia
        provinceId: isOverseas ? null : (data.addressProvinceId ?? null),
        regencyId:  isOverseas ? null : (data.addressRegencyId  ?? null),
        districtId: isOverseas ? null : (data.addressDistrictId ?? null),
        villageId:  isOverseas ? null : (data.addressVillageId  ?? null),
        detail: data.addressDetail?.trim() || null,
        postalCode: data.addressPostalCode?.trim() || null,
      };
      if (member.homeAddressId) {
        await db
          .update(addresses)
          .set({ ...addressPayload, updatedAt: new Date() })
          .where(eq(addresses.id, member.homeAddressId));
      } else {
        const [a] = await db
          .insert(addresses)
          .values(addressPayload)
          .returning({ id: addresses.id });
        finalAddressId = a.id;
      }
    }

    // ── Upsert social_medias ─────────────────────────────────────────────────
    const hasSocial =
      data.instagram || data.facebook || data.linkedin ||
      data.twitter || data.youtube || data.tiktok || data.website;
    let finalSocialMediaId = member.socialMediaId;

    if (hasSocial) {
      const socialPayload = {
        instagram: data.instagram?.trim() || null,
        facebook: data.facebook?.trim() || null,
        linkedin: data.linkedin?.trim() || null,
        twitter: data.twitter?.trim() || null,
        youtube: data.youtube?.trim() || null,
        tiktok: data.tiktok?.trim() || null,
        website: data.website?.trim() || null,
      };
      if (member.socialMediaId) {
        await db
          .update(socialMedias)
          .set({ ...socialPayload, updatedAt: new Date() })
          .where(eq(socialMedias.id, member.socialMediaId));
      } else {
        const [s] = await db
          .insert(socialMedias)
          .values(socialPayload)
          .returning({ id: socialMedias.id });
        finalSocialMediaId = s.id;
      }
    }

    // ── Update members ───────────────────────────────────────────────────────
    await db
      .update(members)
      .set({
        contactId: finalContactId,
        homeAddressId: finalAddressId,
        socialMediaId: finalSocialMediaId,
        domicileStatus: data.domicileStatus ?? null,
        domicileTenantId: data.domicileTenantId ?? null,
        updatedAt: new Date(),
      })
      .where(eq(members.id, memberId));

    revalidatePath(`/${slug}/members/${memberId}`);
    return { success: true };

  } catch (err) {
    console.error("[upsertMemberContactAction]", err);
    const msg = err instanceof Error ? err.message : "Gagal menyimpan.";
    return { success: false, error: `Gagal: ${msg}` };
  }
}

// ─── SAVE RIWAYAT PENDIDIKAN (Step 3 Wizard) ────────────────────────────────

export type EducationEntryData = {
  level: string;
  institutionName: string;
  major?: string;
  startYear?: number;
  endYear?: number;
  isGontor: boolean;
  gontorCampus?: string;
  pesantrenId?: string; // link ke direktori pesantren (opsional)
};

export type MemberPesantrenEntryData = {
  pesantrenId: string;
  peran: "alumni" | "pengasuh" | "pendiri" | "pengajar" | "pengurus" | "lainnya";
  posisi?: string;
  tahunMulai?: number;
  tahunSelesai?: number;
  catatan?: string;
};

export async function saveMemberEducationsAction(
  slug: string,
  memberId: string,
  entries: EducationEntryData[]
): Promise<{ success: boolean; error?: string }> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "anggota")) return { success: false as const, error: "Akses ditolak." };

  // Pastikan anggota milik tenant ini
  const [membership] = await db
    .select({ id: tenantMemberships.id })
    .from(tenantMemberships)
    .where(
      and(
        eq(tenantMemberships.tenantId, access.tenant.id),
        eq(tenantMemberships.memberId, memberId)
      )
    )
    .limit(1);
  if (!membership) return { success: false, error: "Anggota tidak ditemukan." };

  // Filter hanya entry yang punya nama institusi
  const validEntries = entries.filter((e) => e.institutionName.trim());

  try {
    // Hapus semua riwayat lama — replace full dengan data baru
    await db
      .delete(memberEducations)
      .where(eq(memberEducations.memberId, memberId));

    // Insert batch semua entry valid
    if (validEntries.length > 0) {
      await db.insert(memberEducations).values(
        validEntries.map((e) => ({
          memberId,
          // Cast ke union type yang diexpect Drizzle — DB akan reject jika nilai tidak valid
          level: e.level as "TK" | "SD" | "SMP" | "SMA" | "D3" | "S1" | "S2" | "S3" | "Non-Formal",
          institutionName: e.institutionName.trim(),
          major: e.major?.trim() || null,
          startYear: e.startYear ?? null,
          endYear: e.endYear ?? null,
          isGontor: e.isGontor,
          gontorCampus: e.isGontor ? (e.gontorCampus as "Gontor 1 (Putra)" | "Gontor 2 (Putra)" | "Gontor 3 (Putra)" | "Gontor 4 (Putra)" | "Gontor 5 (Putra)" | "Gontor 6 (Putra)" | "Gontor 7 (Putra)" | "Gontor 8 (Putra)" | "Gontor Putri 1" | "Gontor Putri 2" | "Gontor Putri 3" | "Gontor Putri 4" | "Gontor Putri 5" | "Gontor Putri 6" | null) ?? null : null,
          pesantrenId: e.pesantrenId ?? null,
        }))
      );
    }

    revalidatePath(`/${slug}/members/${memberId}`);
    return { success: true };

  } catch (err) {
    console.error("[saveMemberEducationsAction]", err);
    const msg = err instanceof Error ? err.message : "Gagal menyimpan.";
    return { success: false, error: `Gagal: ${msg}` };
  }
}

// ─── SAVE KETERLIBATAN DI PESANTREN (Step 3 Wizard) ─────────────────────────

export async function saveMemberPesantrenAction(
  slug: string,
  memberId: string,
  entries: MemberPesantrenEntryData[]
): Promise<{ success: boolean; error?: string }> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "anggota")) return { success: false, error: "Akses ditolak." };

  const [membership] = await db
    .select({ id: tenantMemberships.id })
    .from(tenantMemberships)
    .where(and(eq(tenantMemberships.tenantId, access.tenant.id), eq(tenantMemberships.memberId, memberId)))
    .limit(1);
  if (!membership) return { success: false, error: "Anggota tidak ditemukan." };

  const validEntries = entries.filter((e) => e.pesantrenId?.trim());

  try {
    // Replace-all: hapus lama → insert baru
    await db.delete(memberPesantren).where(eq(memberPesantren.memberId, memberId));

    if (validEntries.length > 0) {
      await db.insert(memberPesantren).values(
        validEntries.map((e) => ({
          memberId,
          pesantrenId: e.pesantrenId,
          peran: e.peran,
          posisi: e.posisi?.trim() || null,
          tahunMulai: e.tahunMulai ?? null,
          tahunSelesai: e.tahunSelesai ?? null,
          catatan: e.catatan?.trim() || null,
          isActive: e.tahunSelesai == null, // masih aktif jika tidak ada tahun selesai
        }))
      );
    }

    revalidatePath(`/${slug}/members/${memberId}`);
    return { success: true };

  } catch (err) {
    console.error("[saveMemberPesantrenAction]", err);
    const msg = err instanceof Error ? err.message : "Gagal menyimpan.";
    return { success: false, error: `Gagal: ${msg}` };
  }
}

// ─── SAVE DATA USAHA (Step 4 Wizard) ─────────────────────────────────────────

export type BusinessEntryData = {
  // Identitas
  name: string;
  brand?: string;
  description?: string;
  // Klasifikasi (category + sector wajib di DB)
  category: string;
  sector: string;
  legality?: string;
  position?: string;
  // Skala
  employees?: string;
  branches?: string;
  revenue?: string;
  // Alamat usaha — NULL/undefined = Indonesia, diisi = luar negeri (nama negara)
  addressCountry?: string;
  addressProvinceId?: number;
  addressRegencyId?: number;
  addressDistrictId?: number;
  addressVillageId?: number;
  addressDetail?: string;
  addressPostalCode?: string;
  // Kontak usaha
  phone?: string;
  whatsapp?: string;
  email?: string;
  // Sosial media usaha
  instagram?: string;
  facebook?: string;
  linkedin?: string;
  twitter?: string;
  youtube?: string;
  tiktok?: string;
  website?: string;
};

export async function saveMemberBusinessesAction(
  slug: string,
  memberId: string,
  entries: BusinessEntryData[]
): Promise<{ success: boolean; error?: string }> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "anggota")) return { success: false as const, error: "Akses ditolak." };

  // Pastikan anggota milik tenant ini
  const [membership] = await db
    .select({ id: tenantMemberships.id })
    .from(tenantMemberships)
    .where(
      and(
        eq(tenantMemberships.tenantId, access.tenant.id),
        eq(tenantMemberships.memberId, memberId)
      )
    )
    .limit(1);
  if (!membership) return { success: false, error: "Anggota tidak ditemukan." };

  // Hanya entry dengan name + category + sector yang valid
  const validEntries = entries.filter(
    (e) => e.name.trim() && e.category.trim() && e.sector.trim()
  );

  try {
    // Hapus semua usaha lama — replace penuh
    await db
      .delete(memberBusinesses)
      .where(eq(memberBusinesses.memberId, memberId));

    // Insert satu per satu karena tiap usaha perlu helper tables sendiri
    for (const entry of validEntries) {
      // ── Insert contact usaha ────────────────────────────────────────────────
      let businessContactId: string | null = null;
      if (entry.phone || entry.whatsapp || entry.email) {
        const [c] = await db
          .insert(contacts)
          .values({
            phone:    entry.phone?.trim()    || null,
            whatsapp: entry.whatsapp?.trim() || null,
            email:    entry.email?.trim()    || null,
          })
          .returning({ id: contacts.id });
        businessContactId = c.id;
      }

      // ── Insert address usaha ────────────────────────────────────────────────
      let businessAddressId: string | null = null;
      if (
        entry.addressCountry  ||
        entry.addressProvinceId || entry.addressRegencyId ||
        entry.addressDistrictId || entry.addressVillageId ||
        entry.addressDetail || entry.addressPostalCode
      ) {
        const isOverseas = !!entry.addressCountry;
        const [a] = await db
          .insert(addresses)
          .values({
            label:      "usaha",
            country:    entry.addressCountry?.trim()  || null,
            provinceId: isOverseas ? null : (entry.addressProvinceId ?? null),
            regencyId:  isOverseas ? null : (entry.addressRegencyId  ?? null),
            districtId: isOverseas ? null : (entry.addressDistrictId ?? null),
            villageId:  isOverseas ? null : (entry.addressVillageId  ?? null),
            detail:     entry.addressDetail?.trim()    || null,
            postalCode: entry.addressPostalCode?.trim() || null,
          })
          .returning({ id: addresses.id });
        businessAddressId = a.id;
      }

      // ── Insert social media usaha ───────────────────────────────────────────
      let businessSocialId: string | null = null;
      if (
        entry.instagram || entry.facebook || entry.linkedin ||
        entry.twitter   || entry.youtube  || entry.tiktok   || entry.website
      ) {
        const [s] = await db
          .insert(socialMedias)
          .values({
            instagram: entry.instagram?.trim() || null,
            facebook:  entry.facebook?.trim()  || null,
            linkedin:  entry.linkedin?.trim()  || null,
            twitter:   entry.twitter?.trim()   || null,
            youtube:   entry.youtube?.trim()   || null,
            tiktok:    entry.tiktok?.trim()    || null,
            website:   entry.website?.trim()   || null,
          })
          .returning({ id: socialMedias.id });
        businessSocialId = s.id;
      }

      // ── Insert member_business ──────────────────────────────────────────────
      await db.insert(memberBusinesses).values({
        memberId,
        name:        entry.name.trim(),
        brand:       entry.brand?.trim()       || null,
        description: entry.description?.trim() || null,
        category: entry.category as "Jasa" | "Produsen" | "Distributor" | "Trading" | "Profesional",
        sector:   entry.sector   as "Teknologi" | "Jasa Profesional" | "Kreatif" | "Manufaktur" | "Kesehatan & Pendidikan" | "Konsumsi & Ritel" | "Sumber Daya Alam",
        legality: (entry.legality  || null) as "PT Perseorangan" | "PT" | "CV" | "Yayasan" | "Perkumpulan" | "Koperasi" | "Belum Memiliki Legalitas" | null,
        position: (entry.position  || null) as "Komisaris" | "Direktur" | "Pengelola" | "Manajer" | null,
        employees:(entry.employees || null) as "1-4" | "5-10" | "11-20" | "Lebih dari 20" | null,
        branches: (entry.branches  || null) as "Tidak Ada" | "1-3" | "Diatas 3" | null,
        revenue:  (entry.revenue   || null) as "Dibawah 500jt" | "500jt-1M" | "1M-2M" | "Diatas 2M" | null,
        contactId:     businessContactId,
        addressId:     businessAddressId,
        socialMediaId: businessSocialId,
      });
    }

    revalidatePath(`/${slug}/members/${memberId}`);
    return { success: true };

  } catch (err) {
    console.error("[saveMemberBusinessesAction]", err);
    const msg = err instanceof Error ? err.message : "Gagal menyimpan.";
    return { success: false, error: `Gagal: ${msg}` };
  }
}

// ─── DELETE (hapus dari cabang, bukan dari global) ──────────────────────────

export async function removeMemberFromTenantAction(
  slug: string,
  memberId: string
): Promise<{ success: boolean; error?: string }> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "anggota")) return { success: false as const, error: "Akses ditolak." };

  try {
    await db
      .delete(tenantMemberships)
      .where(
        and(
          eq(tenantMemberships.tenantId, access.tenant.id),
          eq(tenantMemberships.memberId, memberId)
        )
      );

    revalidatePath(`/${slug}/members`);
    return { success: true };

  } catch (err) {
    console.error("[removeMemberFromTenantAction]", err);
    return { success: false, error: "Gagal menghapus." };
  }
}
