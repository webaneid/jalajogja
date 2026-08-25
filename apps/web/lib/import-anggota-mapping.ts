// Fungsi transform MURNI untuk fitur Import Anggota (docs/arsitektur-import-anggota.md) —
// ZERO import dari @jalajogja/db, aman dipakai server MAUPUN client (preview table butuh
// akses fungsi ini juga untuk menjelaskan status per baris tanpa round-trip ke server).
//
// PRINSIP DIKUNCI (2026-07-25): template import WAJIB pakai nama kolom + nilai PERSIS sama
// dengan skema kita sendiri — bukan tool ini yang menerjemahkan/menebak struktur database
// eksternal manapun. Kalau ada yang punya database lama dengan istilah berbeda (kategori
// usaha, badan hukum, dst), itu harus DIUBAH DULU secara manual ke bentuk template kita
// sebelum diupload — bukan tool ini yang "pintar" menebak-nebak. Field klasifikasi
// (category/sector/legality/position/employees/branches/revenue) semuanya EXACT MATCH
// (toleran spasi+kapitalisasi saja, bukan sinonim/terjemahan) terhadap nilai baku kita.
// Kalau tidak cocok atau kosong → null, TITIK — tidak pernah ditebak/didefault.
//
// PUTARAN KE-2 (2026-07-25, docs/arsitektur-import-anggota.md § 14): kolom template
// SEBELUMNYA masih anggota dari struktur satu contoh data eksternal (kolom "Forbis ID" —
// nama internal SATU forum tertentu, bukan istilah generik). Diaudit ulang dari NOL langsung
// dari schema (members/contacts/addresses/tenant_memberships), bukan dari file contoh:
// ditemukan 8 kolom `members` yang jadi syarat kelengkapan profil (lib/member-eligibility.ts)
// sama sekali tidak ada di template lama — birthDate, waliSantri, domicileStatus,
// professionId, graduationPeriod — semua ditambahkan sekarang. "Forbis ID" diganti
// "Nomor Keanggotaan" (generik, tidak menyebut nama forum manapun).
//
// PUTARAN KE-3 (2026-07-25, docs/arsitektur-import-anggota.md § 16): member yang cocok
// dengan data EXISTING (HP/WA/Email match) SEBELUMNYA di-skip total kalau sudah jadi anggota
// tenant ini juga — TIDAK PERNAH melengkapi field kosongnya, termasuk Nomor Keanggotaan
// Forum yang masih null. User menemukan skenario berbahaya: anggota forum yang sudah
// terdaftar tapi nomornya belum sempat ter-generate (mis. admin baru atur format penomoran
// belakangan) tidak akan PERNAH dapat nomor dari data import yang sebenarnya sudah tahu
// jawabannya, kalau baris itu selalu di-skip. Fix: `fillEmpty()` di bawah — dipakai baik oleh
// preview (menampilkan field apa yang AKAN dilengkapi) maupun commit (benar-benar menulis).

import { BUSINESS_SECTOR_ENUM, type BusinessSector } from "@/lib/business-sectors";
import {
  BUSINESS_CATEGORY_ENUM, type BusinessCategory,
  BUSINESS_LEGALITY_ENUM,
  BUSINESS_POSITION_ENUM,
  BUSINESS_EMPLOYEES_ENUM,
  BUSINESS_BRANCHES_ENUM,
  BUSINESS_REVENUE_ENUM,
} from "@/lib/business-form-options";

