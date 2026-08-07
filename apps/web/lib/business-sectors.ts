// Taksonomi Sektor Usaha (Tier 2) + Sub-Bidang (Tier 3) — upgrade 2026-07-30 dari 7 sektor lama
// ke 10 sektor BPS KBLI hybrid + "Kreatif" mandiri (kebutuhan Forcreator). Rujukan lengkap:
// docs/arsitektur-usaha.md § 9 (keputusan+mapping) + docs/arsitektur-usaha-taxonomy-gemini.md
// (rincian 52 label Tier-3, kolom kiri/bold tiap tabel — bukan kolom "Layanan/Produk" ilustratif).
//
// Sektor ke-11 taksonomi doc (`sec_other_services`, "Jasa Komunitas & Lainnya") SENGAJA DIBUANG
// dari eksekusi ini (keputusan user 2026-07-30) — tetap persis 10 sektor.
//
// ZERO import dari @jalajogja/db — aman dipakai client maupun server, sama seperti
// lib/import-anggota-mapping.ts.

import { BUSINESS_FIELD_SUGGESTIONS } from "@/lib/business-fields";

export const BUSINESS_SECTOR_ENUM = [
  "Pertanian, Peternakan & Perikanan",
  "Manufaktur & Pengolahan",
  "Perdagangan, Ritel & F&B",
  "Teknologi & Informasi",
  "Kreatif",
  "Logistik, Transportasi & Konstruksi",
  "Jasa Usaha & Keuangan",
  "Pendidikan & Pelatihan",
  "Kesehatan, Farmasi & Herbal",
  "Sumber Daya Alam & Energi",
] as const;
export type BusinessSector = typeof BUSINESS_SECTOR_ENUM[number];

// Bentuk siap-pakai untuk <Combobox>/picker manapun — SATU sumber untuk SEMUA form (self-
// service /akun/usaha, admin wizard step4-business, filter arsip publik /usaha). Sebelumnya
// masing-masing file re-declare 10 string sektor ini secara independen — 4 salinan yang bisa
// diam-diam drift kalau salah satu diedit tanpa yang lain (mis. tenant beda melihat opsi
// sektor yang berbeda). Import array ini, jangan pernah tulis literal sektor baru di file lain.
export const SECTOR_COMBOBOX_OPTIONS = BUSINESS_SECTOR_ENUM.map((v) => ({ value: v, label: v }));

// ── Backward-compat: 7 nilai lama → 10 nilai baru ───────────────────────────────
// Mapping AMBIGU (1-ke-banyak, tidak ada padanan tunggal yang pasti) sengaja diarahkan ke null
// — bukan ditebak. Pemilik usaha pilih ulang sendiri lewat form (sector nullable sejak migration
// 0048). Lihat docs/arsitektur-usaha.md § 9 untuk rasionalisasi lengkap tiap baris.
const OLD_TO_NEW_SECTOR: Record<string, BusinessSector | null> = {
  "Teknologi": "Teknologi & Informasi",
  "Jasa Profesional": "Jasa Usaha & Keuangan",
  "Kreatif": "Kreatif",
  "Manufaktur": "Manufaktur & Pengolahan",
  "Kesehatan & Pendidikan": null,
  "Konsumsi & Ritel": "Perdagangan, Ritel & F&B",
  "Sumber Daya Alam": null,
};

export function normalizeBusinessSector(raw: string | null | undefined): BusinessSector | null {
  if (!raw) return null;
  if ((BUSINESS_SECTOR_ENUM as readonly string[]).includes(raw)) return raw as BusinessSector;
  return OLD_TO_NEW_SECTOR[raw] ?? null;
}

