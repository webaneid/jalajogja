// Kategori & jenis profesi untuk Direktori Profesional.
// Disederhanakan dari BPS KBJI 2014 Golongan Pokok 2 "Profesional" (basis ISCO-08).
// Arsitektur lengkap: docs/arsitektur-profesional.md § 2

export const PROFESSION_CATEGORIES = [
  "Sains, Teknik & Rekayasa",
  "Kesehatan",
  "Pendidikan & Akademik",
  "Bisnis, Keuangan & Manajemen",
  "Teknologi Informasi",
  "Hukum, Sosial & Budaya",
  "Lainnya",
] as const;

export type ProfessionCategory = typeof PROFESSION_CATEGORIES[number];

// Daftar kurasi jenis profesi per kategori — suggestion di combobox, bukan closed enum.
// Anggota tetap bisa ketik jenis profesi lain yang belum ada di sini (§2.5).
export const PROFESSION_TYPES_BY_CATEGORY: Record<ProfessionCategory, string[]> = {
  "Kesehatan": [
    "Dokter Umum", "Dokter Spesialis", "Dokter Gigi", "Perawat", "Bidan",
    "Apoteker", "Dokter Hewan", "Ahli Gizi", "Fisioterapis",
  ],
  "Hukum, Sosial & Budaya": [
    "Pengacara / Advokat", "Notaris", "Hakim", "Jaksa", "Psikolog",
    "Jurnalis / Wartawan", "Penulis", "Pekerja Sosial",
  ],
  "Sains, Teknik & Rekayasa": [
    "Insinyur Sipil", "Insinyur Mesin", "Insinyur Elektro", "Insinyur Industri",
    "Arsitek", "Perencana Wilayah & Kota", "Peneliti Sains",
  ],
  "Bisnis, Keuangan & Manajemen": [
    "Akuntan", "Konsultan Manajemen", "Konsultan Pajak", "Analis Keuangan",
    "Aktuaris", "Auditor",
  ],
  "Pendidikan & Akademik": [
    "Guru", "Dosen", "Peneliti / Akademisi", "Instruktur / Trainer",
  ],
  "Teknologi Informasi": [
    "Software Engineer / Developer", "Data Scientist / Analyst", "System Analyst",
    "IT Consultant", "Cyber Security Specialist",
  ],
  "Lainnya": [],
};

export const EMPLOYMENT_TYPES = [
  "Praktik Mandiri", "Karyawan/Pegawai", "Pemilik Firma/Klinik/Kantor", "Freelance/Konsultan Lepas",
] as const;
