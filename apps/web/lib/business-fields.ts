// Daftar kurasi "Bidang Usaha" — suggestion untuk combobox multi-select (TagMultiSelect),
// bukan closed enum. Anggota tetap bisa ketik bidang lain yang belum ada di sini.
//
// PENTING: ini facet INDEPENDEN dari `member_businesses.sector` (bukan sub-sector di bawah
// sector tertentu) — satu bidang bisa relevan lintas beberapa sector sekaligus, sengaja tidak
// dikelompokkan per-sector supaya tidak memaksa satu induk tunggal. Lihat
// docs/arsitektur-usaha.md § 2-3 untuk rasionalisasi lengkap. Urutan TAMPIL di UI yang
// mengelompokkan per-sector (soft-prioritize, bukan filter) diatur di lib/business-sectors.ts
// (`getPrioritizedBusinessFields`) — array di bawah ini murni SUMBER, urutannya tidak penting.
//
// Update 2026-07-30: diganti total dari 9 item lama (khusus sub-bidang Kreatif/Forcreator) jadi
// 52 label Tier-3 dari docs/arsitektur-usaha-taxonomy-gemini.md (kolom kiri/bold tiap tabel,
// § 1-10 — BUKAN kolom "Layanan/Produk" yang cuma contoh ilustratif, bukan tag terpisah).
// Sektor ke-11 taksonomi doc (`sec_other_services`) SENGAJA DIBUANG (keputusan user). Wording
// Kreatif diadopsi PERSIS dari taxonomy-gemini.md (beda tipis dari 9 item lama — mis. "Teater &
// Sastra" → "Seni Teater dan Sastra", "Interior & Arsitektur" dihapus, "Event" ditambah) — field
// ini creatable, jadi tag lama yang sudah tersimpan di data manapun tidak pernah rusak/hilang
// oleh perubahan daftar SARAN ini.
export const BUSINESS_FIELD_SUGGESTIONS: string[] = [
  // Pertanian, Peternakan & Perikanan
  "Pertanian Tanaman Pangan & Hortikultura",
  "AgriTech & Smart Farming",
  "Peternakan & Unggas",
  "Perikanan & Budidaya (Aquaculture)",
  "Perkebunan & Komoditas Ekspor",
  // Manufaktur & Pengolahan
  "Pangan Terolah & Maklon F&B",
  "Tekstil, Konveksi & Fashion",
  "Kemasan & Percetakan Industri",
  "Kerajinan, Mebel & Dekorasi",
  "Kimia Rumah Tangga & Kosmetik",
  // Perdagangan, Ritel & F&B
  "Kuliner Modern & F&B",
  "Restoran & Rumah Makan",
  "Toko Ritel & Minimarket",
  "Distribusi Grosir Sembako",
  "E-commerce & Social Commerce",
  "Perlengkapan Rumah & Harian",
  // Teknologi & Informasi
  "Software Development & SaaS",
  "Infrastruktur IT & Keamanan",
  "Pemasaran Digital & Analytics",
  "Media Digital & Publishing",
  "Penerbit Buku",
  // Kreatif
  "Event",
  "Kaligrafi",
  "Desain Komunikasi Visual",
  "Seni Teater dan Sastra",
  "Seni Media Rekam",
  "Seni Lukis dan Illustrasi",
  "Seni Musik",
  "Seni Instalasi dan Kontemporer",
  "Seni Kriya",
  // Logistik, Transportasi & Konstruksi
  "Jasa Ekspedisi & Kurir",
  "Bengkel Mobil",
  "Bengkel Motor",
  "Travel & Biro Perjalanan Wisata",
  "Travel Haji & Umroh",
  "Pergudangan & Fulfillment",
  "Kontraktor & Jasa Konstruksi",
  "Bahan Bangunan & Material",
  "Properti & Sewa Lahan",
  // Jasa Usaha & Keuangan
  "Konsultasi Legal & Perizinan",
  "Keuangan, Akuntansi & Pajak",
  "Keuangan Syariah & Lembaga Keuangan",
  "Konsultan Manajemen & SDM",
  "Riset, Bisnis & Sertifikasi ISO",
  // Pendidikan & Pelatihan
  "Pesantren & Lembaga Keagamaan",
  "Pendidikan Formal (Sekolah & Perguruan Tinggi)",
  "EdTech & Platform Belajar Digital",
  "Pelatihan Vokasi & Bootcamps",
  "Pengembangan Karir & Mentoring",
  // Kesehatan, Farmasi & Herbal
  "Rumah Sakit",
  "Fasilitas Kesehatan & Klinik",
  "Produsen & Distributor Herbal / Thibbun Nabawi",
  "Apotek & Farmasi",
  "Alat Kesehatan & Sterilisasi",
  "Layanan Telehealth & Wellness",
  // Sumber Daya Alam & Energi
  "Energi Terbarukan (Renewable Energy)",
  "Pengolahan Limbah & Daur Ulang",
  "Bahan Bakar & Distribusi Energi",
  "Pertambangan & Penggalian",
];
