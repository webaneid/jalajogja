// Daftar kurasi "Bidang Usaha" — suggestion untuk combobox multi-select (TagMultiSelect),
// bukan closed enum. Anggota tetap bisa ketik bidang lain yang belum ada di sini.
//
// PENTING: ini facet INDEPENDEN dari `member_businesses.sector` (bukan sub-sector di bawah
// sector tertentu) — satu bidang bisa relevan lintas beberapa sector sekaligus, sengaja tidak
// dikelompokkan per-sector supaya tidak memaksa satu induk tunggal. Lihat
// docs/arsitektur-usaha.md § 2-3 untuk rasionalisasi lengkap.
//
// Daftar awal diturunkan dari 9 Bidang Usaha forum "Forcreator" (kreator & pekerja seni).
// SENGAJA memakai nama bidang/industri (bukan pecahan per-jabatan seperti
// PROFESSION_TYPES_BY_CATEGORY["Kreatif"] di lib/professional-types.ts) — usaha dikategorikan
// per domain/industri, bukan per profesi individu. Lihat docs/arsitektur-usaha.md § 4.
export const BUSINESS_FIELD_SUGGESTIONS: string[] = [
  "Kaligrafi",
  "Desain Komunikasi Visual",
  "Interior & Arsitektur",
  "Teater & Sastra",
  "Media Rekam (Film, Fotografi & Audio Visual)",
  "Seni Lukis & Ilustrasi",
  "Seni Musik",
  "Seni Instalasi & Kontemporer",
  "Seni Kriya",
];
