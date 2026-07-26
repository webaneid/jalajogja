import "server-only";
import * as XLSX from "xlsx";
import { and, eq, ilike, or } from "drizzle-orm";
import {
  db, members, contacts, refProvinces, refRegencies, refDistricts, refVillages, refProfessions, refIkpmCabang,
  tenantMemberships,
} from "@jalajogja/db";
import { normalizePhone } from "@/lib/phone";
import {
  mapGender, parseGraduationYear, mapGraduationPeriod, parseBirthDate, mapWaliSantri,
  mapDomicileStatus, normalizeProvinceName, normalizeCountry, isValidEmail, detectPhoneCellIssue,
  mapCategory, mapSector, mapLegality, mapPosition, mapEmployees, mapBranches, mapRevenue,
  splitBusinessFields, fillEmpty, MERGEABLE_FIELD_LABELS, type ImportRowPreview,
} from "@/lib/import-anggota-mapping";

// 44 kolom template resmi (docs/arsitektur-import-anggota.md § 2/§ 11/§ 14) — nama kolom +
// nilai PERSIS sama dengan skema kita sendiri, bukan mengikuti database eksternal mana pun.
// Header dicocokkan by-name (trim+lowercase) — bukan posisi — supaya lebih toleran kalau
// admin menggeser urutan kolom saat isi ulang template.
//
// Kolom identitas/eligibility (birthDate, waliSantri, domicileStatus, professionId,
// graduationPeriod, stambukNumber, nik, birthPlaceText, village, kode pos) ditambahkan
// 2026-07-25 setelah audit ULANG dari nol terhadap packages/db/src/schema/public/{members,
// addresses}.ts — bukan dari file Excel contoh mana pun. "Forbis ID" (nama internal satu
// forum) diganti "Nomor Keanggotaan" (generik, § 14).
const TEMPLATE_HEADERS = [
  "nomor keanggotaan", "nama", "nik", "jenis kelamin", "tanggal lahir", "tempat lahir",
  "alumni", "periode angkatan 1999", "no stambuk gontor", "profesi", "pc ikpm cabang", "wali santri", "status domisili",
  "no hp", "no whatsapp", "email",
  "alamat", "desa/kelurahan", "kecamatan", "kabupaten/kota", "provinsi", "kode pos", "negara",
  "nama usaha", "deskripsi usaha", "kategori usaha", "sektor", "bidang usaha", "produk", "merk / brand produk",
  "badan hukum", "posisi", "jumlah karyawan", "jumlah cabang", "omzet pertahun",
  "alamat usaha", "kabupaten", "provinsi", "negara",
  "url facebook", "id instagram", "url tiktok", "website", "telepon usaha", "whatsapp usaha",
] as const;

// Field ke-2 "Provinsi" dan "Negara" (kolom usaha) duplikat nama header dengan kolom
// pribadi — dibedakan pakai index posisi setelah header pertama ditemukan, bukan nama unik.
//
// Hanya "nama" yang benar-benar wajib ADA sebagai kolom (baris tanpa nama tidak bisa
// diproses sama sekali — lihat buildPreviewRow). Kolom lain semuanya boleh kosong per baris
// ("jika kosong, kosongkan" — prinsip dikunci user 2026-07-24) — jadi tidak perlu masuk
// REQUIRED_HEADERS, itu cuma pengecekan "file yang benar", bukan pengecekan kelengkapan data.
const REQUIRED_HEADERS = ["nama"] as const;

export type RawImportRow = Record<(typeof TEMPLATE_HEADERS)[number] | string, string> & {
  __provinsiUsaha: string;
  __negaraUsaha: string;
};