// ── Isi HANYA field yang di database masih kosong — TIDAK PERNAH menimpa nilai yang sudah
// ada. Generik, dipakai untuk members DAN contacts (bentuk field beda, logic sama). ──────
export function fillEmpty<T extends Record<string, unknown>>(
  existing: T, incoming: Partial<T>,
): Partial<T> {
  const patch: Partial<T> = {};
  // Iterasi berdasarkan key `existing` (SELALU hasil SELECT eksplisit — daftar kolom yang
  // BENAR-BENAR ada di skema), BUKAN key `incoming` — sengaja, cegah bug kelas "objek incoming
  // punya field ekstra yang bukan bagian skema" (ditemukan 2026-07-25 dari testing user, § 17
  // docs/arsitektur-import-anggota.md: caller sempat kirim `preview.member` utuh — punya field
  // `fullName` yang bukan kolom yang di-SELECT — bocor ke patch, Drizzle hasilkan SQL "SET"
  // kosong karena kolom tak dikenal, `UPDATE ... SET WHERE ...` → syntax error). Dengan
  // iterasi dari `existing`, field ekstra di `incoming` yang tidak ada di `existing` OTOMATIS
  // diabaikan, terlepas caller hati-hati atau tidak.
  for (const key in existing) {
    const incomingVal = incoming[key];
    if (incomingVal === null || incomingVal === undefined || incomingVal === "") continue;
    if (existing[key] === null || existing[key] === undefined) {
      patch[key] = incomingVal;
    }
  }
  return patch;
}

// Label Bahasa Indonesia untuk field yang bisa dilengkapi (ditampilkan di preview/notes) —
// gabungan members + contacts + tenant_memberships.membershipNumber (satu-satunya field
// tenant-scoped yang relevan di-backfill).
export const MERGEABLE_FIELD_LABELS: Record<string, string> = {
  gender: "Jenis Kelamin", graduationYear: "Alumni", graduationPeriod: "Periode Angkatan 1999",
  birthDate: "Tanggal Lahir", birthPlaceText: "Tempat Lahir", stambukNumber: "No. Stambuk Gontor",
  nik: "NIK", nikHash: "NIK", waliSantri: "Wali Santri", domicileStatus: "Status Domisili",
  professionId: "Profesi", primaryCabangRefId: "PC IKPM Cabang", phone: "No HP", whatsapp: "No WhatsApp", email: "Email",
  membershipNumber: "Nomor Keanggotaan Forum",
};

// ── Helper generik: exact match (toleran spasi+kapitalisasi) terhadap daftar nilai baku ──
function exactMatch<T extends string>(raw: string, allowed: readonly T[]): T | null {
  const v = raw.trim();
  if (!v) return null;
  const found = allowed.find((a) => a.toLowerCase() === v.toLowerCase());
  return found ?? null;
}

// ── Jenis Kelamin → members.gender ──────────────────────────────────────────────
// Bukan translasi "struktur eksternal" — ini konversi tampilan↔penyimpanan yang SELALU
// perlu ada di mana pun data masuk (form self-service/admin juga pakai label Indonesia).
export function mapGender(raw: string): "male" | "female" | null {
  const v = raw.trim().toLowerCase();
  if (v === "laki-laki" || v === "laki laki" || v === "pria" || v === "l") return "male";
  if (v === "perempuan" || v === "wanita" || v === "p") return "female";
  return null;
}

// ── Alumni → members.graduationYear (Excel sering simpan sebagai float "2010.0") ────
export function parseGraduationYear(raw: string): number | null {
  const cleaned = raw.trim().replace(/\.0+$/, "");
  const n = parseInt(cleaned, 10);
  if (!Number.isFinite(n) || n < 1950 || n > new Date().getFullYear()) return null;
  return n;
}

// ── Periode Angkatan 1999 → members.graduationPeriod (hanya relevan kalau tahun=1999) ──
export function mapGraduationPeriod(raw: string): "awal" | "akhir" | null {
  const v = raw.trim().toLowerCase();
  if (v === "awal") return "awal";
  if (v === "akhir") return "akhir";
  return null;
}

// ── Tanggal Lahir → members.birthDate (kembalikan "YYYY-MM-DD" atau null) ──────────
// Terima ISO (YYYY-MM-DD) atau format Indonesia umum (DD/MM/YYYY, DD-MM-YYYY). Tidak
// menebak MM/DD/YYYY ala Amerika — kalau ambigu (mis. "03/04/2000"), diperlakukan sebagai
// hari/bulan/tahun (konvensi Indonesia), bukan ditebak berdasarkan angka mana yang > 12.
export function parseBirthDate(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;

  let y: number, m: number, d: number;
  const iso = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    y = parseInt(iso[1], 10); m = parseInt(iso[2], 10); d = parseInt(iso[3], 10);
  } else {
    const idn = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (!idn) return null;
    d = parseInt(idn[1], 10); m = parseInt(idn[2], 10); y = parseInt(idn[3], 10);
  }
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  if (y < 1900 || y > new Date().getFullYear()) return null;

  // Validasi tanggal benar-benar ada di kalender (cegah "31 Februari" lolos sebagai "3 Maret")
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;

  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// ── Wali Santri → members.waliSantri — label PERSIS sama dengan pilihan di form
