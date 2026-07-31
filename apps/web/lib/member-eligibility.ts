import {
  db, members, contacts, addresses, memberBusinesses, memberOwnedPesantren, memberProfessionals,
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
  // Kalau "directory" ada di `missing` DAN member sudah MULAI mengisi salah satu modul
  // (punya baris) tapi belum lengkap field wajibnya — modul itu yang ditunjuk di sini, supaya
  // UI bisa arahkan LANGSUNG ke sana ("Lengkapi Data Usaha Anda") alih-alih menyuruh pilih
  // ulang dari 3 opsi. `null` kalau member belum mulai isi modul mana pun sama sekali (tetap
  // pakai popup "pilih salah satu" seperti sebelumnya).
  directoryIncompleteModule: EkosistemModule | null;
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
      directoryIncompleteModule: null,
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
  // (lihat docs/arsitektur-ekosistem.md § toggle per-tenant). Per modul, "punya data" TIDAK
  // CUKUP — harus punya SATU baris yang field WAJIBnya (persis validasi self-service
  // usaha-client.tsx/pesantren-client.tsx/profesional-client.tsx, field opsional diabaikan)
  // sudah semua terisi. "Punya baris tapi belum lengkap" (mis. hasil import massal) TETAP
  // dianggap belum eligible — supaya orang tidak berhenti mengisi begitu punya 1 baris.
  const moduleChecks: Partial<Record<EkosistemModule, ModuleCheck>> = {};
  if (enabledDirectoryModules.includes("usaha"))       moduleChecks.usaha       = await checkUsahaComplete(memberId);
  if (enabledDirectoryModules.includes("pesantren"))   moduleChecks.pesantren   = await checkPesantrenComplete(memberId);
  if (enabledDirectoryModules.includes("profesional")) moduleChecks.profesional = await checkProfesionalComplete(memberId);

  // Kalau tidak ada modul aktif sama sekali (edge case: tenant matikan ketiganya), syarat ini
  // tidak mungkin dipenuhi siapa pun — skip total (jangan pernah blokir karena ini).
  const hasDirectory = enabledDirectoryModules.length === 0
    ? true
    : enabledDirectoryModules.some((m) => moduleChecks[m]?.hasComplete);

  let directoryIncompleteModule: EkosistemModule | null = null;
  if (!hasDirectory) {
    missing.push("directory");
    // Modul yang SUDAH dimulai (ada baris) tapi belum lengkap — arahkan langsung ke situ,
    // bukan minta pilih ulang dari 3 opsi (mereka sudah memilih). Prioritas sama seperti
    // DIRECTORY_HREF_PRIORITY di bawah, arbitrer tapi konsisten.
    directoryIncompleteModule = DIRECTORY_HREF_PRIORITY.find(
      (m) => enabledDirectoryModules.includes(m) && moduleChecks[m]?.hasAny,
    ) ?? null;
  }

  return { eligible: missing.length === 0, missing, directoryIncompleteModule };
}

type ModuleCheck = { hasAny: boolean; hasComplete: boolean };

// Field wajib PERSIS sama dengan validasi client-side `/akun/usaha` (usaha-client.tsx
// `saveEditing()`) — field opsional (brand, offeredTags/neededTags, socmed, dll) sengaja
// TIDAK dicek. `addresses.country` non-null = alamat luar negeri (lihat addresses.ts),
// districtId non-null = alamat domestik minimal sampai kecamatan — salah satu cukup.
async function checkUsahaComplete(memberId: string): Promise<ModuleCheck> {
  const rows = await db
    .select({
      name: memberBusinesses.name, category: memberBusinesses.category,
      sector: memberBusinesses.sector, logoUrl: memberBusinesses.logoUrl,
      coverUrl: memberBusinesses.coverUrl, description: memberBusinesses.description,
      legality: memberBusinesses.legality, position: memberBusinesses.position,
      businessFields: memberBusinesses.businessFields, employees: memberBusinesses.employees,
      branches: memberBusinesses.branches, revenue: memberBusinesses.revenue,
      addressDistrictId: addresses.districtId, addressCountry: addresses.country,
      contactWhatsapp: contacts.whatsapp,
    })
    .from(memberBusinesses)
    .leftJoin(addresses, eq(addresses.id, memberBusinesses.addressId))
    .leftJoin(contacts, eq(contacts.id, memberBusinesses.contactId))
    .where(eq(memberBusinesses.memberId, memberId));

  return {
    hasAny: rows.length > 0,
    hasComplete: rows.some((r) => !!(
      r.name && r.category && r.sector && r.logoUrl && r.coverUrl && r.description &&
      r.legality && r.position && r.businessFields && r.businessFields.length > 0 &&
      r.employees && r.branches && r.revenue &&
      (r.addressDistrictId != null || r.addressCountry) &&
      r.contactWhatsapp
    )),
  };
}

