// Daftar kurasi "Apa yang Ditawarkan/Dibutuhkan" — suggestion untuk combobox multi-select
// (TagMultiSelect) di field `offeredTags`/`neededTags`, dipakai bersama oleh 3 modul (Usaha,
// Profesional, Pesantren). BUKAN closed enum — anggota tetap bisa ketik tag lain bebas.
//
// PENTING (lihat docs/arsitektur-ekosistem.md § 3.2 + § 4 poin 3): file ini SENGAJA bukan
// taksonomi independen baru dengan categoryId/synonym-mapping — itu risiko fragmentasi yang
// draft rencana ekosistem awal sempat diusulkan dan dikritik. Isinya murni AGGREGATOR flat
// string[], di-seed dari BUSINESS_FIELD_SUGGESTIONS yang sudah ada (bukan disalin ulang manual)
// ditambah entri lintas-domain yang belum tercakup vocabulary manapun — supaya "Kaligrafi" tetap
// SATU sumber kebenaran (business-fields.ts), bukan diketik ulang di sini.
//
// Berbeda dari `businessFields` (klasifikasi "usaha ini bergerak di bidang apa") dan
// `professionType` (klasifikasi "profesi ini jenis apa") — dua field itu TIDAK disentuh, tetap
// jadi taksonomi masing-masing modul. `offeredTags`/`neededTags` adalah lapis BARU: "apa yang
// konkret bisa ditawarkan/dicari", relevan lintas ketiga modul sekaligus (Usaha bisa
// menawarkan/mencari sesuatu, Profesional bisa menawarkan jasa, Pesantren bisa menawarkan/
// mencari sesuatu) — makanya vocabulary-nya digabung, bukan terpisah per modul.

import { BUSINESS_FIELD_SUGGESTIONS } from "@/lib/business-fields";

// Kebutuhan/tawaran lintas-domain yang belum tercakup businessFields (industri) ataupun
// professionType (jabatan) — kurasi awal dari skenario nyata yang sudah disebut user:
// pesantren cari guru/legalitas, usaha cari bahan baku, berbagi aset menganggur, dst.
const ECOSYSTEM_CROSS_DOMAIN_SUGGESTIONS: string[] = [
  // Kebutuhan SDM/pengajaran (relevan untuk Pesantren mencari, Profesional menawarkan)
  "Guru Bahasa Inggris",
  "Guru Bahasa Arab",
  "Pengajar / Instruktur Vokasi",
  "Mentor / Pembina Santri",
  // Legalitas & administrasi (relevan untuk Usaha & Pesantren mencari, Profesional menawarkan)
  "Konsultan Legalitas Yayasan",
  "Konsultan Pendirian PT/CV",
  "Jasa Akuntansi & Pajak",
  // Pengadaan & logistik (relevan untuk Usaha & Pesantren, dua arah)
  "Pasokan Beras/Sembako",
  "Pengadaan Komputer/Lab",
  "Seragam & Perlengkapan Santri",
  "Jasa Ekspedisi/Logistik",
  "Percetakan & ATK",
  // Aset & fasilitas (relevan untuk Usaha & Pesantren menawarkan)
  "Kelebihan Lahan/Aset Menganggur",
  "Ruang/Aula untuk Disewa",
  "Produk Santri/Usaha untuk Dijual",
];

export const ECOSYSTEM_TAG_SUGGESTIONS: string[] = [
  ...BUSINESS_FIELD_SUGGESTIONS,
  ...ECOSYSTEM_CROSS_DOMAIN_SUGGESTIONS,
];