/** Parse buffer xlsx jadi baris mentah (string per sel), skip baris yang kosong total. */
export function parseXlsxBuffer(buffer: ArrayBuffer): { headerError: string | null; rows: RawImportRow[] } {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return { headerError: "File tidak punya sheet sama sekali.", rows: [] };

  const grid = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: "", raw: false });
  if (grid.length === 0) return { headerError: "File kosong.", rows: [] };

  const headerRow = (grid[0] as string[]).map((h) => String(h ?? "").trim().toLowerCase());
  for (const req of REQUIRED_HEADERS) {
    if (!headerRow.includes(req)) {
      return { headerError: `Kolom "${req}" tidak ditemukan — pastikan pakai template resmi (unduh ulang kalau perlu).`, rows: [] };
    }
  }

  // Kolom "Provinsi"/"Negara" muncul 2x (pribadi + usaha) — cari index KEDUA secara eksplisit.
  const firstProvIdx  = headerRow.indexOf("provinsi");
  const secondProvIdx = headerRow.indexOf("provinsi", firstProvIdx + 1);
  const firstNegIdx   = headerRow.indexOf("negara");
  const secondNegIdx  = headerRow.indexOf("negara", firstNegIdx + 1);

  const colIdx: Record<string, number> = {};
  headerRow.forEach((h, i) => { if (colIdx[h] === undefined) colIdx[h] = i; });

  const rows: RawImportRow[] = [];
  for (let r = 1; r < grid.length; r++) {
    const raw = (grid[r] as string[]) ?? [];
    const isBlank = raw.every((c) => String(c ?? "").trim() === "");
    if (isBlank) continue; // skip baris placeholder kosong

    const obj = {} as RawImportRow;
    for (const h of TEMPLATE_HEADERS) {
      const idx = colIdx[h];
      obj[h] = idx !== undefined ? String(raw[idx] ?? "").trim() : "";
    }
    obj.__provinsiUsaha = secondProvIdx >= 0 ? String(raw[secondProvIdx] ?? "").trim() : "";
    obj.__negaraUsaha   = secondNegIdx  >= 0 ? String(raw[secondNegIdx]  ?? "").trim() : "";
    rows.push(obj);
  }

  return { headerError: null, rows };
}

// ── Matching wilayah — top-down: provinsi dulu, baru kabupaten/kecamatan/desa di-scope ──
export type WilayahMatch = {
  provinceId: number | null;
  regencyId:  number | null;
  districtId: number | null;
  villageId:  number | null;
  villagePostalCode: string | null; // dari ref_villages.postal_code — fallback kalau kolom "Kode Pos" kosong
  flagged:    boolean; // true kalau ada bagian yang diisi di Excel tapi gagal di-match
};

export async function matchWilayah(
  provinsiRaw: string, kabupatenRaw: string, kecamatanRaw: string, desaRaw = "",
): Promise<WilayahMatch> {
  const provName = normalizeProvinceName(provinsiRaw);
  if (!provName) return { provinceId: null, regencyId: null, districtId: null, villageId: null, villagePostalCode: null, flagged: false };

  const [prov] = await db.select({ id: refProvinces.id })
    .from(refProvinces)
    .where(ilike(refProvinces.name, provName))
    .limit(1);
  if (!prov) return { provinceId: null, regencyId: null, districtId: null, villageId: null, villagePostalCode: null, flagged: true };

  let regencyId: number | null = null;
  if (kabupatenRaw.trim()) {
    // Coba beberapa varian nama: apa adanya, dengan prefix "Kota ", dengan prefix "Kabupaten "
    const bare = kabupatenRaw.trim().replace(/^kota\s+/i, "").replace(/^kabupaten\s+/i, "");
    const [reg] = await db.select({ id: refRegencies.id })
      .from(refRegencies)
      .where(and(
        eq(refRegencies.provinceId, prov.id),
        or(
          ilike(refRegencies.name, kabupatenRaw.trim()),
          ilike(refRegencies.name, `Kota ${bare}`),
          ilike(refRegencies.name, `Kabupaten ${bare}`),
          ilike(refRegencies.name, bare),
        ),
      ))
      .limit(1);
    regencyId = reg?.id ?? null;
  }

  let districtId: number | null = null;
  if (regencyId && kecamatanRaw.trim()) {
    const [dist] = await db.select({ id: refDistricts.id })
      .from(refDistricts)
      .where(and(eq(refDistricts.regencyId, regencyId), ilike(refDistricts.name, kecamatanRaw.trim())))
      .limit(1);
    districtId = dist?.id ?? null;
  }

  let villageId: number | null = null;
  let villagePostalCode: string | null = null;
  if (districtId && desaRaw.trim()) {
    const bare = desaRaw.trim().replace(/^desa\s+/i, "").replace(/^kelurahan\s+/i, "");
    const [vil] = await db.select({ id: refVillages.id, postalCode: refVillages.postalCode })
      .from(refVillages)
      .where(and(
        eq(refVillages.districtId, districtId),
        or(ilike(refVillages.name, desaRaw.trim()), ilike(refVillages.name, bare)),
      ))
      .limit(1);
    villageId = vil?.id ?? null;
    villagePostalCode = vil?.postalCode ?? null;
  }

  const flagged =
    (!!kabupatenRaw.trim() && !regencyId) ||
    (!!kecamatanRaw.trim() && !districtId) || // termasuk kasus kabupaten sendiri gagal match
    (!!desaRaw.trim() && !villageId);

  return { provinceId: prov.id, regencyId, districtId, villageId, villagePostalCode, flagged };
}