// Field wajib PERSIS sama dengan `/akun/pesantren` (pesantren-client.tsx `saveEditing()`) —
// alamat SENGAJA tidak dicek (form menandainya `optional` secara eksplisit).
async function checkPesantrenComplete(memberId: string): Promise<ModuleCheck> {
  const rows = await db
    .select({
      name: memberOwnedPesantren.name, tahunBerdiri: memberOwnedPesantren.tahunBerdiri,
      luasArea: memberOwnedPesantren.luasArea, namaPimpinan: memberOwnedPesantren.namaPimpinan,
      kurikulum: memberOwnedPesantren.kurikulum, jenisPondok: memberOwnedPesantren.jenisPondok,
      modelPendidikan: memberOwnedPesantren.modelPendidikan,
      kategoriSantri: memberOwnedPesantren.kategoriSantri,
      contactPhone: contacts.phone, contactWhatsapp: contacts.whatsapp,
    })
    .from(memberOwnedPesantren)
    .leftJoin(contacts, eq(contacts.id, memberOwnedPesantren.contactId))
    .where(eq(memberOwnedPesantren.memberId, memberId));

  return {
    hasAny: rows.length > 0,
    hasComplete: rows.some((r) => !!(
      r.name && r.tahunBerdiri && r.luasArea && r.namaPimpinan &&
      r.kurikulum && r.jenisPondok && r.modelPendidikan && r.kategoriSantri &&
      r.contactPhone && r.contactWhatsapp
    )),
  };
}

// Field wajib PERSIS sama dengan `/akun/profesional` (profesional-client.tsx `saveEditing()`).
// professionCategory/professionType sudah NOT NULL di DB (selalu terisi) — tetap dicek untuk
// konsistensi/defensif.
async function checkProfesionalComplete(memberId: string): Promise<ModuleCheck> {
  const rows = await db
    .select({
      professionCategory: memberProfessionals.professionCategory,
      professionType: memberProfessionals.professionType,
      description: memberProfessionals.description, startYear: memberProfessionals.startYear,
      addressDistrictId: addresses.districtId, addressCountry: addresses.country,
      contactWhatsapp: contacts.whatsapp,
    })
    .from(memberProfessionals)
    .leftJoin(addresses, eq(addresses.id, memberProfessionals.addressId))
    .leftJoin(contacts, eq(contacts.id, memberProfessionals.contactId))
    .where(eq(memberProfessionals.memberId, memberId));

  return {
    hasAny: rows.length > 0,
    hasComplete: rows.some((r) => !!(
      r.professionCategory && r.professionType && r.description && r.startYear &&
      (r.addressDistrictId != null || r.addressCountry) &&
      r.contactWhatsapp
    )),
  };
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
// `directoryIncompleteModule` (dari MemberEligibilityResult) — kalau member sudah mulai isi
// SATU modul tapi belum lengkap, arahkan LANGSUNG ke situ, bukan ke modul prioritas pertama
// yang belum tentu relevan (mis. mereka sudah mulai Profesional, jangan malah disuruh mulai
// Usaha dari nol).
export function memberEligibilityFixHref(
  field: MemberEligibilityField,
  baseUrl: string,
  enabledModules: EkosistemModule[] = ALL_EKOSISTEM_MODULES,
  directoryIncompleteModule?: EkosistemModule | null,
): string {
  if (field === "directory") {
    const target = directoryIncompleteModule
      ?? DIRECTORY_HREF_PRIORITY.find((m) => enabledModules.includes(m))
      ?? "usaha";
    return `${baseUrl}/akun/${target}`;
  }
  return `${baseUrl}/akun/lengkapi`;
}