// (components/members/wizard/step1-identity.tsx), bukan istilah baru ────────────────
const WALI_SANTRI_LABELS: Record<string, "gontor" | "alumni" | "lain" | "bukan"> = {
  "wali santri pm gontor":        "gontor",
  "wali santri pm alumni gontor": "alumni",
  "wali santri pesantren lain":   "lain",
  "bukan wali santri":            "bukan",
};
export const WALI_SANTRI_DISPLAY_ENUM = Object.keys(WALI_SANTRI_LABELS);
export function mapWaliSantri(raw: string): "gontor" | "alumni" | "lain" | "bukan" | null {
  const v = raw.trim().toLowerCase();
  if (!v) return null;
  return WALI_SANTRI_LABELS[v] ?? null;
}

// ── Status Domisili → members.domicileStatus — label PERSIS sama dengan form
// (app/(public)/[tenant]/akun/lengkapi/page.tsx) ────────────────────────────────────
const DOMICILE_STATUS_LABELS: Record<string, "permanent" | "temporary"> = {
  "domisili tetap":      "permanent",
  "domisili sementara":  "temporary",
};
export const DOMICILE_STATUS_DISPLAY_ENUM = Object.keys(DOMICILE_STATUS_LABELS);
export function mapDomicileStatus(raw: string): "permanent" | "temporary" | null {
  const v = raw.trim().toLowerCase();
  if (!v) return null;
  return DOMICILE_STATUS_LABELS[v] ?? null;
}

// ── Nomor Keanggotaan (opsional, HANYA relevan untuk tenant forum) →
// tenant_memberships.membershipNumber ───────────────────────────────────────────────
// Disimpan APA ADANYA sebagai teks (cuma trim) — TIDAK divalidasi/direformat, karena setiap
// tenant forum bisa memilih preset format nomornya sendiri (lib/forum-membership-number.ts,
// 3 preset berbeda) — tool ini tidak berhak memaksa satu format "benar" untuk semua forum.
// Fungsi di bawah HANYA best-effort UNTUK MELANJUTKAN COUNTER: kalau kebetulan formatnya
// "TAHUN.URUTAN" (preset default "Tahun + Urutan", contoh "2017.00001"), sequence-nya
// diekstrak supaya forum_membership_sequences tidak tabrakan dengan nomor yang sudah
// diimport. Format lain (atau tidak ada — banyak forum baru belum punya penomoran historis
// sama sekali) tetap diterima sebagai string biasa, cuma tidak ikut proses lanjutan counter.
export function extractYearSeqFromMembershipNumber(raw: string): { seq: number } | null {
  const m = raw.trim().match(/^\d{4}\.(\d+)$/);
  if (!m) return null;
  return { seq: parseInt(m[1], 10) };
}

// ── Provinsi: normalisasi non-breaking space (artefak umum hasil copy-paste) ────────
export function normalizeProvinceName(raw: string): string {
  return raw.replace(/\u00A0/g, " ").trim();
}

// ── Negara: varian Indonesia → null (pakai kolom wilayah), selain itu → luar negeri ──
const INDONESIA_ALIASES = new Set(["indonesia", "indonesian", "indonésia"]);
export function normalizeCountry(raw: string, provinceMatched: boolean): { country: string | null; flagged: boolean } {
  const v = raw.trim().toLowerCase();
  if (!v) return { country: null, flagged: false };
  if (INDONESIA_ALIASES.has(v)) return { country: null, flagged: false };
  // Provinsi berhasil di-match (jadi alamatnya jelas di Indonesia) tapi Negara diisi bukan
  // varian Indonesia → kemungkinan salah kolom entry.
  if (provinceMatched) return { country: null, flagged: true };
  return { country: raw.trim(), flagged: false };
}