// ── Matching profesi — ILIKE exact (case-insensitive) terhadap public.ref_professions.name ──
// Sama prinsipnya dengan mapCategory/mapSector: exact-match-or-null, tidak menebak sinonim.
export async function matchProfession(raw: string): Promise<number | null> {
  const v = raw.trim();
  if (!v) return null;
  const [row] = await db.select({ id: refProfessions.id })
    .from(refProfessions)
    .where(ilike(refProfessions.name, v))
    .limit(1);
  return row?.id ?? null;
}

// ── Matching PC IKPM Cabang — ILIKE exact terhadap nama/kode public.ref_ikpm_cabang ──
export async function matchCabang(raw: string): Promise<string | null> {
  const v = raw.trim();
  if (!v) return null;
  const [row] = await db.select({ id: refIkpmCabang.id })
    .from(refIkpmCabang)
    .where(or(
      ilike(refIkpmCabang.nama, v),
      ilike(refIkpmCabang.kode, v),
    ))
    .limit(1);
  return row?.id ?? null;
}

// ── Deteksi member yang sudah ada — JOIN yang benar (bukan contacts.findFirst) ─────────
// Lihat lesson CLAUDE.md "Bug Sesungguhnya: lookup-member Ambil Contact Sembarang" — nomor
// HP/email bisa dipakai di banyak baris contacts (usaha/pesantren/profesional) yang TIDAK
// terhubung members. INNER JOIN dari sisi members memastikan hanya contact milik member
// yang bisa match.
export async function findExistingMemberByContact(
  phone: string | null, whatsapp: string | null, email: string | null,
): Promise<{ id: string; fullName: string } | null> {
  if (!phone && !whatsapp && !email) return null;

  const conditions = [];
  if (phone)    conditions.push(eq(contacts.phone, phone));
  if (whatsapp) conditions.push(eq(contacts.whatsapp, whatsapp));
  if (email)    conditions.push(eq(contacts.email, email));

  const [row] = await db
    .select({ id: members.id, fullName: members.name })
    .from(members)
    .innerJoin(contacts, eq(contacts.id, members.contactId))
    .where(or(...conditions))
    .limit(1);

  return row ?? null;
}

// ── Kandidat lengkapi data — dipakai KEDUANYA oleh preview (informasional, tampilkan apa
// yang AKAN dilengkapi) DAN commit (menulis beneran, dipanggil ULANG di titik commit — bukan
// percaya hasil preview yang bisa saja sudah agak basi kalau draft sempat didiamkan lama).
// Field yang di database SUDAH terisi TIDAK PERNAH ditimpa — `fillEmpty()` cuma isi yang
// kosong. Mencakup `tenant_memberships.membershipNumber` (bukan cuma members/contacts) —
// skenario nyata: anggota forum yang sudah terdaftar di tenant ini tapi nomornya masih
// kosong (mis. admin baru atur format penomoran belakangan) HARUS tetap bisa dilengkapi dari
// data import, bukan di-skip total selamanya. Lihat docs/arsitektur-import-anggota.md § 16.
// Field bertipe `T | null` (bukan cuma `T`) karena dipakai untuk DUA hal: (1) nilai hasil
// parsing baris Excel (bisa null kalau kosong/tidak dikenali), dan (2) snapshot kolom DB saat
// ini (juga nullable, semua kolom ini memang nullable di schema). `fillEmpty()` sendiri yang
// menjamin null tidak pernah masuk ke patch hasil akhir.
export type MemberFieldPatch = Partial<{
  gender: "male" | "female" | null; graduationYear: number | null; graduationPeriod: "awal" | "akhir" | null;
  birthDate: string | null; birthPlaceText: string | null; stambukNumber: string | null; nik: string | null;
  waliSantri: "gontor" | "alumni" | "lain" | "bukan" | null; domicileStatus: "permanent" | "temporary" | null;
  professionId: number | null; primaryCabangRefId: string | null;
}>;
export type ContactFieldPatch = Partial<{ phone: string | null; whatsapp: string | null; email: string | null }>;

