import {
  db, members, contacts, memberBusinesses, memberOwnedPesantren, memberProfessionals,
} from "@jalajogja/db";
import { eq } from "drizzle-orm";
import { ALL_EKOSISTEM_MODULES, type EkosistemModule } from "./ekosistem-modules";

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
 *
 * `enabledDirectoryModules` — modul Usaha/Pesantren/Profesional yang AKTIF untuk tenant yang
 * sedang diproses (lihat lib/ekosistem-modules.ts). Default = ketiganya (perilaku lama,
 * backward-compatible) kalau caller tidak mengirim param ini. Syarat "directory" jadi OR
 * HANYA terhadap modul yang aktif — kalau tenant cuma aktifkan 1 modul, member wajib isi
 * modul itu SPESIFIK (data di modul lain yang sudah dimatikan tenant ini tidak dihitung).
 * Kalau SEMUA modul dimatikan (edge case), syarat ini di-skip total (tidak mungkin dipenuhi).
 */
export async function checkMemberEligibility(
  memberId: string,
  enabledDirectoryModules: EkosistemModule[] = ALL_EKOSISTEM_MODULES,
): Promise<MemberEligibilityResult> {
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

  // Cek HANYA modul yang aktif untuk tenant ini — modul yang dimatikan tidak ikut menghitung
  // (lihat docs/arsitektur-ekosistem.md § toggle per-tenant).
  const directoryChecks: Promise<{ id: string }[]>[] = [];
  if (enabledDirectoryModules.includes("usaha")) {
    directoryChecks.push(
      db.select({ id: memberBusinesses.id }).from(memberBusinesses)
        .where(eq(memberBusinesses.memberId, memberId)).limit(1),
    );
  }
  if (enabledDirectoryModules.includes("pesantren")) {
    directoryChecks.push(
      db.select({ id: memberOwnedPesantren.id }).from(memberOwnedPesantren)
        .where(eq(memberOwnedPesantren.memberId, memberId)).limit(1),
    );
  }
  if (enabledDirectoryModules.includes("profesional")) {
    directoryChecks.push(
      db.select({ id: memberProfessionals.id }).from(memberProfessionals)
        .where(eq(memberProfessionals.memberId, memberId)).limit(1),
    );
  }
  // Kalau tidak ada modul aktif sama sekali (edge case: tenant matikan ketiganya), syarat ini
  // tidak mungkin dipenuhi siapa pun — skip total (jangan pernah blokir karena ini).
  const hasDirectory = directoryChecks.length === 0
    ? true
    : (await Promise.all(directoryChecks)).some((rows) => rows.length > 0);
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

// Urutan prioritas modul yang ditawarkan duluan kalau lebih dari satu modul aktif untuk
// field "directory" — pilihan arbitrer tapi konsisten, bukan berarti lebih penting.
const DIRECTORY_HREF_PRIORITY: EkosistemModule[] = ["usaha", "profesional", "pesantren"];

// Field di atas dikelompokkan ke tautan mana yang harus dituju untuk melengkapinya —
// semuanya diselesaikan di /akun/lengkapi KECUALI "directory" yang punya 3 halaman terpisah.
// `enabledModules` — modul aktif tenant ini (default ketiganya, sama seperti checkMemberEligibility).
export function memberEligibilityFixHref(
  field: MemberEligibilityField,
  baseUrl: string,
  enabledModules: EkosistemModule[] = ALL_EKOSISTEM_MODULES,
): string {
  if (field === "directory") {
    const target = DIRECTORY_HREF_PRIORITY.find((m) => enabledModules.includes(m)) ?? "usaha";
    return `${baseUrl}/akun/${target}`;
  }
  return `${baseUrl}/akun/lengkapi`;
}
