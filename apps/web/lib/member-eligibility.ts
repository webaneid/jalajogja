import {
  db, members, contacts, memberBusinesses, memberOwnedPesantren, memberProfessionals,
} from "@jalajogja/db";
import { eq } from "drizzle-orm";

// Field yang dicek — nama sesuai kolom DB sebenarnya, sudah diverifikasi langsung ke
// packages/db/src/schema/public/members.ts + contacts.ts (2026-07-23), bukan dari ingatan.
// Awalnya dibangun khusus untuk syarat kelayakan bergabung tenant forum (lihat
// docs/arsitektur-backbone-ikpm.md § "Alur Pendaftaran Forum v2 — 1. Syarat Kelayakan"),
// SEKARANG generik — dipakai sebagai standar kelengkapan data minimal untuk SEMUA tipe
// tenant (cabang/marhalah/forum), lihat docs/arsitektur-akun.md § "Standar Label
// Keanggotaan" dan § "Eligibility Overlay Generik".
export type MemberEligibilityField =
  | "gender" | "birthDate" | "graduationYear" | "graduationPeriod" | "professionId"
  | "waliSantri" | "primaryCabangRefId" | "domicileStatus"
  | "phone" | "whatsapp" | "email" | "directory";

export type MemberEligibilityResult = {
  eligible: boolean;
  missing:  MemberEligibilityField[];
};

/**
 * Standar kelengkapan data minimal anggota — dicek ULANG setiap kali langsung ke kolom DB,
 * bukan dari flag tersimpan, supaya data yang diedit balik jadi tidak lengkap otomatis
 * kehilangan status "eligible". Dipakai BERSAMA oleh overlay `/akun` (semua tipe tenant),
 * `resolveAkunBranding()`, dan halaman `/gabung` (forum) supaya logic tidak ditulis berkali-
 * kali dan berisiko drift (satu helper, satu tempat).
 */
export async function checkMemberEligibility(memberId: string): Promise<MemberEligibilityResult> {
  const [memberRow] = await db
    .select({
      gender:             members.gender,
      birthDate:          members.birthDate,
      graduationYear:     members.graduationYear,
      graduationPeriod:   members.graduationPeriod,
      professionId:       members.professionId,
      waliSantri:         members.waliSantri,
      primaryCabangRefId: members.primaryCabangRefId,
      domicileStatus:     members.domicileStatus,
      contactId:          members.contactId,
    })
    .from(members)
    .where(eq(members.id, memberId))
    .limit(1);

  if (!memberRow) {
    return {
      eligible: false,
      missing: [
        "gender", "birthDate", "graduationYear", "professionId", "waliSantri",
        "primaryCabangRefId", "domicileStatus", "phone", "whatsapp", "email", "directory",
      ],
    };
  }

  const missing: MemberEligibilityField[] = [];
  if (!memberRow.gender)             missing.push("gender");
  if (!memberRow.birthDate)          missing.push("birthDate");
  if (!memberRow.graduationYear)     missing.push("graduationYear");
  if (memberRow.graduationYear === 1999 && !memberRow.graduationPeriod) missing.push("graduationPeriod");
  if (!memberRow.professionId)       missing.push("professionId");
  if (!memberRow.waliSantri)         missing.push("waliSantri");
  if (!memberRow.primaryCabangRefId) missing.push("primaryCabangRefId");
  if (!memberRow.domicileStatus)     missing.push("domicileStatus");

  let contactRow: { phone: string | null; whatsapp: string | null; email: string | null } | undefined;
  if (memberRow.contactId) {
    [contactRow] = await db
      .select({ phone: contacts.phone, whatsapp: contacts.whatsapp, email: contacts.email })
      .from(contacts)
      .where(eq(contacts.id, memberRow.contactId))
      .limit(1);
  }
  if (!contactRow?.phone)    missing.push("phone");
  if (!contactRow?.whatsapp) missing.push("whatsapp");
  if (!contactRow?.email)    missing.push("email");

  const [businessRow, pesantrenRow, professionalRow] = await Promise.all([
    db.select({ id: memberBusinesses.id }).from(memberBusinesses)
      .where(eq(memberBusinesses.memberId, memberId)).limit(1),
    db.select({ id: memberOwnedPesantren.id }).from(memberOwnedPesantren)
      .where(eq(memberOwnedPesantren.memberId, memberId)).limit(1),
    db.select({ id: memberProfessionals.id }).from(memberProfessionals)
      .where(eq(memberProfessionals.memberId, memberId)).limit(1),
  ]);
  const hasDirectory = businessRow.length > 0 || pesantrenRow.length > 0 || professionalRow.length > 0;
  if (!hasDirectory) missing.push("directory");

  return { eligible: missing.length === 0, missing };
}

// Label Bahasa Indonesia per field — dipakai UI (overlay + halaman /gabung) untuk
// menjelaskan spesifik apa yang kurang, bukan pesan generik.
export const MEMBER_ELIGIBILITY_LABELS: Record<MemberEligibilityField, string> = {
  gender:             "Jenis Kelamin",
  birthDate:          "Tanggal Lahir",
  graduationYear:     "Tahun Lulus KMI",
  graduationPeriod:   "Periode Angkatan 1999 (Awal/Akhir)",
  professionId:       "Profesi",
  waliSantri:         "Wali Santri",
  primaryCabangRefId: "PC IKPM Cabang",
  domicileStatus:     "Status Domisili",
  phone:              "Nomor HP",
  whatsapp:           "Nomor WhatsApp",
  email:              "Email",
  directory:          "Data Usaha / Pesantren / Profesional (minimal salah satu)",
};

// Field di atas dikelompokkan ke tautan mana yang harus dituju untuk melengkapinya —
// semuanya diselesaikan di /akun/lengkapi KECUALI "directory" yang punya 3 halaman terpisah.
export function memberEligibilityFixHref(field: MemberEligibilityField, baseUrl: string): string {
  if (field === "directory") return `${baseUrl}/akun/usaha`;
  return `${baseUrl}/akun/lengkapi`;
}