export type MemberMergeCandidate = {
  memberPatch: MemberFieldPatch;
  contactId: string | null;
  contactPatch: ContactFieldPatch;
  membershipNumberPatch: string | null; // non-null = akan di-set ke tenant_membership yang sudah ada
  existingTenantMembershipId: string | null; // null = belum jadi anggota tenant ini
  fieldLabels: string[]; // label Indonesia gabungan, untuk preview/notes
};

export async function computeMemberMergeCandidate(
  memberId: string, tenantId: string, isForumTenant: boolean,
  incomingMember: MemberFieldPatch, incomingContact: ContactFieldPatch,
  incomingMembershipNumber: string | null,
): Promise<MemberMergeCandidate> {
  const [memberRow] = await db.select({
    gender: members.gender, graduationYear: members.graduationYear,
    graduationPeriod: members.graduationPeriod, birthDate: members.birthDate,
    birthPlaceText: members.birthPlaceText, stambukNumber: members.stambukNumber,
    nik: members.nik, waliSantri: members.waliSantri, domicileStatus: members.domicileStatus,
    professionId: members.professionId, primaryCabangRefId: members.primaryCabangRefId,
    contactId: members.contactId,
  }).from(members).where(eq(members.id, memberId)).limit(1);

  const memberPatch = memberRow ? fillEmpty(memberRow, incomingMember) : {};

  let contactPatch: ContactFieldPatch = {};
  const contactId = memberRow?.contactId ?? null;
  if (contactId) {
    const [contactRow] = await db.select({
      phone: contacts.phone, whatsapp: contacts.whatsapp, email: contacts.email,
    }).from(contacts).where(eq(contacts.id, contactId)).limit(1);
    if (contactRow) contactPatch = fillEmpty(contactRow, incomingContact);
  }

  const [tmRow] = await db.select({
    id: tenantMemberships.id, membershipNumber: tenantMemberships.membershipNumber,
  }).from(tenantMemberships)
    .where(and(eq(tenantMemberships.memberId, memberId), eq(tenantMemberships.tenantId, tenantId)))
    .limit(1);

  let membershipNumberPatch: string | null = null;
  if (tmRow && isForumTenant && !tmRow.membershipNumber && incomingMembershipNumber) {
    membershipNumberPatch = incomingMembershipNumber;
  }

  const fieldLabels = [
    ...Object.keys(memberPatch), ...Object.keys(contactPatch),
    ...(membershipNumberPatch ? ["membershipNumber"] : []),
  ].map((k) => MERGEABLE_FIELD_LABELS[k] ?? k);

  return {
    memberPatch, contactId, contactPatch, membershipNumberPatch,
    existingTenantMembershipId: tmRow?.id ?? null,
    fieldLabels,
  };
}

// Map kontak (phone/whatsapp/email ternormalisasi) → nomor baris pertama yang memakainya
// DALAM FILE YANG SAMA — dipakai buildPreviewRow untuk deteksi duplikat ANTAR-BARIS di satu
// file (beda dari findExistingMemberByContact yang cek terhadap member yang SUDAH ADA di DB).
// Tanpa ini, dua baris dalam satu file dengan nomor HP sama tapi belum ada di DB akan
// sama-sama lolos sebagai "member baru" dan dibuat sebagai DUA member terpisah dengan kontak
// yang sama persis.
export type SeenContactsMap = Map<string, number>;