// ── Email — validasi longgar, bukan RFC lengkap ─────────────────────────────────
export function isValidEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim());
}

// ── Nomor HP/WA — deteksi sel rusak SEBELUM dinormalisasi ───────────────────────
// Dipakai untuk cegah "menebak" nomor yang sudah cacat (notasi ilmiah Excel, 2 nomor
// digabung dalam 1 sel, dll) — kalau rusak, flag untuk input ulang manual, JANGAN coba
// tebak salah satu nomornya.
export function detectPhoneCellIssue(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null; // kosong bukan masalah, itu urusan "wajib diisi" terpisah
  if (/e[+-]?\d+/i.test(v)) return "Notasi ilmiah Excel — presisi digit hilang, tidak bisa dipulihkan otomatis";
  if (v.includes("/") || /\batau\b/i.test(v)) return "Sel berisi lebih dari satu nomor";
  const digitsOnly = v.replace(/\D/g, "");
  if (digitsOnly.length > 15) return "Jumlah digit tidak wajar untuk nomor telepon";
  if (digitsOnly.length < 8) return "Jumlah digit terlalu sedikit untuk nomor telepon";
  return null;
}

// ── Klasifikasi usaha — SEMUA exact-match-or-null, TIDAK ADA default/tebakan ────────
// category & sector nullable di DB sejak migration 0048 (2026-07-25) — sama seperti
// legality/position/employees/branches/revenue, wajibnya cuma di form (self-service +
// admin, tidak berubah), bukan di kolom. Kalau template diisi dengan nilai yang benar
// (persis salah satu dari daftar di bawah), langsung masuk; kalau kosong/tidak cocok →
// null, orangnya lengkapi sendiri nanti via /akun/usaha (form itu SUDAH mewajibkan
// category+sector diisi sebelum bisa disimpan).

// Sumber kebenaran taksonomi Kategori/Sektor/Legalitas/Posisi/Karyawan/Cabang/Omzet sekarang
// lib/business-sectors.ts (Sektor) + lib/business-form-options.ts (sisanya) — diimpor di atas
// file lalu di-re-export di sini supaya importer lama dari file ini tidak perlu diubah path
// importnya, tanpa duplikasi isi (konsolidasi 2026-08-07, menutup 3 sumber independen jadi 1).
export { BUSINESS_CATEGORY_ENUM, type BusinessCategory };
export function mapCategory(raw: string): BusinessCategory | null {
  return exactMatch(raw, BUSINESS_CATEGORY_ENUM);
}

export { BUSINESS_SECTOR_ENUM, type BusinessSector };
export function mapSector(raw: string): BusinessSector | null {
  return exactMatch(raw, BUSINESS_SECTOR_ENUM);
}

export { BUSINESS_LEGALITY_ENUM };
export function mapLegality(raw: string): string | null {
  return exactMatch(raw, BUSINESS_LEGALITY_ENUM);
}

export { BUSINESS_POSITION_ENUM };
export function mapPosition(raw: string): string | null {
  return exactMatch(raw, BUSINESS_POSITION_ENUM);
}

export { BUSINESS_EMPLOYEES_ENUM };
export function mapEmployees(raw: string): string | null {
  return exactMatch(raw, BUSINESS_EMPLOYEES_ENUM);
}

export { BUSINESS_BRANCHES_ENUM };
export function mapBranches(raw: string): string | null {
  return exactMatch(raw, BUSINESS_BRANCHES_ENUM);
}

export { BUSINESS_REVENUE_ENUM };
export function mapRevenue(raw: string): string | null {
  return exactMatch(raw, BUSINESS_REVENUE_ENUM);
}

// ── Bidang Usaha (businessFields) — facet multi-tag BEBAS, independen dari sector ──
// Beda dari field klasifikasi di atas — ini memang dirancang creatable/bebas sejak awal
// (docs/arsitektur-usaha.md), jadi TIDAK exact-match terhadap daftar tertutup. Cuma
// dipisah-koma + buang tag placeholder yang jelas bukan sinyal usaha sungguhan.
const NO_SIGNAL_TAGS = new Set(["kosong", "lainnya", "lain-lain", "lain lain", "-"]);
export function splitBusinessFields(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && !NO_SIGNAL_TAGS.has(t.toLowerCase()));
}