// ── Tier-3 per sektor — HANYA untuk soft-prioritize urutan saran TagMultiSelect ─────────────
// BUKAN hard filter. `sector` dan `businessFields` tetap facet independen (docs/arsitektur-
// usaha.md § 2-3) — banyak Tier-3 (mis. "Desain Komunikasi Visual") natural masuk >1 sektor,
// memaksa hard-filter akan menghidupkan lagi masalah "yang mana induknya" yang sudah dihindari.
export const SECTOR_SUB_FIELDS: Record<BusinessSector, string[]> = {
  "Pertanian, Peternakan & Perikanan": [
    "Pertanian Tanaman Pangan & Hortikultura",
    "AgriTech & Smart Farming",
    "Peternakan & Unggas",
    "Perikanan & Budidaya (Aquaculture)",
    "Perkebunan & Komoditas Ekspor",
  ],
  "Manufaktur & Pengolahan": [
    "Pangan Terolah & Maklon F&B",
    "Tekstil, Konveksi & Fashion",
    "Kemasan & Percetakan Industri",
    "Kerajinan, Mebel & Dekorasi",
    "Kimia Rumah Tangga & Kosmetik",
  ],
  "Perdagangan, Ritel & F&B": [
    "Kuliner Modern & F&B",
    "Restoran & Rumah Makan",
    "Toko Ritel & Minimarket",
    "Distribusi Grosir Sembako",
    "E-commerce & Social Commerce",
    "Perlengkapan Rumah & Harian",
  ],
  "Teknologi & Informasi": [
    "Software Development & SaaS",
    "Infrastruktur IT & Keamanan",
    "Pemasaran Digital & Analytics",
    "Media Digital & Publishing",
    "Penerbit Buku",
  ],
  "Kreatif": [
    "Event",
    "Kaligrafi",
    "Desain Komunikasi Visual",
    "Seni Teater dan Sastra",
    "Seni Media Rekam",
    "Seni Lukis dan Illustrasi",
    "Seni Musik",
    "Seni Instalasi dan Kontemporer",
    "Seni Kriya",
  ],
  "Logistik, Transportasi & Konstruksi": [
    "Jasa Ekspedisi & Kurir",
    "Bengkel Mobil",
    "Bengkel Motor",
    "Travel & Biro Perjalanan Wisata",
    "Travel Haji & Umroh",
    "Pergudangan & Fulfillment",
    "Kontraktor & Jasa Konstruksi",
    "Bahan Bangunan & Material",
    "Properti & Sewa Lahan",
  ],
  "Jasa Usaha & Keuangan": [
    "Konsultasi Legal & Perizinan",
    "Keuangan, Akuntansi & Pajak",
    "Keuangan Syariah & Lembaga Keuangan",
    "Konsultan Manajemen & SDM",
    "Riset, Bisnis & Sertifikasi ISO",
  ],
  "Pendidikan & Pelatihan": [
    "Pesantren & Lembaga Keagamaan",
    "Pendidikan Formal (Sekolah & Perguruan Tinggi)",
    "EdTech & Platform Belajar Digital",
    "Pelatihan Vokasi & Bootcamps",
    "Pengembangan Karir & Mentoring",
  ],
  "Kesehatan, Farmasi & Herbal": [
    "Rumah Sakit",
    "Fasilitas Kesehatan & Klinik",
    "Produsen & Distributor Herbal / Thibbun Nabawi",
    "Apotek & Farmasi",
    "Alat Kesehatan & Sterilisasi",
    "Layanan Telehealth & Wellness",
  ],
  "Sumber Daya Alam & Energi": [
    "Energi Terbarukan (Renewable Energy)",
    "Pengolahan Limbah & Daur Ulang",
    "Bahan Bakar & Distribusi Energi",
    "Pertambangan & Penggalian",
  ],
};

// ── Soft-prioritize: sektor terpilih muncul duluan, sisanya (termasuk sektor lain) tetap ada ──
// Tidak ada item yang hilang dari daftar — murni urutan, bukan filter. Dipakai sebagai daftar
// PENCARIAN (searchOptions) di TagMultiSelect — begitu user mengetik, seluruh sektor tetap bisa
// ditemukan.
export function getPrioritizedBusinessFields(sector: string | null | undefined): string[] {
  const all = BUSINESS_FIELD_SUGGESTIONS;
  if (!sector || !(sector in SECTOR_SUB_FIELDS)) return all;
  const prioritized = SECTOR_SUB_FIELDS[sector as BusinessSector];
  const rest = all.filter((f) => !prioritized.includes(f));
  return [...prioritized, ...rest];
}

// ── Hard filter: HANYA item kanonik milik sektor ini ────────────────────────────────────────
// Beda dari getPrioritizedBusinessFields() di atas (yang tetap menyertakan SEMUA sektor, cuma
// diurutkan) — fungsi ini GENUINELY membuang item sektor lain. Dipakai sebagai daftar IDLE
// (options) di TagMultiSelect, supaya dropdown yang belum diketik apa pun tidak "bocor" item
// sektor lain — sektor lain tetap bisa dicari via searchOptions (getPrioritizedBusinessFields).
//
// DUA kondisi fallback yang BERBEDA (jangan disatukan):
// - `sector` kosong (belum dipilih SAMA SEKALI) → tidak ada yang bisa dibatasi, tampilkan
//   daftar penuh.
// - `sector` terisi tapi BUKAN salah satu dari 10 kanonik (Sektor CUSTOM tenant, § 10.10) →
//   kosong (`[]`), BUKAN daftar penuh — Sektor custom murni punya item custom
//   (customBusinessFields[sector]) miliknya sendiri, tidak ada Tier-3 kanonik yang relevan
//   untuknya. Fallback ke daftar penuh di sini justru MEMBOCORKAN 59 item lintas-sektor untuk
//   tenant yang sektor-nya sepenuhnya custom — kebalikan dari tujuan fungsi ini.
export function getStrictBusinessFields(sector: string | null | undefined): string[] {
  if (!sector) return BUSINESS_FIELD_SUGGESTIONS;
  return (SECTOR_SUB_FIELDS as Record<string, string[]>)[sector] ?? [];
}