export async function buildPreviewRow(
  raw: RawImportRow, rowNumber: number, tenantId: string, isForumTenant: boolean,
  seenContacts: SeenContactsMap,
): Promise<ImportRowPreview> {
  const notes: string[] = [];
  let status: ImportRowPreview["status"] = "ready";

  const fullName = raw["nama"]?.trim();
  if (!fullName) {
    return {
      rowNumber, status: "error", notes: ["Nama kosong — baris tidak bisa diproses"],
      mergeFields: [],
      existingMemberId: null, linkOnly: false,
      member: {
        fullName: "", gender: null, graduationYear: null, graduationPeriod: null,
        birthDate: null, birthPlaceText: null, stambukNumber: null, nik: null,
        waliSantri: null, domicileStatus: null, professionId: null, primaryCabangRefId: null,
      },
      contact: { phone: null, whatsapp: null, email: null },
      address: {
        detail: null, provinceId: null, regencyId: null, districtId: null,
        villageId: null, postalCode: null, country: null,
      },
      membershipNumber: null, business: null,
    };
  }

  // ── Identitas ── (catatan informasional saja — tidak pernah mengubah status baris,
  // konsisten dengan prinsip "field boleh kosong, dilengkapi sendiri nanti via login")
  const genderRaw = (raw["jenis kelamin"] ?? "").trim();
  const gender = mapGender(genderRaw);
  if (genderRaw && !gender) notes.push(`Jenis Kelamin tidak dikenali: "${genderRaw}"`);
  const graduationYear = parseGraduationYear(raw["alumni"] ?? "");
  if ((raw["alumni"] ?? "").trim() && graduationYear === null) notes.push(`Tahun lulus tidak valid: "${raw["alumni"]}"`);

  const graduationPeriodRaw = (raw["periode angkatan 1999"] ?? "").trim();
  const graduationPeriod = mapGraduationPeriod(graduationPeriodRaw);
  if (graduationYear === 1999 && graduationPeriodRaw && !graduationPeriod) {
    notes.push(`Periode Angkatan 1999 tidak dikenali: "${graduationPeriodRaw}" (isi "Awal" atau "Akhir")`);
  }

  const birthDateRaw = (raw["tanggal lahir"] ?? "").trim();
  const birthDate = parseBirthDate(birthDateRaw);
  if (birthDateRaw && !birthDate) notes.push(`Tanggal Lahir tidak dikenali formatnya: "${birthDateRaw}" (pakai YYYY-MM-DD atau DD/MM/YYYY)`);

  const birthPlaceText = raw["tempat lahir"]?.trim() || null;
  const stambukNumber  = raw["no stambuk gontor"]?.trim() || null;
  const nik            = raw["nik"]?.trim() || null;

  const waliSantriRaw = (raw["wali santri"] ?? "").trim();
  const waliSantri = mapWaliSantri(waliSantriRaw);
  if (waliSantriRaw && !waliSantri) notes.push(`Wali Santri tidak dikenali: "${waliSantriRaw}"`);

  const domicileStatusRaw = (raw["status domisili"] ?? "").trim();
  const domicileStatus = mapDomicileStatus(domicileStatusRaw);
  if (domicileStatusRaw && !domicileStatus) notes.push(`Status Domisili tidak dikenali: "${domicileStatusRaw}"`);

  const professionRaw = (raw["profesi"] ?? "").trim();
  const professionId = professionRaw ? await matchProfession(professionRaw) : null;
  if (professionRaw && !professionId) notes.push(`Profesi tidak dikenali (harus persis salah satu daftar baku): "${professionRaw}"`);

  const pcCabangRaw = (raw["pc ikpm cabang"] ?? "").trim();
  const primaryCabangRefId = pcCabangRaw ? await matchCabang(pcCabangRaw) : null;
  if (pcCabangRaw && !primaryCabangRefId) notes.push(`PC IKPM Cabang tidak dikenali (harus persis salah satu daftar baku): "${pcCabangRaw}"`);

  // ── Nomor Keanggotaan (opsional, khusus tenant forum — lihat commitImportAction) ──
  // Diterima apa adanya, tidak divalidasi format — lihat comment extractYearSeqFromMembershipNumber.
  const membershipNumber = (raw["nomor keanggotaan"] ?? "").trim() || null;

  // ── Kontak ──
  const phoneIssue = detectPhoneCellIssue(raw["no hp"] ?? "");
  const waIssue     = detectPhoneCellIssue(raw["no whatsapp"] ?? "");
  const phone    = phoneIssue ? null : normalizePhone(raw["no hp"]);
  const whatsapp = waIssue    ? null : normalizePhone(raw["no whatsapp"]);
  if (phoneIssue) notes.push(`No HP: ${phoneIssue} (nilai asli: "${raw["no hp"]}")`);
  if (waIssue)    notes.push(`No WhatsApp: ${waIssue} (nilai asli: "${raw["no whatsapp"]}")`);

  const emailRaw = (raw["email"] ?? "").trim();
  const email = emailRaw && isValidEmail(emailRaw) ? emailRaw.toLowerCase() : null;
  if (emailRaw && !email) notes.push(`Email tidak valid: "${emailRaw}"`);

  // ── Alamat pribadi ──
  const wilayah = await matchWilayah(
    raw["provinsi"] ?? "", raw["kabupaten/kota"] ?? "", raw["kecamatan"] ?? "", raw["desa/kelurahan"] ?? "",
  );
  if (wilayah.flagged) {
    notes.push(`Sebagian alamat tidak match ref wilayah (Provinsi: "${raw["provinsi"]}", Kabupaten: "${raw["kabupaten/kota"]}", Kecamatan: "${raw["kecamatan"]}", Desa: "${raw["desa/kelurahan"]}")`);
  }
  const countryResult = normalizeCountry(raw["negara"] ?? "", !!wilayah.provinceId);
  if (countryResult.flagged) notes.push(`Kolom Negara ("${raw["negara"]}") kemungkinan salah isi — diasumsikan Indonesia karena provinsi valid`);

  // Kode Pos: nilai eksplisit dari kolom menang, fallback ke kode pos desa yang ter-match
  // (ref_villages.postal_code) kalau kolomnya kosong.
  const postalCode = raw["kode pos"]?.trim() || wilayah.villagePostalCode;

  // ── Duplikat (vs DB) — SEKARANG SELALU dilengkapi field kosongnya, TIDAK PERNAH di-skip
  // otomatis (baik yang sudah jadi anggota tenant ini maupun yang belum) — lihat
  // computeMemberMergeCandidate() + docs/arsitektur-import-anggota.md § 16. ──
  let existingMemberId: string | null = null;
  let linkOnly = false;
  let mergeFields: string[] = [];
  const existing = await findExistingMemberByContact(phone, whatsapp, email);
  if (existing) {
    existingMemberId = existing.id;
    const candidate = await computeMemberMergeCandidate(
      existing.id, tenantId, isForumTenant,
      { gender, graduationYear, graduationPeriod, birthDate, birthPlaceText, stambukNumber, nik, waliSantri, domicileStatus, professionId, primaryCabangRefId },
      { phone, whatsapp, email },
      membershipNumber,
    );
    mergeFields = candidate.fieldLabels;
    const fieldsNote = mergeFields.length > 0
      ? `akan melengkapi: ${mergeFields.join(", ")}`
      : "data sudah lengkap, tidak ada yang perlu dilengkapi";

    if (candidate.existingTenantMembershipId) {
      status = "duplicate";
      notes.push(`Sudah terdaftar sebagai anggota tenant ini (cocok dengan "${existing.fullName}") — ${fieldsNote}`);
    } else {
      linkOnly = true;
      notes.push(`Member sudah ada di sistem ("${existing.fullName}") — akan ditambahkan sebagai anggota tenant ini (bukan dibuat member baru), ${fieldsNote}`);
    }
  }

  // ── Duplikat ANTAR-BARIS dalam file yang sama (bukan match ke DB) ──
  // Hanya relevan kalau baris ini akan jadi member BARU (linkOnly=false) — kalau sudah
  // match ke member existing, deteksi duplikat DB di atas sudah cukup. (status tidak pernah
  // "error" di titik ini — baris kosong-nama sudah return lebih awal di atas.)
  if (!existingMemberId) {
    const contactValues = [phone, whatsapp, email].filter((v): v is string => !!v);
    const dupRowNumber = contactValues
      .map((v) => seenContacts.get(v))
      .find((v) => v !== undefined);
    if (dupRowNumber !== undefined) {
      notes.push(`Nomor HP/WA/Email sama dengan baris ${dupRowNumber} di file ini — kemungkinan data ganda, cek dulu sebelum import`);
      status = status === "duplicate" ? status : "review_needed";
    } else {
      // Daftarkan kontak baris ini supaya baris SETELAHNYA bisa mendeteksi baris ini.
      for (const v of contactValues) if (!seenContacts.has(v)) seenContacts.set(v, rowNumber);
    }
  }

  // ── Usaha (opsional per orang) — category/sector boleh null (migration 0048), TIDAK
  // pernah ditebak/didefault. Kalau tidak diisi/tidak cocok nilai baku → null + catatan
  // informasional, status baris TETAP "ready" (bukan escalasi) — orangnya lengkapi sendiri
  // via /akun/usaha, yang memang mewajibkan category+sector sebelum bisa disimpan di sana. ──
  let business: ImportRowPreview["business"] = null;
  const businessName = raw["nama usaha"]?.trim();
  if (businessName) {
    const categoryRaw = (raw["kategori usaha"] ?? "").trim();
    const category = mapCategory(categoryRaw);
    if (categoryRaw && !category) notes.push(`Kategori Usaha tidak dikenali (harus persis salah satu nilai baku): "${categoryRaw}"`);

    const sectorRaw = (raw["sektor"] ?? "").trim();
    const sector = mapSector(sectorRaw);
    if (sectorRaw && !sector) notes.push(`Sektor tidak dikenali (harus persis salah satu nilai baku): "${sectorRaw}"`);

    const businessFields = splitBusinessFields(raw["bidang usaha"] ?? "");

    const legalityRaw = (raw["badan hukum"] ?? "").trim();
    const legality = mapLegality(legalityRaw);
    if (legalityRaw && !legality) notes.push(`Badan Hukum tidak dikenali: "${legalityRaw}"`);

    const positionRaw = (raw["posisi"] ?? "").trim();
    const position = mapPosition(positionRaw);
    if (positionRaw && !position) notes.push(`Posisi tidak dikenali: "${positionRaw}"`);

    const employeesRaw = (raw["jumlah karyawan"] ?? "").trim();
    const employees = mapEmployees(employeesRaw);
    if (employeesRaw && !employees) notes.push(`Jumlah Karyawan tidak dikenali: "${employeesRaw}"`);

    const branchesRaw = (raw["jumlah cabang"] ?? "").trim();
    const branches = mapBranches(branchesRaw);
    if (branchesRaw && !branches) notes.push(`Jumlah Cabang tidak dikenali: "${branchesRaw}"`);

    const revenueRaw = (raw["omzet pertahun"] ?? "").trim();
    const revenue = mapRevenue(revenueRaw);
    if (revenueRaw && !revenue) notes.push(`Omzet Pertahun tidak dikenali: "${revenueRaw}"`);

    const bizWilayah = await matchWilayah(raw.__provinsiUsaha ?? "", raw["kabupaten"] ?? "", "");
    const bizCountryResult = normalizeCountry(raw.__negaraUsaha ?? "", !!bizWilayah.provinceId);

    const bizPhoneIssue = detectPhoneCellIssue(raw["telepon usaha"] ?? "");
    const bizWaIssue    = detectPhoneCellIssue(raw["whatsapp usaha"] ?? "");

    business = {
      name: businessName,
      brand: raw["merk / brand produk"]?.trim() || null,
      description: [raw["deskripsi usaha"]?.trim(), raw["produk"]?.trim() ? `Produk: ${raw["produk"].trim()}` : ""]
        .filter(Boolean).join("\n\n") || null,
      category, sector, businessFields,
      legality, position, employees, branches, revenue,
      addressDetail: raw["alamat usaha"]?.trim() || null,
      addressProvinceId: bizWilayah.provinceId,
      addressRegencyId: bizWilayah.regencyId,
      addressCountry: bizCountryResult.country,
      phone: bizPhoneIssue ? null : normalizePhone(raw["telepon usaha"]),
      whatsapp: bizWaIssue ? null : normalizePhone(raw["whatsapp usaha"]),
      facebook: raw["url facebook"]?.trim() || null,
      instagram: raw["id instagram"]?.trim() || null,
      tiktok: raw["url tiktok"]?.trim() || null,
      website: raw["website"]?.trim() || null,
    };
  }

  return {
    rowNumber, status, notes, existingMemberId, linkOnly, mergeFields,
    member: {
      fullName, gender, graduationYear, graduationPeriod, birthDate, birthPlaceText,
      stambukNumber, nik, waliSantri, domicileStatus, professionId, primaryCabangRefId,
    },
    contact: { phone, whatsapp, email },
    address: {
      detail: raw["alamat"]?.trim() || null,
      provinceId: wilayah.provinceId, regencyId: wilayah.regencyId, districtId: wilayah.districtId,
      villageId: wilayah.villageId, postalCode, country: countryResult.country,
    },
    membershipNumber,
    business,
  };
}