// ── Bentuk satu baris preview lengkap ────────────────────────────────────────────
// Type ini SENGAJA hidup di file client-safe ini (bukan di import-anggota.server.ts
// yang punya `import "server-only"`) — meski dipakai berat oleh server engine, karena
// preview table di client (import-client.tsx) juga butuh type ini. Lihat lesson
// CLAUDE.md soal client/server boundary — jangan pernah import dari file "server-only"
// di client component, bahkan sebagai `import type`.
export type ImportRowPreview = {
  rowNumber: number;
  status: "ready" | "review_needed" | "duplicate" | "error";
  notes: string[]; // penjelasan informasional (field tidak dikenali/kosong), tidak pernah mengubah status
  existingMemberId: string | null; // terisi kalau status="duplicate" atau member sudah ada tapi belum jadi tenant_membership tenant ini
  linkOnly: boolean; // true = member sudah ada, tenant ini cukup ditambah tenant_membership (tidak insert member baru)
  // Label field (lib.MERGEABLE_FIELD_LABELS) yang akan DILENGKAPI (bukan ditimpa) untuk
  // member existing yang cocok — kosong array = bukan member existing, ATAU sudah lengkap
  // semua, tidak ada yang perlu dilengkapi. HANYA relevan kalau existingMemberId terisi.
  // Dihitung ulang lagi (bukan dipercaya apa adanya) saat commit — lihat commitImportAction.
  mergeFields: string[];

  member: {
    fullName: string;
    gender: "male" | "female" | null;
    graduationYear: number | null;
    graduationPeriod: "awal" | "akhir" | null; // hanya relevan kalau graduationYear=1999
    birthDate: string | null;                  // "YYYY-MM-DD"
    birthPlaceText: string | null;
    stambukNumber: string | null;              // No. Induk Gontor — beda dari memberNumber (auto-generated)
    // `nik` di sini SELALU ciphertext (encryptPii() sudah dipanggil sedini
    // mungkin di buildPreviewRow, sebelum baris ini pernah tersimpan ke draft
    // import_batch_rows.data) — TIDAK PERNAH plaintext, meski hidup di
    // ImportRowPreview yang sempat disimpan sebagai JSONB. `nikHash` (blind
    // index untuk exact-match/uniqueness) selalu menyertainya.
    nik: string | null;
    nikHash: string | null;
    waliSantri: "gontor" | "alumni" | "lain" | "bukan" | null;
    domicileStatus: "permanent" | "temporary" | null;
    professionId: number | null;               // FK ke public.ref_professions
    primaryCabangRefId: string | null;         // FK ke public.ref_ikpm_cabang
  };
  contact: {
    phone: string | null;
    whatsapp: string | null;
    email: string | null;
  };
  address: {
    detail: string | null;
    provinceId: number | null;
    regencyId: number | null;
    districtId: number | null;
    villageId: number | null;
    postalCode: string | null;
    country: string | null;
  };
  membershipNumber: string | null; // Nomor Keanggotaan — HANYA diisi untuk tenant tipe forum
  business: {
    name: string;
    brand: string | null;
    description: string | null;
    category: string | null;      // nullable sejak migration 0048 — null kalau tidak diisi/tidak cocok
    sector: string | null;        // nullable sejak migration 0048 — null kalau tidak diisi/tidak cocok
    businessFields: string[];
    legality: string | null;
    position: string | null;
    employees: string | null;
    branches: string | null;
    revenue: string | null;
    addressDetail: string | null;
    addressProvinceId: number | null;
    addressRegencyId: number | null;
    addressCountry: string | null;
    phone: string | null;
    whatsapp: string | null;
    facebook: string | null;
    instagram: string | null;
    tiktok: string | null;
    website: string | null;
  } | null; // null = tidak ada usaha untuk orang ini (Nama Usaha kosong)
};
