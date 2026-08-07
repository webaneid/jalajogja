# Arsitektur Ekosistem Sinergi Anggota — Interkoneksi Usaha, Profesional & Pesantren

> **Dokumen Terkait & Saling Terhubung**:
> - [`docs/arsitektur-usaha.md`](file:///Users/webane/sites/jalajogja/docs/arsitektur-usaha.md) — Data Usaha Anggota & Rencana Upgrade Sektor 3-Tier.
> - [`docs/arsitektur-usaha-taxonomy-gemini.md`](file:///Users/webane/sites/jalajogja/docs/arsitektur-usaha-taxonomy-gemini.md) — Taksonomi Sub-Sektor Tier 3 & Sub-Bidang Custom Forcreator.
> - [`docs/arsitektur-profesional.md`](file:///Users/webane/sites/jalajogja/docs/arsitektur-profesional.md) — Data & Kredensial Profesional Anggota.
> - [`docs/arsitektur-pesantren.md`](file:///Users/webane/sites/jalajogja/docs/arsitektur-pesantren.md) — Data Pesantren Anggota.

---

> **Status: Fase 0-2 SELESAI + di-commit/push (Fase 1 sudah deploy VPS, Fase 2 belum) — Rencana Eksekusi Ditulis Ulang, Bertahap, Berbasis Fondasi Nyata**
> Dokumen versi sebelumnya (ditulis agen lain, tanggal yang sama) mengusulkan pembangunan Trust
> Engine + RFQ Subsystem + Structured JSONB + Taxonomy Dictionary + Hub `/ekosistem` + Insight
> Widgets sekaligus sebagai "Fase 1". Setelah verifikasi LANGSUNG ke kode aktual (bukan asumsi),
> draft itu **tidak siap dieksekusi seperti tertulis** — lihat § 3 untuk alasan lengkap. Isi draft
> asli DIPERTAHANKAN di § 7 sebagai referensi visi jangka panjang, TAPI ditandai eksplisit "jangan
> eksekusi langsung" karena beberapa asumsinya salah tentang kondisi kode saat ini. **Rencana
> eksekusi yang BOLEH diikuti ada di § 6.**

---

## 1. Latar Belakang & Visi (Motivasi — Bukan Spesifikasi Teknis)

Platform jalakarta memiliki 3 modul data mandiri (*self-service*) milik anggota:
1. **Data Usaha (`member_businesses`)** — `docs/arsitektur-usaha.md`
2. **Data Profesional (`member_professionals`)** — `docs/arsitektur-profesional.md`
3. **Data Pesantren (`member_owned_pesantren`)** — `docs/arsitektur-pesantren.md`

**Masalah yang ingin dipecahkan** (dinyatakan user, tetap valid sebagai motivasi): ketiga direktori
ini saat ini murni pasif — pengunjung bisa MELIHAT data, tapi sistem tidak membantu menemukan
sinergi. Contoh yang diberikan user: penjual retail kaos tidak tahu di mana beli bahan kaos lewat
sesama anggota; pesantren yang butuh guru bahasa Inggris atau konsultan legalitas tidak tahu ada
anggota profesional yang menawarkan itu. **Visi ini tetap valid dan jadi tujuan akhir** — yang
direvisi total di dokumen ini adalah CARA MENCAPAINYA (urutan, ukuran langkah, dan kesesuaian
dengan fondasi yang benar-benar ada hari ini).

---

## 2. Audit Realitas — Apa yang BENAR-BENAR Ada Hari Ini (Diverifikasi 2026-07-29)

Sebelum menulis rencana apa pun, setiap klaim di bawah ini diverifikasi LANGSUNG ke kode
(`packages/db/src/schema/public/*.ts`, `apps/web/lib/*.ts`, `apps/web/app/**`) — bukan disalin
dari dokumen lain tanpa dicek ulang.

### 2.1 Modul Usaha (`member_businesses`)
- **Field yang ADA hari ini**: `category` (enum 5 nilai), `sector` (enum 7 nilai) — keduanya
  nullable di DB sejak migration `0048` tapi tetap wajib diisi di FORM (self-service +
  admin); `businessFields: jsonb string[]` — **facet independen** dari `sector` (bukan
  hierarki/sub-sector), tag bebas + kurasi awal 9 bidang dari forum Forcreator
  (`lib/business-fields.ts`), LIVE sejak migration `0044` (2026-07-24).
- **Field yang TIDAK ADA**: `verificationStatus`, `structuredSupplies`, `seekingSupplies`,
  `excessCapacity`, `partnershipSchemes`, `b2bReady`, `targetMarkets`, `businessRole` —
  SEMUA field yang diusulkan draft § 5.1 (lama) tidak ada satu pun di skema sekarang.
- **Sudah direncanakan (belum dibangun)**: `docs/arsitektur-usaha.md` § 8 sendiri SUDAH
  menyketsakan konsep `supplies: string[]`/`seeking: string[]` — versi SEDERHANA (flat tag
  array, reuse vokabular `businessFields` yang sama), bukan structured JSONB dengan
  volume+satuan+geospasial. Dokumen itu eksplisit menulis: *"Kenapa ditunda: kalau
  `supplies`/`seeking` dibangun SEBELUM `businessFields` matang dan terisi cukup banyak, kedua
  field itu akan jadi free-text tidak terstruktur yang susah dicocokkan otomatis. Urutan yang
  benar: bangun kosakata dulu, biarkan terisi organik, BARU bangun mesin pencocokan di atasnya."*
  — prinsip ini **belum pernah dieksekusi**, statusnya masih "menunggu sinyal user."

### 2.2 Modul Profesional (`member_professionals`)
- **STATUS SEBENARNYA: SUDAH LIVE PENUH** — dikonfirmasi langsung dari
  `packages/db/src/schema/public/member-professionals.ts`: `professionCategory` (enum 8
  nilai), `professionType` (combobox kurasi + custom, wajib), `specialization`, `description`,
  `licenseType`/`licenseNumber`, `employmentType` (enum 4 nilai), `institution`, `startYear`,
  `coverUrl`. Route publik `/{slug}/profesional` + `/{slug}/profesional/[id]` ADA. Self-service
  `/{slug}/akun/profesional` ADA. Vocabulary kurasi di `lib/professional-types.ts`
  (`PROFESSION_CATEGORIES` + `PROFESSION_TYPES_BY_CATEGORY`).
- **Koreksi penting**: `docs/arsitektur-profesional.md`'s HEADER sendiri masih menulis
  *"📋 PERENCANAAN SELESAI, SIAP EKSEKUSI — belum diimplementasikan"* — ini **BASI**, kontradiksi
  dengan isi § 14 dokumen yang sama (mendeskripsikan bug fix ke kategori "Kreatif" pada kode yang
  SUDAH DEPLOY, migration `0043`, 2026-07-24) dan dengan CLAUDE.md yang mencatat implementasi
  penuh sejak commit `2a3aa64` (2026-07-13). **Header dokumen itu perlu dikoreksi terpisah** —
  dicatat di sini, bukan diperbaiki di dokumen ini (di luar scope task ini).
- **Field yang TIDAK ADA**: `verificationStatus`, `skillTags`, `offeredServices`,
  `availabilityStatus`, `compensationSchemes`, `targetMarkets`, `portfolioUrls` — semua usulan
  draft § 5.2 (lama) tidak ada.
- **Tidak ada rencana Fase 2 tertulis** untuk modul ini sama sekali (beda dari Usaha yang sudah
  punya sketsa § 8) — kalau mau menambah tag "apa yang ditawarkan", ini akan jadi hal BARU tanpa
  cetak biru existing untuk diikuti.

### 2.3 Modul Pesantren (`member_owned_pesantren`)
- **STATUS: LIVE, SELESAI, STABIL** (commit `dbc933e`). Field yang ADA: identitas
  (`name`, `tahunBerdiri`, `luasArea`, `namaPimpinan`, `hpPimpinan`), klasifikasi (`kurikulum`,
  `jenisPondok`, `modelPendidikan`, `kategoriSantri` — semua enum tertutup), statistik
  (`santriPutra/Putri`, `asatidz/asatidzah`), `coverUrl`, helper FK (contact/address/social).
- **Field yang TIDAK ADA**: **ZERO** — tidak ada satu pun konsep tag, kebutuhan, atau
  penawaran. Ini modul yang PALING SEDIKIT punya fondasi untuk ekosistem dibanding 2 modul
  lain — Usaha sudah punya `businessFields`, Profesional sudah punya `professionType`
  bertingkat, Pesantren tidak punya apa pun yang menyerupai tag/kebutuhan/aset. Draft § 5.3
  (lama) mengusulkan **7 field JSONB terstruktur sekaligus** (`massConsumptions`,
  `neededProcurement`, `neededTalents`, `unitUsaha`, `idleAssets`, `collaborationIntent`) untuk
  modul yang belum punya fondasi tag paling sederhana sekalipun — ini lompatan paling jauh dari
  ketiga modul, dan draft tidak menyebutkan asimetri ini sama sekali.

### 2.4 Konsep yang TIDAK ADA di Manapun di Codebase
Grep menyeluruh (`verificationStatus|verifiedBy|is_verified|isVerified`) di seluruh
`apps/web/lib` dan `apps/web/app` — **nol hasil**. Tidak ada satu pun konsep "verifikasi" atau
"trust badge" untuk entitas member mana pun saat ini (bukan cuma untuk Usaha/Profesional/
Pesantren — untuk SELURUH platform). Trust Engine yang diusulkan draft bukan perluasan dari
sesuatu yang sudah ada — ini benar-benar konsep baru dari nol.

### 2.5 Pola yang SUDAH Established dan WAJIB Diikuti
- **Tenant-scoping direktori publik**: SEMUA 3 direktori (`/usaha`, `/profesional`,
  `/pesantren`) memakai pola yang SAMA PERSIS — `INNER JOIN tenant_memberships WHERE
  tenant_id = {tenantId} AND status IN ('active','alumni')` (dikonfirmasi di
  `app/(public)/[tenant]/usaha/page.tsx`). Artinya ketiga direktori ini **per-tenant**, bukan
  lintas-tenant, meski tabel datanya sendiri hidup di `public` schema. Hub `/ekosistem` manapun
  yang dibangun HARUS mengikuti pola scoping yang sama, kecuali ada keputusan eksplisit untuk
  membuatnya lintas-tenant (perubahan besar, di luar scope rencana ini).
- **Privacy per-field, owner-controlled**: `docs/arsitektur-kontak.md` +
  `docs/arsitektur-direktori-publik.md` mengunci model consent yang SANGAT ketat —
  `contacts.is_phone_public`/`is_whatsapp_public`/`is_email_public`, default PRIVAT, pemilik
  data yang harus aktif mencentang untuk publish. Sudah ada sesi audit KHUSUS untuk memastikan
  tidak ada kebocoran kontak tanpa consent di seluruh direktori publik (lihat lesson
  "Audit Consent Visibilitas Kontak" di CLAUDE.md). Draft § 7 (lama) mengusulkan "anggota
  terverifikasi bisa lihat WhatsApp langsung" — ini berpotensi **membypass** toggle consent yang
  sudah dikunci, dan TIDAK BOLEH dieksekusi tanpa rekonsiliasi eksplisit (lihat § 3.7).
- **Statistik sudah mengagregasi ketiganya**: `/{slug}/statistik` sudah breakdown per `sector`
  (Usaha), `professionCategory` (Profesional), `kurikulum` (Pesantren) — ini murni COUNTING
  pasif, bukan matching. Ini titik awal yang realistis untuk dibangun lebih lanjut, bukan
  digantikan oleh hub baru yang terpisah.
- **Sistem notifikasi WA sudah punya 24 event key** (`WaNotifKey` di `lib/whatsapp.ts`) — semua
  terikat erat ke transaksi spesifik (pembayaran, tiket event, donasi, TTD surat). **Tidak ada
  satu pun yang analog dengan "RFQ baru diterbitkan" atau "ada yang cocok dengan kebutuhanmu"**
  — menambahkan ini bukan "reuse infrastruktur", tapi kategori notifikasi baru yang butuh desain
  template dan trigger point sendiri dari nol.

---

## 3. Kritik Kritis Terhadap Draft Awal

### 3.1 Melompat ke infrastruktur berat tanpa mengukur adopsi fondasi yang sudah ada
`businessFields` baru live 5 hari sebelum draft ini ditulis (2026-07-24). Belum ada data
tentang berapa persen entri Usaha yang benar-benar sudah mengisi tag ini secara organik. Draft
langsung mengusulkan Trust Engine + RFQ + Hub tanpa mengetahui apakah fondasi yang JAUH lebih
sederhana ini sudah dipakai. Ini bertentangan LANGSUNG dengan prinsip yang SUDAH ditulis di
`arsitektur-usaha.md` sendiri (§ 2.1 di atas) — bangun kosakata dulu, biarkan terisi organik,
baru bangun mesin di atasnya. Draft melangkahi tahapan ini seluruhnya.

### 3.2 Taksonomi baru (`lib/ecosystem-tags.ts`) akan jadi taksonomi KETIGA yang tumpang tindih
Sudah ada 2 sistem vokabular independen: `lib/business-fields.ts` (9 bidang usaha, berbasis
domain/industri) dan `lib/professional-types.ts` (kategori+jenis profesi, berbasis
jabatan/pekerjaan). Draft mengusulkan `lib/ecosystem-tags.ts` sebagai "master taxonomy" ketiga
dengan `categoryId` + sinonim sendiri — TANPA menjelaskan bagaimana ini rekonsiliasi dengan 2
vocabulary yang SUDAH ADA. Hasilnya justru fragmentasi yang draft klaim ingin dicegah (§ 2 poin
3, lama): tiga sumber kebenaran berbeda untuk konsep yang mirip ("Percetakan" bisa masuk
`businessFields`, `professionType`, ATAU `ecosystem-tags` — mana yang benar?).

### 3.3 Pesantren melompat dari nol ke 7 field terstruktur sekaligus
Usaha dan Profesional setidaknya sudah punya SATU field tag sederhana untuk dibangun lebih
lanjut. Pesantren tidak punya APA PUN. Draft mengusulkan `massConsumptions` (JSONB array dengan
volume+satuan+regencyId), `neededProcurement` (dengan lifecycle status+expiry),
`neededTalents`, `unitUsaha`, `idleAssets`, `collaborationIntent` — 7 field JSONB terstruktur
langsung untuk modul yang paling sedikit fondasinya. Ini lompatan paling besar dari ketiga
modul dan draft tidak mengakui asimetri ini sama sekali.

### 3.4 Trust Engine adalah gap PROSES/WORKFLOW, bukan sekadar kolom
Menambahkan `verificationStatus`+`verifiedBy` secara skema itu trivial. Yang TIDAK dijawab
draft: siapa yang berwenang mengubah status ini? Lewat UI apa? Kriteria apa yang membedakan
`Basic_Verified` dari `Verified_Community` dari `Official_Partner`? Tanpa jawaban ini, kolom
`verificationStatus` akan selamanya `Unverified` — kolom mati yang tidak pernah ada yang
mengisinya, persis kelas masalah yang berulang kali ditemukan di project ini (kolom yang
ditambahkan tanpa mekanisme yang benar-benar menulisinya).

### 3.5 RFQ Subsystem adalah modul BARU sepenuhnya, bukan "enhancement Fase 2"
`ecosystem_rfqs` (tabel baru) + status lifecycle (`OPEN`/`IN_NEGOTIATION`/`CLOSED`/`EXPIRED`) +
auto-broadcast WA ke seluruh node yang cocok + matching engine untuk menentukan siapa yang
"cocok" — ini skalanya sebanding dengan modul Billing (yang butuh BANYAK sesi untuk dibangun
sampai stabil: cart, invoice, payment, verifikasi, jurnal, kode unik, cicilan). Membungkusnya
sebagai satu baris di "Fase 2" jauh meremehkan kompleksitas sebenarnya.

### 3.6 Matching geospasial/volume dideskripsikan lewat contoh, bukan algoritma
Draft § 2 poin 2 (lama) menyatakan "Kebutuhan Beras 2 Ton/bulan di Sleman tidak akan
dipasangkan dengan petani skala kecil 10 Kg di kota lain" — tapi TIDAK ADA algoritma matching
yang dijelaskan (ranking, threshold jarak, radius pencarian). Menambah kolom `regencyId` +
`volumeMonthly` ke JSONB tidak dengan sendirinya "mencegah mismatch" — itu baru bahan mentah;
logika pencocokan yang sesungguhnya sama sekali belum dirancang.

### 3.7 Model privasi berlapis (viewer-based) berpotensi membypass consent yang sudah dikunci
Draft § 7 (lama, "Layer 2 — Anggota Terverifikasi ... Kontak: Tombol WhatsApp Langsung") secara
implisit mengasumsikan status "terverifikasi" memberi hak melihat kontak SIAPA PUN, terlepas
dari toggle `is_whatsapp_public` yang pemilik data set sendiri. Ini kontradiksi arsitektur:
sistem consent yang ada sekarang adalah OWNER-CONTROLLED per-field (pemilik data yang
memutuskan, bukan status viewer). Kalau draft ini dieksekusi apa adanya, member yang secara
eksplisit mengunci nomor WhatsApp-nya (`is_whatsapp_public=false`) bisa tetap ter-expose ke
"anggota terverifikasi" — pelanggaran langsung terhadap keputusan konsen yang sudah pernah
diaudit khusus di sesi lain.

### 3.8 `skillTags`/`offeredServices` (Profesional) tumpang tindih tak jelas dengan `professionType`+`specialization` yang sudah ada
Seorang pengacara sudah punya `professionType`="Pengacara / Advokat" dan bisa isi
`specialization`="Sengketa Tanah". Draft mengusulkan `skillTags` (array tag bebas) DAN
`offeredServices` (array objek terstruktur) sebagai field TAMBAHAN — tidak dijelaskan kapan
admin/anggota mengisi yang mana, atau bagaimana ketiganya (professionType, specialization,
skillTags, offeredServices) saling melengkapi tanpa duplikasi makna.

---

## 4. Prinsip yang Dikunci untuk Rencana Revisi

1. **Vocabulary dulu, matching engine kemudian** — prinsip yang sudah ditulis di
   `arsitektur-usaha.md` sekarang jadi hukum untuk SEMUA 3 modul, bukan cuma Usaha. Setiap fase
   baru hanya boleh menambah SATU lapis kompleksitas dari fase sebelumnya.
2. **Field baru selalu flat, sederhana, reuse vocabulary yang sudah ada** — TIDAK ada
   structured JSONB dengan volume+satuan+geospasial+lifecycle-status di awal. Ikuti pola
   `businessFields: string[]` yang SUDAH terbukti (tag bebas + kurasi, bukan objek kompleks).
   Structured fields boleh menyusul HANYA setelah tag sederhana terbukti terisi organik.
3. **Tidak ada taksonomi ketiga** — kalau perlu kosakata lintas-domain, itu HARUS jadi
   perpanjangan/pemetaan dari 2 vocabulary yang sudah ada (`business-fields.ts`,
   `professional-types.ts`), bukan sistem independen baru.
4. **Tidak ada Trust Engine tanpa workflow eksplisit** — kalau verifikasi dibangun, harus
   sekaligus dengan UI ADMIN yang jelas siapa boleh set status apa, dan idealnya mulai dari
   BOOLEAN sederhana (`verifiedByAdmin: boolean`), bukan 4-tier enum, sampai ada bukti butuh
   granularitas lebih.
5. **Privasi TIDAK PERNAH di-override oleh status verifikasi** — badge terverifikasi hanya
   boleh ditambahkan DI SAMPING info yang SUDAH publik (sesuai toggle `is_*_public` yang ada),
   tidak pernah membuka data yang sengaja dikunci pemiliknya.
6. **Ikuti pola tenant-scoping direktori yang sudah established** — `INNER JOIN
   tenant_memberships WHERE tenantId=X AND status IN (active,alumni)`. Hub lintas-tenant adalah
   keputusan besar terpisah, bukan default.
7. **RFQ subsystem diperlakukan sebagai inisiatif fitur TERSENDIRI** (seperti Billing), bukan
   checkbox dalam rencana ekosistem — hanya dimulai kalau fase-fase awal menunjukkan permintaan
   nyata untuk itu.
8. **Setiap fase harus punya nilai berdiri sendiri** — bahkan kalau fase berikutnya tidak
   pernah dieksekusi, fase sebelumnya tetap harus memberi manfaat nyata ke pengguna (bukan
   infrastruktur murni yang baru berguna setelah fase lanjutan selesai).

---

## 5. Skenario Sinergi (Dipertahankan sebagai Ilustrasi — Realistis untuk Fase Mana)

Skenario dari draft awal tetap relevan sebagai ilustrasi TUJUAN AKHIR, dengan catatan realistis
fase mana yang benar-benar bisa mewujudkannya:

1. **Retailer kaos cari bahan kaos ke sesama Usaha** (skenario asli user) — **realistis di
   Fase 2** (§ 6.2): cukup filter tag `businessFields` lintas direktori Usaha, tidak perlu RFQ.
2. **Pesantren cari guru Bahasa Inggris atau konsultan legalitas** (skenario asli user) —
   **realistis di Fase 2**: filter tag "yang ditawarkan" di direktori Profesional, cross-link
   dari halaman Pesantren.
3. **Sinergi rantai pasok B2B skala besar dengan volume/lokasi presisi** (draft § 3.2 poin 1,
   lama) — **baru realistis di Fase 4+** (RFQ), butuh structured volume+geospasial yang belum
   dibangun.
4. **Berbagi aset menganggur (lahan, mesin)** (draft § 3.2 poin 4, lama) — **realistis di
   Fase 3**, sebagai tag sederhana ("Punya lahan kosong" sebagai salah satu `offeredTags`), TIDAK
   perlu sub-sistem `excessCapacity` terstruktur di awal.
5. **RFQ lelang pengadaan dengan auto-broadcast WA** (draft § 3.2 poin 5, lama) — **Fase 4+**,
   modul tersendiri, dieksekusi hanya jika ada bukti permintaan nyata dari Fase 2.

---

## 6. Rencana Eksekusi Revisi — Bertahap, Berbasis Fondasi Nyata

### Fase 0 — Prasyarat: Ukur Adopsi (SELESAI, 2026-07-29)
Sanity-check via query cepat terhadap DB lokal (bukan production — sesi ini tidak punya akses
SSH ke VPS):
```sql
SELECT count(*) AS total_aktif,
       count(*) FILTER (WHERE jsonb_array_length(business_fields) > 0) AS terisi,
       round(100.0 * count(*) FILTER (WHERE jsonb_array_length(business_fields) > 0)
             / NULLIF(count(*),0), 1) AS persen
FROM public.member_businesses WHERE is_active = true;
```
Hasil lokal: 12 entri aktif, 10 (83,3%) sudah punya `businessFields` terisi. **Ini data dev,
BUKAN bukti adopsi production** — tapi cukup meyakinkan bahwa fondasi kosakata (setidaknya di
lingkungan yang datanya representatif) tidak kosong, jadi lapis tag berikutnya masuk akal
dibangun sekarang. Query yang sama untuk PRODUCTION (jalankan via `docker compose exec -T
postgres psql -U jalakarta -d jalakarta -c "..."`) diserahkan ke user untuk verifikasi silang
kapan pun — TIDAK memblokir Fase 1, konsisten dengan keputusan "boleh dilewati sebagai risiko
yang diterima."

### Fase 1 — Lengkapi Fondasi Kosakata (Simetris di 3 Modul) — ✅ SELESAI (2026-07-29)
Tujuan: SETIAP modul (Usaha, Profesional, Pesantren) punya sepasang tag sederhana
`offeredTags: string[]` (apa yang bisa ditawarkan/dibagikan) dan `neededTags: string[]` (apa
yang sedang dicari/dibutuhkan) — POLA IDENTIK dengan `businessFields`, bukan objek terstruktur.

**Keputusan final (nama field + taksonomi)**: `offeredTags`/`neededTags`, seragam persis di
ketiga tabel (BUKAN `supplies`/`seeking` seperti sketsa awal `arsitektur-usaha.md` § 8 —
diselaraskan supaya query/API/komponen `<TagMultiSelect>` identik lintas modul). Suggestion
autocomplete dipusatkan di **`lib/ecosystem-tags.ts`** — isinya murni **aggregator flat `string[]`**.

> ⚠️ **Koreksi (2026-07-30, PAGI) — klaim taksonomi di paragraf ini sebelumnya menyesatkan,
> SEKARANG SUDAH DIEKSEKUSI (2026-07-30, SORE).** Temuan pagi: `lib/ecosystem-tags.ts` waktu itu
> HANYA berisi 9 item lama `business-fields.ts` + 15 tag cross-domain — taxonomy-gemini.md 0%
> terpakai. Keputusan user waktu itu: tunda integrasi sampai bersamaan dengan upgrade sektor
> § 9 `arsitektur-usaha.md`. **Sore harinya user memberi sinyal eksekusi** — lihat § 9 dokumen
> itu (status sekarang ✅ SELESAI): `lib/business-fields.ts`'s `BUSINESS_FIELD_SUGGESTIONS`
> SEKARANG berisi PENUH ~52 label Tier-3 dari taxonomy-gemini.md (bukan cuma 9 Kreatif lagi) —
> karena `ecosystem-tags.ts` men-spread array ini APA ADANYA (`[...BUSINESS_FIELD_SUGGESTIONS,
> ...ECOSYSTEM_CROSS_DOMAIN_SUGGESTIONS]`), integrasi taksonomi 10-sektor ke
> `ecosystem-tags.ts` OTOMATIS ikut jadi ~67 item TANPA perlu sentuh file `ecosystem-tags.ts`
> itu sendiri sama sekali — nol perubahan di file ini, murni efek dari upstream `business-fields.ts`
> yang jadi sumbernya.

- **Usaha**: `offeredTags`/`neededTags` ditambahkan ke `member_businesses`, reuse suggestion
  dari `lib/ecosystem-tags.ts` — SEKARANG mencakup penuh ~52 Tier-3 (lihat koreksi di atas +
  § 9 `arsitektur-usaha.md`), bukan lagi cuma 9 Kreatif. Field `businessFields`-nya sendiri juga
  dapat `getPrioritizedBusinessFields(sector)` (soft-prioritize, bukan hard-filter — § 9).
- **Profesional**: `offeredTags` (jasa konkret yang bisa dikerjakan, boleh lebih granular dari
  `professionType`+`specialization` yang sudah ada) + `neededTags` (opsional, proyek/klien yang
  dicari). TIDAK ada `skillTags` DAN `offeredServices` terpisah seperti draft — cukup SATU array
  flat per arah. **Tidak ada admin wizard/edit step untuk data Profesional** (dikonfirmasi via
  grep — beda dari Usaha/Pesantren yang punya `step4-business.tsx`/`step5-pesantren.tsx` di
  admin `members/[id]/edit`) — jadi field ini HANYA hidup di form self-service
  `/akun/profesional`, tidak ada "dual-update" untuk modul ini.
- **Pesantren**: `offeredTags` (mis. "Kelebihan Lahan", "Produk Santri untuk Dijual", "Aula
  untuk Disewa") + `neededTags` (mis. "Guru Bahasa Inggris", "Konsultan Legalitas Yayasan",
  "Pasokan Beras Rutin") — modul yang paling perlu perhatian karena mulai dari nol, kurasi awal
  vocabulary diambil dari kebutuhan riil yang sudah disebut user (guru, legalitas, pengadaan),
  masuk ke `lib/ecosystem-tags.ts` yang sama (bukan file kurasi terpisah lagi).
- **Migration**: SATU file, 3 tabel sekaligus (public schema, sekali jalan — bukan per-tenant
  loop, sama seperti migration `businessFields` sebelumnya).
- **UI**: reuse komponen `TagMultiSelect` yang SUDAH ADA (dipakai untuk `businessFields`) di
  form self-service (`/akun/usaha`, `/akun/profesional`, `/akun/pesantren`) DAN admin wizard
  (`step4-business.tsx` untuk Usaha, `step5-pesantren.tsx` untuk Pesantren — dual-update wajib
  di kedua tempat untuk 2 modul ini, sesuai konvensi project "setiap field anggota WAJIB
  konsisten di form self-service DAN admin").

**Hasil eksekusi**: schema (`packages/db/src/schema/public/member-{businesses,professionals,
owned-pesantren}.ts`) + migration `0053_ecosystem_offered_needed_tags.sql` (dijalankan+
diverifikasi lokal, termasuk round-trip insert/read empiris) + `lib/ecosystem-tags.ts` (baru) +
3 form self-service + 2 form admin wizard (Usaha, Pesantren) + 2 titik konstruksi admin
tambahan (`members/[id]/page.tsx`+`member-data-sections.tsx` untuk tampilan detail,
`members/[id]/edit/page.tsx` untuk Usaha) + 3 API route self-service + `saveMemberBusinessesAction`/
`saveMemberOwnedPesantrenAction` (`members/actions.ts`). `tsc --noEmit` 0 error di kedua package,
`bun run build --filter=@jalajogja/web` sukses genuine (dev server dimatikan+`.next` dibersihkan
+direstart). **Belum di-commit/push, belum dijalankan di VPS.** Fase 2 (filter pencarian
lintas-direktori) belum dimulai.

### Fase 2 — Pencarian Lintas-Direktori (TANPA hub baru, TANPA algoritma matching) — ✅ SELESAI (2026-07-29)
Tujuan: mewujudkan skenario konkret user (§ 5 poin 1-2) dengan build SEKECIL mungkin.

- Tambah filter "Cari berdasarkan yang ditawarkan/dibutuhkan" di 3 halaman direktori PUBLIK
  yang SUDAH ADA (`/usaha`, `/profesional`, `/pesantren`) — query sederhana `WHERE tag = ANY
  (offeredTags)` atau JSONB containment (`@>`), TIDAK perlu ranking algorithm, TIDAK perlu
  halaman baru.
- Widget kecil "Lihat kebutuhan/tawaran serupa di direktori lain" di halaman detail masing-
  masing entitas — cross-link statis berbasis tag-overlap sederhana (bukan matching engine),
  mengikuti pola tenant-scoping yang sudah established (§ 2.5).
- **TIDAK ada** halaman `/ekosistem` baru, **TIDAK ada** Smart Intent Selector, **TIDAK ada**
  matching API — semua di dalam infrastruktur direktori yang SUDAH ADA.
- Ini fase yang paling murah untuk memberikan nilai nyata dan bisa dieksekusi SEGERA begitu
  Fase 1 selesai, tanpa menunggu keputusan besar (Trust Engine, RFQ, privacy layer baru).

**Eksekusi selesai**: 2 komponen baru shared — `components/ekosistem/ecosystem-tag-filter.tsx`
(`EcosystemTagFilter`, dipakai di ketiga `*FiltersClient.tsx`: dropdown tag dari
`ECOSYSTEM_TAG_SUGGESTIONS` + toggle arah "Menawarkan"/"Membutuhkan", pakai `<Combobox>` sesuai
standar UI project — meski 3 filter select lain di file yang sama sudah lama pakai `<select>`
polos, pelanggaran pre-existing yang TIDAK diperbaiki retroaktif, di luar scope) dan
`components/ekosistem/tag-cross-links.tsx` (`EcosystemTagCrossLinks`, dipasang di ketiga halaman
detail — generate link "opposite intent": kalau entitas MENAWARKAN tag X, link ke pencarian
`?tag=X&arah=membutuhkan` di 2 direktori LAIN; kalau MEMBUTUHKAN tag X, link ke pencarian
`?tag=X&arah=menawarkan`; murni navigasi/generate-link, TIDAK ada query cross-module langsung di
halaman detail, TIDAK ada ranking).

Query filter pakai `sql`${column} @> ${JSON.stringify([tag])}::jsonb`` (Drizzle raw `sql` tag) —
diverifikasi empiris via disposable POC SEBELUM dipakai di kode produksi (match/non-match/
kolom-lain semua benar). **Ini operasi BERBEDA dari aturan lama "`inArray()`, jangan pernah
`sql`ANY()`"`** — aturan lama itu untuk kolom array Postgres native dibanding daftar kemungkinan
nilai; `@>` containment di sini untuk kolom JSONB array-of-string mengecek SATU elemen spesifik
di dalamnya, operasi yang sama sekali berbeda secara semantik dan sintaks.

Param URL: `tag` (nilai tag) + `arah` (`"menawarkan"|"membutuhkan"`, hanya di-serialize kalau
`tag` terisi, default `"menawarkan"`). Query condition: `arah==="membutuhkan"` cari di kolom
`neededTags`, selain itu (default) cari di `offeredTags` — jadi mencari "siapa MENAWARKAN X" itu
kondisi DEFAULT-nya. Ketiga list page (`usaha/page.tsx`, `profesional/page.tsx`,
`pesantren/page.tsx`) dan ketiga `*FiltersClient.tsx` dan ketiga halaman detail
(`[id]/page.tsx`) semuanya mengikuti pola identik — verifikasi `tsc --noEmit` per-modul (bukan
ditumpuk di akhir), 0 error di ketiganya, lalu `bun run build --filter=@jalajogja/web` genuine
(dev server dimatikan, `.next` dibersihkan, direstart setelah) mengonfirmasi ke-6 route (list+
detail × 3 modul) terdaftar di build output. **Di-commit+push (`f406745`).**

**Regresi ditemukan+diperbaiki (2026-07-31)**: sesi lain (di luar sesi yang menulis dokumen ini)
me-redesign layout ketiga halaman detail (`usaha/[id]`, `pesantren/[id]`, `profesional/[id]` —
commit lokal `44696f7`+`81d7f7f`+`03a125e`, belum di-push saat ditemukan) jadi struktur 2-kolom
sticky sidebar yang jauh lebih rapi — TAPI menghapus import+pemakaian `EcosystemTagCrossLinks`
di ketiganya tanpa penggantian, membuat komponen itu jadi dead code (nol importer di source,
cuma tersisa di build artifact lama). Audit menemukan ini saat diminta user cek konsistensi
halaman single lintas 3 modul. **Diperbaiki**: `EcosystemTagCrossLinks` diimpor+dirender ulang
di ketiga file, ditempatkan di kolom konten utama (bukan sidebar) — persis setelah blok
"Ekosistem Sinergi" (yang menampilkan `offeredTags`/`neededTags` milik entitas itu sendiri),
karena "Cari Sinergi" secara semantik adalah kelanjutan alami dari situ ("berikut yang
ditawarkan/dibutuhkan entitas ini — klik untuk cari yang komplemen di 2 direktori lain").
Diverifikasi EMPIRIS bukan cuma `tsc`: dicari record nyata di DB (forcreator, usaha "Bengkel
Mobil" dengan `offeredTags=["Bengkel Mobil","Pembukaan Cabang Bengkel Mobil"]`), di-curl
langsung, dikonfirmasi teks "Cari Sinergi" + tag + arah "membutuhkan" muncul di HTML, DAN link
cross-directory (`href="/forcreator/profesional?tag=...&arah=membutuhkan"`,
`href="/forcreator/pesantren?tag=...&arah=membutuhkan"`) terbentuk benar. Record TANPA tag
(kebanyakan record existing) dikonfirmasi widget `return null` (tidak tampil sama sekali,
bukan tampil kosong) — sesuai desain aslinya.

**Belum dijalankan/diverifikasi di VPS, belum diverifikasi visual di browser** (mengetik tag di
dropdown, klik cross-link, konfirmasi hasil filter benar-benar menyaring) — user perlu deploy ke
VPS lalu coba langsung.

### Fase 3 — Trust Badge Sederhana (HANYA jika Fase 1-2 menunjukkan adopsi organik)
- Satu kolom boolean `verifiedByAdmin: boolean` (BUKAN 4-tier enum) per tabel, dengan UI admin
  eksplisit (toggle di halaman detail member `/app/{slug}/members/{id}`, atau list terpisah
  kalau perlu bulk action) — sebelum kolom ini ditambahkan, harus sudah jelas SIAPA (pengurus
  tenant? platform admin?) yang berwenang menyalakannya.
- Badge ini HANYA ditampilkan di samping info yang SUDAH publik — tidak pernah membuka field
  yang di-gate oleh `is_*_public` toggle (§ 4 poin 5).

### Fase 4 — RFQ Subsystem (Inisiatif Terpisah, Dijadwalkan Sendiri)
Hanya dimulai kalau Fase 2 menunjukkan pola pencarian lintas-direktori yang cukup aktif untuk
membenarkan fitur "posting kebutuhan formal + lelang penawaran." Perlakukan sebagai proyek
sendiri dengan sesi perencanaan terpisah (skema, lifecycle, notifikasi) — jangan
digabung ke rencana ekosistem sebagai satu baris checklist.

### Fase 5 — Insight Dashboard & Notifikasi WA
Hanya setelah Fase 3-4 ada untuk menghasilkan sinyal yang layak ditampilkan
(`EcosystemInsightWidget` di `/akun`, notifikasi WA saat ada match/RFQ baru) — menambah
`WaNotifKey` baru + template baru di titik ini, bukan lebih awal.

---

## 7. Rancangan Awal (Draft Agen Lain) — Diarsipkan sebagai Referensi Visi, JANGAN Dieksekusi Langsung

> Bagian di bawah ini adalah isi draft ASLI sebelum dikritisi (§ 3). Dipertahankan sebagai
> referensi visi jangka panjang dan sumber ide (nama field, skenario, struktur privasi berlapis)
> — TAPI jangan diimplementasikan literal seperti tertulis. Setiap elemen di sini yang relevan
> sudah diserap ke bentuk yang lebih realistis di § 4 dan § 6, dengan alasan perubahan dirujuk ke
> nomor kritik § 3 yang sesuai.

### 7.1 Diagram Visi Awal

```
   ┌─────────────────────────────────────────────────────────┐
   │                     PULSE EKOSISTEM                     │
   │      (Trust Engine, RFQ System, Asset Sharing & Match)   │
   └──────────┬──────────────────┬──────────────────┬────────┘
              │                  │                  │
              ▼                  ▼                  ▼
    ┌──────────────────┐ ┌───────────────┐ ┌──────────────────┐
    │      USAHA       │ │  PROFESIONAL  │ │    PESANTREN     │
    │  (B2B & Supply)  │ │ (Talent/Jasa) │ │(Institusi/Pondok)│
    └──────────────────┘ └───────────────┘ └──────────────────┘
```

### 7.2 Tangga Sinergi Antar Entitas (Cross-Synergy Matrix — ide tetap valid, implementasi ditunda)

| Dari (Provider) | Ke (Target Consumer) | Bentuk Sinergi | Fase realistis |
|---|---|---|---|
| Profesional | Pesantren | Hiring Pengajar, Legal Advisor, Mentor | Fase 2 (tag sederhana) |
| Profesional | Usaha | Freelance Branding, Akuntan, Developer | Fase 2 (tag sederhana) |
| Usaha | Usaha (B2B) | Supply Chain, Maklon, Sisa Kapasitas | Fase 2 (tag) → Fase 4 (RFQ untuk volume besar) |
| Usaha | Pesantren | Pengadaan Lab, Seragam, Bahan Pangan Massal | Fase 2 (tag) → Fase 4 (RFQ untuk pengadaan formal) |
| Pesantren | Usaha/Publik | Distribusi Produk Santri, Sewa Aset | Fase 2 (tag) → Fase 3 (Trust Badge) |
| Pesantren | Profesional | Mentoring Alumni, Penyaluran Santri Magang | Fase 2 (tag) |

### 7.3 Field Kompleks yang Diusulkan Draft (JANGAN dibangun di Fase 1 — lihat § 3.1, § 3.3)

Skema `structuredSupplies`/`seekingSupplies`/`excessCapacity` (Usaha), `skillTags`/
`offeredServices`/`availabilityStatus`/`compensationSchemes`/`portfolioUrls` (Profesional), dan
`massConsumptions`/`neededProcurement`/`neededTalents`/`unitUsaha`/`idleAssets`/
`collaborationIntent` (Pesantren) — SEMUA field JSONB terstruktur dengan volume/satuan/
geospasial/lifecycle-status yang diusulkan draft asli — **ditunda ke Fase 4+ RFQ Subsystem**
(§ 6), bukan dibangun sebagai fondasi awal. Field flat sederhana di § 6 Fase 1
(`offeredTags`/`neededTags`) adalah pengganti yang jauh lebih murah untuk 90% skenario nyata
yang disebutkan user.

### 7.4 Trust Engine (4-tier) — lihat § 3.4, digantikan boolean sederhana di § 6 Fase 3

```
verificationStatus: "Unverified" | "Basic_Verified" | "Verified_Community" | "Official_Partner"
verifiedBy: uuid (ID pengurus/admin)
endorsementsCount: integer
```
Ide endorsement peer-to-peer (`endorsementsCount`) tetap menarik untuk fase yang jauh lebih
lanjut, tapi butuh mekanisme anti-abuse (siapa saja boleh endorse? berapa kali?) yang belum
dirancang sama sekali — di luar scope rencana ini.

### 7.5 Taksonomi Terpusat (`lib/ecosystem-tags.ts`) — lihat § 3.2, ditolak untuk Fase 1

```typescript
export interface TaxonomyCategory {
  id: string; domain: string; label: string; synonyms: string[];
}
```
Konsep sinonim/normalisasi tag ini tetap berguna JANGKA PANJANG (setelah `businessFields` dan
tag baru lain terisi cukup banyak dan pola duplikasi makna mulai terlihat nyata di data), tapi
membangunnya SEKARANG — sebelum ada data nyata untuk dianalisis polanya — berisiko salah tebak
sinonim yang relevan.

### 7.6 Privacy Berlapis (Viewer-Based) — lihat § 3.7, digantikan prinsip § 4 poin 5

```
LAYER 1 — PUBLIK: ringkasan tinggi + CTA "Ajukan Penawaran"
LAYER 2 — ANGGOTA TERVERIFIKASI: detail kuantitas + kontak WhatsApp langsung
```
Draft ini TIDAK BOLEH dieksekusi karena berpotensi membypass toggle `is_whatsapp_public` yang
pemilik data set sendiri. Kalau lapisan visibilitas tambahan memang dibutuhkan nanti, itu harus
jadi TOGGLE BARU yang pemilik data kontrol sendiri ("tampilkan detail volume ke sesama anggota
terverifikasi: ya/tidak"), bukan override otomatis berdasarkan status viewer.

### 7.7 Hub `/{slug}/ekosistem` + Smart Intent Selector — lihat § 3.5, ditunda ke Fase 4+

```
/{slug}/ekosistem               → Hub Sinergi Utama
/{slug}/ekosistem/penawaran     → Direktori Penawaran
/{slug}/ekosistem/kebutuhan     → Direktori Kebutuhan
/{slug}/ekosistem/rfq           → Sub-Sistem Lelang RFQ
/{slug}/ekosistem/aset-berbagi  → Direktori Berbagi Aset
```
Fase 2 (§ 6) mencapai TUJUAN yang sama (pencarian lintas-direktori) tanpa perlu route family
baru ini — kalau nanti volume penggunaan filter di Fase 2 menunjukkan orang benar-benar ingin
satu hub terpusat (bukan filter di masing-masing direktori), baru pertimbangkan hub ini sebagai
UI CONSOLIDATION di atas data yang sudah ada, bukan infrastruktur baru dari nol.

### 7.8 Skenario Ril Sinergi (dipertahankan penuh, sudah dipetakan ulang ke fase realistis di § 5)

1. **Rantai Pasok B2B & Belanja Massal Pesantren** — Pesantren A butuh 2 Ton Beras/bulan,
   Usaha B petani, Usaha C ekspedisi → volume besar & kepastian off-taker. *(Fase 4, RFQ)*
2. **Penyerapan Pasar & Konsinyasi Ritel** — Usaha D produsen Sabun Herbal, Pesantren E
   punya Kopontren → jadi channel distribusi konsinyasi. *(Fase 2, tag sederhana cukup untuk
   memulai kontak; skema konsinyasi formal di luar scope platform)*
3. **Talent & Vokasi** — Usaha F butuh QC Tekstil, Pesantren G punya SMK Tata Busana kurang
   standar, Profesional H expert tekstil mengajar. *(Fase 2, tag "mengajar/mentoring")*
4. **Berbagi Aset** — Pesantren I lahan menganggur 2 Ha, Usaha J agribisnis jamur butuh lahan.
   *(Fase 3, tag "punya aset menganggur" sebagai salah satu `offeredTags`)*
5. **Event-Driven RFQ** — Pesantren K lelang 50 laptop lab, broadcast ke distributor
   terverifikasi. *(Fase 4+ RFQ Subsystem, penuh)*

---

## 8. Ringkasan Perubahan Kunci dari Draft ke Revisi

| Aspek | Draft Awal | Revisi (Dokumen Ini) |
|---|---|---|
| Titik mulai | Trust Engine + RFQ + Hub sekaligus (Fase 1) | Tag sederhana 3 modul (Fase 1), pencarian lintas-direktori tanpa hub baru (Fase 2) |
| Skema field | JSONB terstruktur (volume+satuan+geospasial) sejak awal | Flat `string[]` sejak awal, structured menyusul di Fase 4+ jika terbukti perlu |
| Taksonomi | `lib/ecosystem-tags.ts` baru, taksonomi ketiga | Reuse `business-fields.ts`/`professional-types.ts` yang sudah ada |
| Verifikasi | 4-tier enum + endorsement counter | Boolean sederhana, HANYA dengan workflow admin eksplisit (Fase 3) |
| Privasi | Viewer-tiered, berpotensi bypass consent | Owner-controlled, tidak pernah override toggle existing |
| RFQ | Bagian dari "Fase 2" | Inisiatif terpisah (Fase 4+), dijadwalkan sendiri seperti Billing dulu |
| Hub `/ekosistem` | Route family baru dari awal | Ditunda — Fase 2 pakai direktori yang sudah ada |
| Pesantren | Lompat ke 7 field terstruktur | Mulai sama seperti Usaha/Profesional — 2 field flat |

---

## 9. Modul Admin: Ekosistem (2026-08-07)

> **PENTING — jangan disamakan dengan § 7's "Hub `/ekosistem`" (draft agen lain, publik, belum
> dieksekusi)**: modul yang dibangun di section ini adalah **halaman ADMIN dashboard**
> (`/app/{slug}/ekosistem/*`, di belakang login pengurus), bukan hub/route publik lintas-
> direktori untuk pengunjung umum. Dua konsep berbeda total yang kebetulan berbagi nama —
> "Ekosistem" di sini murni tempat KONFIGURASI, bukan fitur matchmaking baru.

### 9.1 Konteks

Setelah konsolidasi hardcode taksonomi Usaha (`docs/arsitektur-usaha.md` § 11), user membuka
diskusi baru: field Kategori/Sektor/Bidang Usaha di form Usaha cocok untuk tenant fokus-bisnis
(Forbis) tapi rancu untuk tenant lain (forum kreatif). 3 opsi didiskusikan (taksonomi baku +
hide/show per tenant, taksonomi custom penuh, label custom per tenant) — hybrid Opsi 1+3
direkomendasikan, Opsi 2 (taksonomi custom PENUH per tenant) DIHINDARI karena
`member_businesses` adalah data GLOBAL milik member (public schema), bisa muncul di direktori
BANYAK tenant sekaligus — taksonomi custom per tenant akan ambigu "taksonomi siapa yang
berlaku" saat record yang sama dilihat dari tenant lain.

**Toggle enable/disable + custom label per-tenant EKSPLISIT DITUNDA** ke diskusi lain oleh user
sendiri — belum ada rencana konkret untuk field-level toggle/label, baru dicatat sebagai ide
masa depan (lihat § 9.5). Yang DIEKSEKUSI sesi ini murni **infrastruktur rumahnya** — modul
admin baru untuk menampung config form Usaha/Pesantren/Profesional, plus relokasi toggle
on/off per-modul (fitur `docs/arsitektur-akun.md` § "Toggle Per-Tenant untuk Modul Ekosistem",
2026-08-01) yang sebelumnya numpang di `/settings/general`.

### 9.2 Keputusan — Nama + Struktur + Access Pattern

Usulan awal user: "form"/"formulir" sebagai nama modul. **Diganti "Ekosistem"** setelah
verifikasi kode — `lib/ekosistem-modules.ts` + `docs/arsitektur-ekosistem.md` (dokumen ini)
sudah jadi istilah baku internal untuk cluster Usaha/Pesantren/Profesional (26+ referensi),
sementara "Formulir"/"Form" ambigu di codebase yang sudah punya BANYAK konsep "form" tidak
terkait (form post, form event, form surat, custom field event dinamis) — nama "Ekosistem"
lebih jelas fungsinya buat admin dan konsisten dengan penamaan yang sudah ada.

**Struktur — mirror pola Toko/Event/Donasi** (bukan `/settings/*`): shell layout+sub-nav
sendiri (`components/toko/toko-nav.tsx` sebagai referensi PERSIS), karena user eksplisit
"salah satunya kita punya sub menu setting" — mengimplikasikan akan ada item sub-nav LAIN di
masa depan (bukan cuma satu halaman config tunggal).

**Access pattern — SENGAJA BUKAN sistem 10-modul permission** (`lib/permissions.ts`'s
`Module` type), melainkan pola sama `/settings/*` (`getTenantAccess()` polos, tanpa
`hasReadAccess(tenantUser, module)`). Alasan dipertimbangkan dan ditolak:
- Menambah `"ekosistem"` sebagai modul ke-11 di `Module` type akan MEMAKSA update
  `SYSTEM_PERMISSIONS` untuk 4 role sistem (owner/ketua/sekretaris/bendahara) sekaligus.
- `custom_roles.permissions` (JSONB, tidak ada fixed schema) — role custom EXISTING TIDAK
  PUNYA key `"ekosistem"` sama sekali, artinya mereka akan **diam-diam terkunci** dari akses
  sampai admin manual meng-grant — mengejutkan untuk fitur yang sebelumnya bisa mereka akses
  via `/settings/general` (yang tidak module-gated).
- Modul ini pada dasarnya bersifat KONFIGURASI (seperti Contact/Payment/Display di
  `/settings/*`), bukan modul operasional CRUD harian seperti Toko/Surat/Event — access
  pattern `/settings/*` (siapa pun `tenant.users`, guard write per-action via
  `canManageUsers()`) lebih tepat secara semantik, DAN lebih ringan (nol perubahan ke
  permission matrix).

Guard MUTASI (server action `saveEkosistemModulesAction`) tetap pakai `canManageUsers()` —
**level akses TIDAK berubah dari sebelumnya**, cuma dipindah rumahnya (sebelumnya di
`saveGeneralSettingsAction`, guard yang sama persis).

### 9.3 Struktur File (untuk memudahkan edit — lihat catatan di 9.5 untuk ide lanjutan)

```
app/(dashboard)/app/[tenant]/ekosistem/
├── layout.tsx              → shell: EkosistemNav (sub-nav kiri) + slot konten kanan.
│                               Guard: getTenantAccess() SAJA (bukan hasReadAccess module).
├── page.tsx                 → redirect ke /ekosistem/pengaturan
├── actions.ts                → saveEkosistemModulesAction() — TAMBAH action baru di sini
│                               untuk ide-ide config berikutnya, jangan file terpisah per fitur
│                               kecuali actions.ts mulai terlalu besar (>500 baris, pola project)
└── pengaturan/
    └── page.tsx              → Server Component: fetch getSettings(tenantDb,"ekosistem"),
                                  render <EkosistemPengaturanForm>

components/ekosistem/
├── ekosistem-nav.tsx          → sub-nav sidebar, TAMBAH entry baru di NAV_ITEMS array kalau
│                               ada sub-halaman baru (pola PERSIS components/toko/toko-nav.tsx)
└── ekosistem-pengaturan-form.tsx → client form, toggle 3 checkbox (ekstraksi murni dari
                                    GeneralSettingsForm lama, isi/perilaku tidak berubah)
```

**Nav utama dashboard** — `components/dashboard/sidebar-nav.tsx`'s `NAV_ITEMS`: entry baru
`{ label: "Ekosistem", icon: Boxes, path: "ekosistem", module: null }` (setelah "Akun",
sebelum "Media" — dekat modul terkait data anggota). `module: null` = selalu tampil di sidebar
untuk semua role, konsisten access pattern § 9.2 (sama seperti "Pengaturan").

**API existing yang TIDAK disentuh strukturnya, cuma 1 baris logic** — `GET /api/ekosistem/
modules` (`app/api/ekosistem/modules/route.ts`, dipakai `DirectoryEditor` section builder) —
sudah lama ada dari fitur toggle 2026-08-01, tetap di lokasi yang sama, cuma comment-nya
diperbarui (menunjuk lokasi settings BARU, bukan diubah logicnya — logic-nya sendiri otomatis
ikut berubah karena memanggil `getEnabledEkosistemModules()` yang sekarang baca group baru).

### 9.4 Storage — Group Settings Baru `"ekosistem"`

Sebelumnya `usaha_enabled`/`pesantren_enabled`/`profesional_enabled` disimpan di
`tenant.settings` group `"general"` (grup umum, dipakai `site_name`/`logo_url`/dst — jadi
config ekosistem "numpang" di grup yang tidak terkait). Dipindah ke group **`"ekosistem"`**
baru — genuinely butuh migration (BEDA dari `member_businesses.sector`'s Drizzle enum hint
yang cuma type-level, lihat `docs/arsitektur-usaha.md` § 11) karena `settings.group` PUNYA
CHECK constraint DB sungguhan.

**3 titik wajib disentuh bersamaan** (pola berulang di project ini untuk `SETTING_GROUPS`
baru — lihat precedent `0031_settings_group_event.sql`/`0042_settings_group_forum.sql`):
1. `packages/db/src/schema/tenant/settings.ts`'s `SETTING_GROUPS` array (+ `"ekosistem"`).
2. `packages/db/src/helpers/create-tenant-schema.ts`'s DDL `CHECK ("group" IN (...))` —
   supaya tenant BARU otomatis dapat constraint yang benar tanpa migration susulan.
3. Migration SQL baru `packages/db/migrations/0061_settings_group_ekosistem.sql` — `DO $$
   LOOP` per tenant existing aktif, `DROP`+`ADD CONSTRAINT`. **Ditambah langkah defensif**:
   `INSERT ... SELECT ... WHERE "group"='general' ON CONFLICT DO NOTHING` untuk menyalin
   (bukan memindahkan — baris lama di `general` dibiarkan, sudah tidak dibaca lagi) 3 key ini
   ke group baru KALAU KEBETULAN ada tenant yang sudah pernah menyimpannya. Diverifikasi
   kosong di kedua tenant lokal (`forcreator`, `pc-ikpm-jogjakarta`) sebelum migration
   ditulis — langkah ini murni jaga-jaga untuk kemungkinan data production yang tidak bisa
   dicek dari sesi ini.

**Satu-satunya titik kode yang perlu tahu perubahan group ini**: `getEnabledEkosistemModules()`
(`lib/ekosistem-modules.server.ts`) — `getSettings(tenantClient, "general")` diganti
`getSettings(tenantClient, "ekosistem")`. Karena fungsi ini adalah SATU-SATUNYA choke point
yang benar-benar fetch dari DB (`resolveEkosistemModulesConfig()` di `lib/ekosistem-
modules.ts` murni pure function, terima raw settings dari caller) — ~20 caller lain di seluruh
app (self-service nav, admin dashboard, direktori publik, section builder, `checkMember
Eligibility`, dst — daftar lengkap di `docs/arsitektur-akun.md` § "Toggle Per-Tenant untuk
Modul Ekosistem") **TIDAK PERLU disentuh sama sekali**.

### 9.5 Ide Lanjutan (BELUM Direncanakan — Menunggu User)

User eksplisit: "banyak sudah ide saya untuk form ini bisa dikembangkan dan tetap ringan..
nanti saya sampaikan berikutnya." Modul ini SENGAJA dibangun minimal (1 sub-halaman:
Pengaturan) supaya siap menampung ide berikutnya tanpa restrukturisasi — kandidat yang SUDAH
disebut dalam diskusi (belum didesain, jangan dieksekusi tanpa konfirmasi ulang):
- **Toggle show/hide per OPSI** dalam field Kategori/Sektor (bukan cuma on/off seluruh modul)
  — Opsi 1 dari diskusi awal, precedent pola: `lib/ekosistem-modules.ts`'s
  `resolveEkosistemModulesConfig()` (JSONB boolean per-item, bukan hapus data).
- **Label custom per tenant** untuk field yang sama (Opsi 3) — field DB tetap
  `category`/`sector`/`businessFields`, cuma teks LABEL yang ditampilkan ke tenant berbeda.

> **Kedua ide di atas SEKARANG DIEKSEKUSI — lihat § 10 "Taksonomi Override" di bawah.**

### 9.6 Verifikasi

`tsc --noEmit` 0 error di `apps/web` DAN `packages/db` + `bun run build --filter=@jalajogja/web`
genuine sukses (`Cached: 0 cached`, 48.2 detik, dev server dimatikan+`.next` dibersihkan+
direstart) — 3 route baru terkonfirmasi compile bersih: `/app/[tenant]/ekosistem`,
`/app/[tenant]/ekosistem/pengaturan`, plus `/app/[tenant]/settings/general` (diperkecil, toggle
dihapus). Migration `0061` dijalankan+diverifikasi di lokal (`\d` mengonfirmasi `'ekosistem'`
masuk CHECK constraint kedua tenant). Grep akhir `usahaEnabled|pesantrenEnabled|
profesionalEnabled` di seluruh `apps/web` — nol sisa referensi di luar 3 file modul Ekosistem
yang baru. **Belum di-commit/push, belum dijalankan di VPS, belum diverifikasi visual di
browser** — user perlu coba: buka `/app/{slug}/ekosistem` (harus redirect ke `/pengaturan`),
toggle salah satu modul lalu simpan, konfirmasi efeknya sama seperti toggle lama (cek `/akun`,
direktori publik, section builder) — DAN konfirmasi `/settings/general` tidak lagi menampilkan
toggle (blok itu sudah dihapus dari form, digantikan catatan penunjuk).

### 9.7 Susulan (2026-08-07): Label Custom Nama Modul (Usaha/Pesantren/Profesional)

> Diminta user setelah § 10 (Taksonomi Override) selesai: *"sepertinya kita juga bagus kalau
> membuat text 'Usaha', 'Pesantren' dan 'Profesional' juga bisa diubah text-nya saja, alias
> labelnya saja, sama persis dengan text 'kategori' tetapi default-nya tetap sama. settingnya
> ada dilaman: /app/forcreator/ekosistem/pengaturan"*

**Beda dari § 10 — dua sistem override yang TERPISAH, jangan dicampur**: § 10's
`TaxonomyOverrides.fieldLabels` mengubah label FIELD DI DALAM form Usaha ("Kategori"→"Jenis
Karya", dst — hanya relevan kalau modul Usaha aktif). Fitur ini mengubah nama MODUL itu
sendiri — kata "Usaha"/"Pesantren"/"Profesional" yang muncul di nav, judul halaman, tombol,
breadcrumb — berlaku independen dari isi form Usaha, dan setting-nya sengaja diletakkan di
halaman `/ekosistem/pengaturan` (bukan `/ekosistem/taksonomi`) karena satu tempat dengan toggle
enable/disable modul yang sudah ada di § 9, bukan sub-halaman taksonomi terpisah.

**API (`lib/ekosistem-modules.ts`, pure, sudah lama client-safe sejak § 9)**:
```typescript
export type EkosistemModuleLabels = Partial<Record<EkosistemModule, string>>;

export function resolveEkosistemModuleLabel(
  module: EkosistemModule,
  overrides: EkosistemModuleLabels,
): string {
  return overrides[module] || EKOSISTEM_MODULE_LABELS[module]; // fallback default kanonik
}

export function resolveEkosistemModuleLabels(raw: Record<string, unknown>): EkosistemModuleLabels {
  // baca raw.module_labels (JSONB), guard tipe per-key, trim, buang string kosong
}
```
`lib/ekosistem-modules.server.ts` dapat fungsi baru `getEkosistemModuleLabels(tenantClient)` —
SENGAJA fungsi terpisah dari `getEnabledEkosistemModules()` (bukan digabung ke return-nya),
supaya ~20 caller LAMA yang cuma butuh boolean gate tidak perlu disentuh sama sekali. Caller
yang butuh KEDUANYA (enabled + label) memanggil `getSettings` dua kali via `Promise.all` — biaya
kecil (satu SELECT ringan tambahan per group), pola sama `getTaxonomyOverrides()` di § 10 yang
juga hidup terpisah.

**Storage**: key BARU `module_labels` di group `tenant.settings` `"ekosistem"` yang SUDAH ADA
sejak § 9 (`saveEkosistemModuleLabelsAction`, `ekosistem/actions.ts`) — key TERPISAH dari
`usaha_enabled`/`pesantren_enabled`/`profesional_enabled` (bukan menimpa config boolean). **Nol
migrasi DB** — JSONB, sudah ditulis satu form dengan toggle enable/disable
(`EkosistemPengaturanForm`, satu tombol Simpan memanggil `saveEkosistemModulesAction` DAN
`saveEkosistemModuleLabelsAction` bersamaan). Default: field kosong/tidak diisi = pakai label
kanonik "Usaha"/"Pesantren"/"Profesional" — perilaku SEBELUM fitur ini ada TIDAK BERUBAH sama
sekali untuk tenant yang tidak pernah menyentuh setting baru ini.

**Tier-1 (dalam scope) — permukaan yang menyebut nama MODUL secara langsung ke pengguna**,
di-thread sebagai prop `moduleLabel`/`moduleLabels` (opsional dengan default literal string di
tiap komponen, backward-compatible untuk caller yang belum di-update):
- **Arsip publik** — `usaha/page.tsx`/`pesantren/page.tsx`/`profesional/page.tsx`: H1 "Direktori
  {moduleLabel}".
- **Detail publik** — `usaha/[id]/page.tsx`/`pesantren/[id]/page.tsx`/`profesional/[id]/
  page.tsx`: breadcrumb "Kembali ke Direktori {moduleLabel}", heading "Informasi {moduleLabel}",
  "Hubungi {moduleLabel}", "Profil & Deskripsi {moduleLabel}" (usaha only).
- **Self-service** — `akun/usaha/usaha-client.tsx` + `akun/pesantren/pesantren-client.tsx` +
  `akun/profesional/profesional-client.tsx` (masing-masing dapat prop `moduleLabel: string`
  WAJIB, bukan opsional — parent page.tsx selalu menyediakan): breadcrumb, tombol "Tambah
  {moduleLabel}"/"Edit {moduleLabel}", pesan sukses simpan, empty-state, header kolom tabel
  "Nama {moduleLabel}".
- **`/gabung`** — `MEMBER_ELIGIBILITY_LABELS.directory` (konstanta statis, tidak tenant-aware)
  diganti branch dinamis: kalau `field==="directory"` DAN modul yang belum lengkap sudah
  teridentifikasi (`eligibility.directoryIncompleteModule`), bangun pesan
  `` `Data ${resolveEkosistemModuleLabel(...)} Anda (belum lengkap)` ``; kalau belum ada modul
  yang mulai diisi, bangun daftar gabungan `enabledModulesArr.map(resolveEkosistemModuleLabel)
  .join(" / ")`.
- **Profil publik anggota** (`anggota/[id]/page.tsx`) — 3 `<Section title=...>` (Pesantren/
  Usaha & Bisnis/Profesional) + 3 link "Edit Data {moduleLabel}" di bawah halaman.
- **Admin dashboard** — `member-edit-shell.tsx` (tab "Data {usahaLabel}", label dihitung SEKALI
  lalu di-reuse untuk tab DAN prop `<Step4Business>`), `step4-business.tsx`/`step5-pesantren.tsx`
  (tombol "Tambah Data {moduleLabel}", back-link, header kartu per-entry "{moduleLabel} #N",
  prefix pesan validasi multi-entry "{moduleLabel} ke-N: "), `member-data-sections.tsx`'s
  `BusinessSection`/`PesantrenSection` (section header, empty-state, dialog title — TIDAK ADA
  `ProfessionalSection`, modul Profesional tidak punya admin CRUD).
- **Statistik** — `statistik-sections.tsx`'s 3 `<SectionTitle title="Statistik {moduleLabel}">`,
  dipakai bersama oleh halaman publik `/{slug}/statistik` DAN kedua halaman drill-down IKPM
  Pusat (`ringkasan-tenant/page.tsx` + `ringkasan-tenant/[targetSlug]/page.tsx`).

**Tier-2 (di luar scope, sengaja tidak disentuh)** — dicek eksplisit via grep sweep terakhir,
bukan terlewat tanpa sadar:
- SEO `<title>`/`metaTitle` fallback (`generateMetadata` di halaman arsip/detail publik) — sudah
  punya sistem override sendiri (`docs/arsitektur-seo.md` § "Halaman Admin Baru — `/settings/
  seo`"), tidak perlu campur tangan fitur ini.
- Label FIELD di dalam form self-service/admin ("Nama Usaha", "Logo Usaha", "Foto Sampul
  Usaha", "Identitas Usaha"/"Skala Usaha"/"Alamat Usaha"/"Kontak Usaha" section headers,
  "Identitas Pesantren", "Foto Pesantren") — bagian dari § 10's sistem (kalau nanti diperluas)
  atau murni label field internal yang tidak strategis diubah (risiko diminishing-returns:
  puluhan titik kecil untuk manfaat visual marjinal).
- ~11 pesan error validasi per-field di `step4-business.tsx` (mis. "Sektor wajib dipilih.") —
  hanya PREFIX-nya ("{moduleLabel} ke-N: ") yang di-dinamis-kan, isi pesan tetap generik.
  `step5-pesantren.tsx` dikonfirmasi TIDAK punya pola prefix serupa (grep, nol hasil).
  `DetailDialog`'s fallback nama entry (`|| "Data Profesional"` di `profesional-client.tsx`) —
  scope komponen berbeda dari edit-view yang sudah menerima `moduleLabel`, tidak di-thread.
- `components/ui/public-link-icon.tsx` — registry lookup ikon berbasis string key, bukan teks
  yang tampil ke pengguna.

**2 bug ditemukan+difix sendiri selama eksekusi (bukan dari laporan user)**:
1. **Variable redeclaration** — `pesantren/[id]/page.tsx` dan `profesional/[id]/page.tsx`
   masing-masing punya DUA `const tenantClient = createTenantDb(slug);` di scope fungsi yang
   sama (satu lama untuk `getPublicNavMenu`, satu baru untuk fetch `moduleLabels`) — ditemukan
   PROAKTIF via grep SEBELUM `tsc` dijalankan, difix dengan menghapus deklarasi kedua dan
   reuse yang pertama. `usaha/[id]/page.tsx` tidak kena (sudah cuma 1 deklarasi sejak awal).
2. **Grammar bug di subtitle `/statistik`** — draf pertama salah menempatkan `tenant.name` di
   slot grammatikal yang seharusnya diisi label modul terakhir ("profesional"), diam-diam
   menghilangkan kata itu dari kalimat. Ditemukan sendiri saat menulis (bukan dari `tsc`, murni
   isi string) — diperbaiki jadi daftar koma Indonesia yang benar (`"a, b, dan c"`) sebelum
   `tenant.name` ditambahkan terpisah.

**Verifikasi**: `tsc --noEmit` bersih di `apps/web` di 8 checkpoint terpisah sepanjang eksekusi
(per kelompok file — arsip publik, detail publik, self-service, `/gabung`, profil anggota,
admin dashboard, statistik — bukan ditumpuk ke akhir). `bun run build --filter=@jalajogja/web`
genuine sukses (dev server dimatikan port 6202, `.next` dibersihkan, `Cached: 0 cached`, 51.9
detik, dev server direstart, curl 200 OK). Grep sweep akhir mengonfirmasi seluruh literal
"Usaha"/"Pesantren"/"Profesional" yang tersisa tak tersentuh SEMUA masuk kategori Tier-2 di
atas — tidak ada yang terlewat tanpa alasan. Nol migrasi DB. **Belum di-commit/push ke git,
belum dijalankan di VPS, belum diverifikasi visual di browser** — user perlu coba: ubah label
"Usaha" jadi custom (mis. "Bisnis") di `/ekosistem/pengaturan`, konfirmasi berubah di seluruh
titik Tier-1 di atas (nav self-service, arsip+detail publik, admin wizard, statistik, `/gabung`)
sementara field DI DALAM form Usaha (Kategori/Sektor/Nama Usaha) tetap memakai teks aslinya.

---

## 10. Taksonomi Override: Label Kategori/Sektor/Bidang Usaha + Toggle Sektor +
Custom Bidang Usaha (2026-08-07) — ✅ SELESAI (2026-08-07)

> Sub-halaman KEDUA modul Ekosistem — `/app/{slug}/ekosistem/taksonomi`, sejajar
> `/app/{slug}/ekosistem/pengaturan` (§ 9). Menutup ide yang dicatat di § 9.5.

### 10.1 Ruang Lingkup (dikonfirmasi eksplisit dengan user)

User: *"saya ingin ada pengaturan label untuk ketiga: kategori, sector dan bidang usaha,
kemudian toggle untuk aktifkan sector usaha dan tambah juga edit bidang usaha."* Dipecah per
field:

| Field | Label custom | Toggle enable/disable | Tambah item baru |
|---|---|---|---|
| **Kategori** (7 item, lihat § 10.8) | ✅ | ✅ (susulan § 10.8) | ❌ — tapi kanonik BISA diperluas GLOBAL oleh developer tanpa migrasi (bukti: "Praktisi"/"Akademisi", § 10.8), bukan per-tenant custom seperti Bidang Usaha |
| **Sektor** (10 item) | ✅ | ✅ | ❌ (tidak diminta — sektor terikat `SECTOR_SUB_FIELDS`, terlalu berisiko untuk ditambah bebas per tenant) |
| **Bidang Usaha** (~59 item) | ✅ (HANYA di tampilan display, lihat § 10.2) | — (tidak relevan, ini creatable tag list, bukan closed set) | ✅ — WAJIB pilih Sektor induk saat menambah (susulan § 10.9), soft-prioritize sama seperti item kanonik, BUKAN pemilikan eksklusif |

> **Catatan (2026-08-07)**: tabel di atas mencerminkan status AWAL fitur ini. Kolom Kategori
> sudah diupdate menyusul permintaan lanjutan user — lihat § 10.8 untuk toggle Kategori dan
> penambahan kanonik "Praktisi"/"Akademisi", dan § 10.9 untuk perbaikan mekanisme tambah Bidang
> Usaha jadi sektor-scoped. **Dimensi KEEMPAT yang tabel ini TIDAK cakup**: nama FIELD itu
> sendiri (judul "Kategori"/"Sektor"/"Bidang Usaha" di form) — kini JUGA bisa diganti, berlaku
> SAMA untuk ketiga field ini sekaligus, lihat § 10.9.

**Prinsip keamanan yang dikonfirmasi user**: *"yes perubahan hanya di label"* — SELURUH fitur
ini TIDAK PERNAH mengubah nilai (`value`) yang tersimpan di `member_businesses.category`/
`.sector`/`.businessFields[]`. Yang berubah HANYA teks yang ditampilkan (`label`). Ini prinsip
yang SAMA dengan yang sudah dikunci sejak diskusi awal "hindari Opsi 2 (taksonomi custom
penuh)" (§ 9.1) — `member_businesses` adalah data GLOBAL, kalau nilai literal ikut berubah per
tenant, filter/pencarian lintas-tenant (Fase 2 § 6, JSONB containment match) akan pecah dan
data antar-tenant jadi tidak konsisten.

**Default = perilaku sekarang** (user: *"default tetap seperti sekarang, tetapi label
tersebut bisa diubah"*) — tanpa override tersimpan, SEMUA field menampilkan label kanonik
persis seperti sebelum fitur ini ada. Nol migrasi data, nol perubahan visual untuk tenant yang
belum pernah membuka halaman pengaturan taksonomi.

### 10.2 Keterbatasan Teknis yang Ditemukan — Kenapa Bidang Usaha Beda dari Kategori/Sektor

`Kategori`/`Sektor` dipilih lewat `Combobox`/`SimpleCombobox` — komponen ini SUDAH mendukung
`{value, label}[]` (value tersimpan, label ditampilkan berbeda) sejak awal dibuat. Override
label untuk keduanya AMAN diterapkan di picker (dropdown pilihan) MAUPUN di badge/display.

`Bidang Usaha` dipilih lewat `TagMultiSelect` (`components/ui/tag-multi-select.tsx`) —
komponen creatable-tag INI HANYA menerima `options: string[]`, TIDAK ADA pemisahan value/label
sama sekali (string yang tampil di dropdown = string yang tersimpan kalau dipilih). Mengubah
komponen generik ini ke `{value,label}[]` berisiko merusak 4 pemakai LAIN yang tidak butuh
override (`offeredTags`/`neededTags` di Usaha/Profesional/Pesantren — Fase 1 Ekosistem, § 6).

**Keputusan (scope sengaja dipersempit, bukan kelupaan)**: untuk Bidang Usaha, override label
**HANYA berlaku di tampilan read-only** (badge/pill yang menampilkan businessField yang SUDAH
dipilih — publik `/usaha`, `/usaha/[id]`, self-service `/akun/usaha`, admin detail anggota).
**Picker (`TagMultiSelect` saat memilih/menambah)** TETAP menampilkan label kanonik apa
adanya — konsisten dengan sifatnya sebagai search/creatable tool, bukan surface "branding".
Item BARU yang ditambahkan tenant (`customBusinessFields`) tidak butuh override sama sekali —
teks yang tenant ketik SUDAH jadi label yang mereka inginkan.

### 10.3 Storage

Key baru di `tenant.settings` group **`"ekosistem"`** (group yang sama dari § 9, NOL migrasi
tambahan — grup sudah ada), key `"taxonomy_overrides"`, JSONB:

```ts
type TaxonomyOverrides = {
  categoryLabels?:       Partial<Record<BusinessCategory, string>>;  // override label Kategori
  sectorLabels?:         Partial<Record<BusinessSector, string>>;    // override label Sektor
  sectorEnabled?:        Partial<Record<BusinessSector, boolean>>;   // default true (key absen = aktif)
  businessFieldLabels?:  Record<string, string>;                     // override label Bidang Usaha (display-only, § 10.2)
  customBusinessFields?: string[];                                    // Bidang Usaha tambahan milik tenant (additive)
};
```

Semua field OPSIONAL — objek kosong `{}` = perilaku default (identik sebelum fitur ini ada).

### 10.4 File Baru

```
lib/taxonomy-overrides.ts          → PURE, client-safe (ZERO import @jalajogja/db):
                                       resolveCategoryLabel/Options, resolveSectorLabel/Options
                                       (options difilter sectorEnabled), resolveBusinessField
                                       Label, resolveBusinessFieldSuggestions (canonical +
                                       customBusinessFields, TANPA override label — § 10.2)
lib/taxonomy-overrides.server.ts   → import "server-only": getTaxonomyOverrides(tenantClient)
                                       — satu-satunya titik yang genuinely getSettings() dari DB,
                                       pola SAMA getEnabledEkosistemModules() (§ 9.4)

app/(dashboard)/app/[tenant]/ekosistem/taksonomi/page.tsx   → Server Component, fetch overrides
components/ekosistem/ekosistem-taksonomi-form.tsx           → client form, 3 section
```

`ekosistem/actions.ts` (existing, § 9) ditambah `saveTaxonomyOverridesAction(slug, overrides)`
— guard `canManageUsers()` (sama seperti `saveEkosistemModulesAction`).
`components/ekosistem/ekosistem-nav.tsx` ditambah item sub-nav kedua "Taksonomi Usaha".

### 10.5 Titik Konsumsi yang Diperluas (thread `TaxonomyOverrides` sebagai prop)

Prasyarat kenapa ini SEKARANG murah dikerjakan (dibanding kalau dikerjakan sebelum sesi
konsolidasi hardcode § 11 `docs/arsitektur-usaha.md`): SETIAP field (Kategori/Sektor/Bidang
Usaha) kini punya TEPAT SATU sumber kanonik (`business-form-options.ts`/`business-sectors.ts`/
`business-fields.ts`) — menerapkan override cukup dilakukan SEKALI di layer resolver baru ini,
tidak perlu menyentuh ulang 8 titik lama satu-satu untuk logic override-nya sendiri (cuma
perlu di-THREAD sebagai prop sampai ke titik render).

**Publik**: `usaha/page.tsx` (fetch + resolve filter options untuk `usaha-filters-client.tsx`
+ badge arsip) → `usaha-filters-client.tsx` (terima `sektorOptions`/`kategoriOptions` sebagai
prop, BUKAN import const langsung lagi) → `usaha/[id]/page.tsx` (fetch overrides sendiri,
halaman detail, resolve badge/InfoRow).

**Self-service**: `akun/usaha/page.tsx` (server wrapper, sudah ada — fetch overrides bareng
`enabledModules` yang sudah difetch di situ) → `usaha-client.tsx` (prop baru
`taxonomyOverrides`, dipakai untuk picker Kategori/Sektor + suggestion Bidang Usaha (+custom)
+ label badge daftar/detail).

**Admin**: `step4-business.tsx` (`Step4Props`+`BusinessCard` dapat prop
`taxonomyOverrides?: TaxonomyOverrides`, default `{}`) — dipakai KEDUA titik pemanggil:
`member-edit-shell.tsx`→`members/[id]/edit/page.tsx` (fetch overrides), DAN
`member-data-sections.tsx`'s `BusinessSection`→`members/[id]/page.tsx` (fetch overrides,
SEKALIAN dipakai untuk resolve `<Row value={biz.category}>`/`<Row value={biz.sector}>` yang
sudah ada di file yang sama — co-located, murah).

**SENGAJA TIDAK disentuh** (dicatat eksplisit, konsisten pola project ini): halaman review
Excel import (`members/import/import-client.tsx`) tetap tampilkan nilai kanonik mentah — layar
internal admin untuk verifikasi data import, bukan surface presentasi ke anggota/publik,
prioritas rendah untuk polish label.

### 10.6 Verifikasi

`tsc --noEmit` kedua package + `bun run build --filter=@jalajogja/web` genuine (dev server
dimatikan+`.next` dibersihkan+direstart) di akhir eksekusi. Nol migrasi DB (key JSONB baru di
group yang sudah ada). Belum diverifikasi visual di browser — user perlu coba: ubah label
Sektor "Kreatif"→custom di `/ekosistem/taksonomi`, cek muncul di picker+badge `/akun/usaha`
DAN `/usaha` publik; matikan satu Sektor, cek hilang dari picker tapi entri lama yang sudah
pakai sektor itu tetap tampil normal; tambah Bidang Usaha custom, cek muncul sebagai
suggestion di `TagMultiSelect`.

### 10.7 Status Implementasi — SELESAI

Semua titik § 10.5 sudah di-wire persis sesuai rencana. Satu refinement ditemukan+ditutup SAAT
eksekusi (bukan direncanakan di § 10.3, tapi SUDAH diantisipasi di checklist § 10.6 di atas):
`resolveSectorOptions(overrides, currentValue?)` — parameter kedua opsional. Tanpa ini,
`Combobox`/`SimpleCombobox` akan tampil BLANK (bukan menunjukkan sektor tersimpan) untuk entri
usaha lama begitu admin menonaktifkan sektor yang kebetulan sudah dipakai entri itu — karena
`Combobox` mencari `options.find(o => o.value === value)`, dan sektor yang di-disable hilang
dari `options`. Fix: kalau `currentValue` diisi dan ternyata sudah tidak ada di opsi aktif,
sektor itu tetap disisipkan ke hasil (dengan label ter-override kalau ada) — supaya "usaha yang
sudah pakai sektor itu tetap tampil normal" (janji teks bantuan form) benar-benar terpenuhi di
PICKER, bukan cuma di tampilan read-only.

File yang disentuh (final, 9 file di luar 4 file baru § 10.4):
`usaha/page.tsx`, `usaha-filters-client.tsx`, `usaha/[id]/page.tsx` (publik) —
`akun/usaha/page.tsx`, `usaha-client.tsx` (self-service) —
`step4-business.tsx`, `member-edit-shell.tsx`, `members/[id]/edit/page.tsx`,
`member-data-sections.tsx`, `members/[id]/page.tsx` (admin).

`tsc --noEmit` 0 error di `apps/web` DAN `packages/db`. `bun run build --filter=@jalajogja/web`
genuine sukses (`Cached: 0 cached, 1 total`, dev server dimatikan+`.next` dibersihkan sebelum
build, direstart sesudah) — `/app/[tenant]/ekosistem/taksonomi` (4.47 kB) dan seluruh route
`/app/[tenant]/members/*`/`/app/[tenant]/usaha`-family terkonfirmasi compile bersih di build
output. Grep akhir `CATEGORY_COMBOBOX_OPTIONS|SECTOR_COMBOBOX_OPTIONS|getPrioritizedBusinessFields`
di seluruh `apps/web` (di luar `lib/`) — nol hasil, semua consumer sudah migrasi ke resolver.
**Belum di-commit/push ke git, belum dijalankan di VPS** (nol migrasi DB dibutuhkan — deploy
cukup `git pull && bun run build --filter=@jalajogja/web && pm2 restart jalajogja
--update-env`), **belum diverifikasi visual di browser** — checklist manual di § 10.6 di atas
masih perlu dicoba user.

### 10.8 Susulan (2026-08-07): Toggle Kategori + Kategori Baru "Praktisi"/"Akademisi" —
✅ SELESAI

Menyusul § 10.7, user bertanya eksploratif: *"btw emang kategori gk bisa ditambah sama
sekali?"* — dijawab: SECARA TEKNIS bisa (kolom `public.member_businesses.category` adalah
`text` polos TANPA CHECK constraint DB, cuma TypeScript enum hint di `apps/web`), tapi belum
ada mekanisme UI untuk itu seperti Bidang Usaha (`customBusinessFields`). User lalu minta
konkret: *"saya ingin kategori bisa di toggle (diaktifkan dan di non aktifkan) dan
ditambahkan: Praktisi dan Akademisi."*

Dua permintaan terpisah, dieksekusi bersamaan:

**(a) Toggle per-item Kategori** — MIRROR PERSIS mekanisme `sectorEnabled` yang sudah ada,
bukan pola baru:
- `TaxonomyOverrides` (`lib/taxonomy-overrides.ts`) diperluas `categoryEnabled?:
  Partial<Record<BusinessCategory, boolean>>` — semantik identik `sectorEnabled` (key absen =
  aktif, default `true`, backward-compat penuh).
- `resolveCategoryOptions(overrides, currentValue?)` ditulis ulang total, sekarang IDENTIK
  STRUKTUR dengan `resolveSectorOptions` — filter berdasar `categoryEnabled`, lalu (refinement
  § 10.7 yang sudah ada untuk Sektor, sekarang diterapkan sama untuk Kategori) sisipkan balik
  `currentValue` kalau sudah ter-disable, supaya `Combobox` tidak blank untuk entri usaha lama
  yang kategorinya kebetulan baru dinonaktifkan admin.
- `ekosistem-taksonomi-form.tsx` — section "Kategori" ditulis ulang menampilkan checkbox
  toggle + input label per item (persis section "Sektor" di bawahnya), state `categoryEnabled`
  ditambah ke `FormState`, `toPayload()` menggunakan helper `onlyDisabled()` yang di-generalisasi
  (sebelumnya `disabledOnly` lokal khusus Sektor) — dipakai untuk KEDUA field sekarang.
- **Semua caller `resolveCategoryOptions()` diupdate meneruskan `currentValue`**
  (`usaha-client.tsx`'s `EntryEditForm`, `step4-business.tsx`'s `BusinessCard` — keduanya kirim
  `entry.category` sebagai argumen kedua, mirror pola `resolveSectorOptions(overrides,
  entry.sector)` yang sudah ada di file yang sama). **Pengecualian yang DISENGAJA**:
  `usaha/page.tsx` (arsip publik, membangun opsi FILTER dropdown — bukan mengedit satu entitas
  spesifik, jadi tidak ada `currentValue` yang relevan) TETAP memanggil
  `resolveCategoryOptions(taxonomyOverrides)` tanpa argumen kedua, konsisten dengan bagaimana
  `resolveSectorOptions` juga dipanggil tanpa `currentValue` di file yang sama.

**(b) Kategori baru "Praktisi" dan "Akademisi"** — ditambahkan sebagai perluasan GLOBAL/kanonik
(berlaku SEMUA tenant), BUKAN sebagai custom per-tenant seperti Bidang Usaha — konsisten pola
yang sudah dipakai saat "Kreatif" ditambahkan ke Sektor (`docs/arsitektur-usaha.md` § 9 —
lihat juga preseden serupa untuk kategori Profesi di `docs/arsitektur-profesional.md` § 14/15):
- `BUSINESS_CATEGORY_ENUM` (`lib/business-form-options.ts`) diperluas dari 5 jadi 7 nilai:
  `["Jasa","Produsen","Distributor","Trading","Profesional","Praktisi","Akademisi"]`.
  `CATEGORY_COMBOBOX_OPTIONS` otomatis ikut lebar (di-derive dari array itu, kode tidak
  disentuh). Tenant yang tidak relevan cukup nonaktifkan lewat toggle (a) — bukan dihapus.
- **Bug ditemukan+difix**: memperluas enum di `apps/web` SENDIRIAN menghasilkan 3 error
  `tsc --noEmit` (`members/actions.ts`, `usaha/page.tsx`, `api/akun/member-business/route.ts`)
  — root cause: `packages/db/src/schema/public/member-businesses.ts`'s `category` field masih
  mendeklarasikan Drizzle `enum` hint LAMA (5 nilai), tidak sinkron dengan `apps/web`. Ini
  BUKAN CHECK constraint DB sungguhan (dikonfirmasi lewat grep migrations) — murni type hint
  TypeScript yang harus dijaga manual sinkron KARENA `packages/db` tidak bisa import dari
  `apps/web` (arah dependency monorepo terbalik). Pola ini SUDAH terdokumentasi eksplisit di
  komentar `sector` field di file yang sama sejak upgrade taksonomi Sektor (§ 9
  `docs/arsitektur-usaha.md`) — cuma belum pernah dites ulang untuk `category` sampai sekarang.
  Fix: array enum `category` di `packages/db/src/schema/public/member-businesses.ts`
  diupdate manual jadi 7 nilai yang sama persis, dengan komentar eksplisit menjelaskan
  kewajiban sinkron manual ini. `tsc --noEmit` 0 error setelahnya di kedua package.

**Aturan yang ditegaskan (generalisasi)**: setiap kali sebuah enum kanonik `apps/web` yang
punya kembaran Drizzle `enum` hint di `packages/db` diperluas, WAJIB cek dan update kembarannya
di `packages/db` DI GILIRAN YANG SAMA — jangan tunggu `tsc` menangkapnya sebagai "kejutan",
karena error yang muncul (mis. "Type '"Praktisi"' is not assignable...") tidak langsung
menunjuk ke root cause sesungguhnya (dua file yang harus disinkronkan manual), butuh
investigasi tambahan untuk disadari.

**Verifikasi**: `tsc --noEmit` bersih di `apps/web` DAN `packages/db` (0 error, dicek dari
direktori yang benar via `pwd` untuk menghindari kesalahan cwd). `bun run build
--filter=@jalajogja/web` genuine (dev server dimatikan di port 6202, `.next` dibersihkan, build
`Cached: 0 cached, 1 total`, 47.36 detik, dev server direstart, `curl` 200 OK) — route
`/app/[tenant]/ekosistem/taksonomi` terkonfirmasi ter-build ulang tanpa error. Nol migrasi DB
tambahan (kolom `category` sudah `text` polos sejak awal, tidak ada CHECK constraint yang perlu
di-`ALTER`). **Belum di-commit/push ke git, belum dijalankan di VPS, belum diverifikasi visual
di browser** — user perlu coba: buka `/ekosistem/taksonomi`, konfirmasi 7 baris Kategori
tampil (termasuk Praktisi/Akademisi) masing-masing dengan checkbox toggle; matikan satu
Kategori (mis. "Trading"), cek hilang dari picker `/akun/usaha` dan admin wizard tapi entri
lama yang sudah pakai kategori itu tetap tampil normal (tidak blank); pilih Kategori
"Praktisi"/"Akademisi" untuk entri usaha baru, konfirmasi tersimpan dan tampil benar di badge
publik `/usaha`.

### 10.9 Susulan Kedua (2026-08-07): Bidang Usaha Sektor-Scoped + Nama Field Sendiri —
✅ SELESAI

Menyusul § 10.8, user mengoreksi 2 kesalahtafsiran atas permintaan awal § 10.1 — kutipan
verbatim: *"yang gue tahu sektor dengan bidang usaha itu hirarkikal.. yg gue maksud adalah:
misal: bidang kreatif, gue bisa tambah misal bidang usahanya musik, vokalis, gitu lho.. ini kok
malah bidang usaha jadi diganti labelnya.. kayanya kamu salah tafsir tentang label yang gue
maksud yg justru gk ada, untuk sektor udah benar bisa tambah dan ada aktifkan dan non aktifkan
juga ada label.. itu benar. tp yg gue tahu dari awal bahwa sektor dan bidang itu hirarki..
kedua, yg gue maksud dari label kategori juga, itu text 'kategorinya' dan juga berarti text
'Sektor' dan 'bidang usaha' ini yg blm ada."*

**Koreksi #1 — Bidang Usaha tambah baru harus sektor-scoped, bukan global flat.** Fitur
"Tambah Bidang Usaha Baru" (§ 10.4) sebelumnya menyimpan item custom sebagai `string[]` global
tanpa asosiasi sektor sama sekali. User: contoh "Sektor Kreatif → tambah Musik, Vokalis"
artinya item baru harus DIPILIH Sektor induknya saat ditambahkan — persis mekanisme YANG SUDAH
ADA untuk ~59 Bidang Usaha bawaan (`SECTOR_SUB_FIELDS: Record<BusinessSector, string[]>` di
`lib/business-sectors.ts`, dipakai `getPrioritizedBusinessFields()` untuk soft-prioritize
saran per sektor terpilih — BUKAN filter eksklusif, item tetap muncul untuk sektor lain, cuma
tidak didahulukan). Ini BUKAN pembalikan prinsip § 2-3 `docs/arsitektur-usaha.md` ("facet
independen, jangan sub-sektor eksklusif") — prinsip itu soal DATA member (`member_businesses.
businessFields` tetap `string[]` flat, member bebas pilih apa saja terlepas sektor mereka),
bukan soal mekanisme SARAN/prioritas yang memang SUDAH hirarkis-lunak sejak awal untuk item
kanonik. Perluasan ini murni menyamakan perlakuan item CUSTOM dengan item KANONIK.

**Fix**: `TaxonomyOverrides.customBusinessFields` diubah TIPE dari `string[]` jadi
`Partial<Record<BusinessSector, string[]>>` (mirror struktur `SECTOR_SUB_FIELDS` persis).
`resolveBusinessFieldSuggestions(sector, overrides)` ditulis ulang: item custom milik sektor
TERPILIH digabung ke barisan "prioritized" (bareng Tier-3 kanonik sektor itu), item custom
milik sektor LAIN tetap disertakan di posisi belakang (non-exclusive, `Set` dedup mencegah
duplikat kalau ada tumpang tindih string). **Diverifikasi EMPIRIS** (disposable script,
dihapus setelah) terhadap kasus `customBusinessFields = {Kreatif: ["Musik","Vokalis"],
"Teknologi & Informasi": ["Coding Bootcamp"]}`: `sector="Kreatif"` → Musik+Vokalis di posisi
0-1 (paling depan), "Coding Bootcamp" tetap ada tapi di posisi 61/62 (paling belakang, TIDAK
hilang); `sector="Teknologi & Informasi"` → "Coding Bootcamp" di posisi 0, "Musik" tetap ada di
posisi 60/62; `sector=null` → tidak ada prioritas, semua 62 item hadir; nol duplikat di semua
kasus.

Form pengaturan (`ekosistem-taksonomi-form.tsx`) "Tambah Bidang Usaha Baru" ditulis ulang:
`<Combobox>` (opsi `SECTOR_COMBOBOX_OPTIONS` dari `lib/business-sectors.ts`, WAJIB dipilih
sebelum item bisa ditambah — konsisten aturan project "semua dropdown wajib Combobox") + input
teks nama item + tombol Tambah. Daftar item custom existing sekarang dikelompokkan PER SEKTOR
(heading nama sektor + chip item di bawahnya per sektor, bukan satu daftar flat), tombol hapus
tetap per-item.

**Koreksi #2 — Nama FIELD itu sendiri belum bisa diganti.** Permintaan awal user
("pengaturan label untuk ketiga: kategori, sector dan bidang usaha") ternyata BUKAN cuma
override label per-ITEM (yang sudah dibangun § 10.3-10.8) — TERMASUK JUGA kemampuan mengganti
teks JUDUL FIELD itu sendiri (mis. rename judul field "Sektor" jadi "Jenis Karya", "Bidang
Usaha" jadi "Spesialisasi") — dua konsep beda: label per-pilihan (existing) vs nama field
(baru).

**Fix**: `TaxonomyOverrides` dapat properti baru `fieldLabels?: {category?, sector?,
businessFields?}` (default masing-masing "Kategori"/"Sektor"/"Bidang Usaha") + resolver baru
`resolveFieldLabel(field, overrides)`. Section baru "Nama Field (Opsional)" ditambahkan di
PALING ATAS form pengaturan taksonomi (3 input teks, sebelum section Kategori). **9 titik
render diupdate** menggunakan `resolveFieldLabel()` menggantikan literal string "Kategori"/
"Sektor"/"Bidang Usaha": `usaha-client.tsx` (3× `<Field label>` form, 2× `<th>` table header,
2× pesan validasi "X wajib dipilih"), `step4-business.tsx` (2× `<SimpleCombobox label>`, 1×
`<span>` statis Bidang Usaha), `usaha/[id]/page.tsx` publik detail (2× `<InfoRow label>`, 1×
`<h2>` heading), `member-data-sections.tsx` admin detail (3× `<Row label>`), `usaha/page.tsx`
arsip publik (3× teks placeholder "Semua X"). **SENGAJA TIDAK disentuh**: `app/api/members/
import/template/route.ts` (header kolom Excel bulk-import — alat internal admin, bukan surface
presentasi, DAN mengubahnya berisiko tidak sinkron dengan parser `import-anggota-mapping.ts`
yang mengharapkan nama kolom tetap) — konsisten keputusan lama untuk halaman review Excel
import di § 10.5.

**Verifikasi**: `tsc --noEmit` bersih di `apps/web` DAN `packages/db` di SETIAP tahap (bukan
ditumpuk — dicek setelah rewrite `lib/taxonomy-overrides.ts`, lagi setelah rewrite form, lagi
setelah semua 5 file consumer diupdate). `bun run build --filter=@jalajogja/web` genuine
sukses (dev server dimatikan port 6202, `.next` dibersihkan, `Cached: 0 cached, 1 total`,
46.98 detik, dev server direstart, `curl` 200 OK). Grep menyeluruh `"Kategori"|"Sektor"|
"Bidang Usaha"` di seluruh `apps/web` mengonfirmasi nol sisa literal yang relevan di luar
file yang disengaja tidak disentuh (nav item modul lain seperti Toko/Dokumen/Donasi/Event yang
punya "Kategori" konsep BERBEDA, dan Excel template). Nol migrasi DB (perubahan bentuk
`customBusinessFields` dan `fieldLabels` baru sama-sama field JSONB opsional di key
`taxonomy_overrides` yang sudah ada — kosong = perilaku default persis sebelum fitur ini).
**Belum di-commit/push ke git, belum dijalankan di VPS, belum diverifikasi visual di browser**
— user perlu coba: di `/ekosistem/taksonomi`, tambah Bidang Usaha baru dengan pilih Sektor
"Kreatif" dulu (mis. "Musik"), konfirmasi muncul PALING ATAS saat pilih Sektor Kreatif di form
Usaha tapi tetap muncul (di bawah) saat Sektor lain dipilih; isi "Nama Field" Sektor jadi
"Jenis Karya", konfirmasi berubah di SEMUA titik (form self-service+admin, filter arsip,
detail publik+admin) tanpa mengubah label per-item Sektor yang sudah dikustomisasi sebelumnya.

### 10.10 Susulan Ketiga (2026-08-07): Tambah Sektor Baru — ✅ SELESAI

Langsung menyusul § 10.9, giliran yang sama. User: *"selain bidang usaha, sektor jg bisa
ditambah bro tadi sudah benar.."* — Sektor SEHARUSNYA juga punya kapabilitas "tambah baru"
self-service per-tenant, persis mekanisme yang baru dibangun untuk Bidang Usaha di § 10.9 —
sebelumnya `/ekosistem/taksonomi` HANYA bisa toggle-aktif+relabel 10 Sektor KANONIK yang sudah
di-hardcode di kode (`BUSINESS_SECTOR_ENUM`), tanpa cara menambah Sektor yang genuinely BARU
tanpa perlu saya (Claude) menulis kode+migration setiap kali (pola yang dipakai untuk
"Kreatif"/"Praktisi"/"Akademisi" — perluasan GLOBAL, § 9 `docs/arsitektur-usaha.md` dan § 10.8
di atas).

**Kelayakan teknis dikonfirmasi dulu** (bukan diasumsikan): `member_businesses.sector`
adalah kolom `text` TANPA CHECK constraint DB (dikonfirmasi lesson `[2026-07-30]` "Upgrade
Taksonomi Sektor Usaha" — migrasi lama murni `UPDATE` data, bukan DDL) — menyimpan string
sektor arbitrary aman di level database. `getPrioritizedBusinessFields(sector)` (`lib/
business-sectors.ts`) sudah menangani sektor tak dikenal secara graceful (`!(sector in
SECTOR_SUB_FIELDS) → return all`, tanpa prioritas) — sektor custom otomatis tidak crash, cuma
tidak dapat prioritas Tier-3 kanonik (memang tidak relevan, mereka dapat prioritas dari
`customBusinessFields` sendiri kalau diisi). 4 titik lain yang pakai tipe `BusinessSector`
(`usaha-client.tsx`, `usaha/page.tsx`, `member-business/route.ts`, `members/actions.ts`)
SEMUA cuma memakainya sebagai `as BusinessSector` — TYPE ASSERTION murni untuk cocok
Drizzle `enum` hint TypeScript-only di `packages/db` (bukan runtime guard) — nol perubahan
diperlukan, assertion tetap aman menerima string apa pun saat runtime.

**Fix**: `TaxonomyOverrides` dapat `customSectors?: string[]` baru — string bebas, value=label
sekaligus (TIDAK ada override label terpisah untuk sektor custom — nama yang diketik admin
SUDAH jadi tampilan finalnya, ganti dengan hapus+tambah ulang, sama seperti pola item custom
Bidang Usaha). `resolveSectorOptions(overrides, currentValue?)` ditulis ulang — gabung opsi
kanonik (existing logic, filter `sectorEnabled`) dengan `customSectors` (mapped `{value,
label:value}`, dedup terhadap kanonik). `currentValue` fallback DIPERLUAS mencakup 2 kasus:
sektor kanonik yang baru di-disable (sudah ada sejak § 10.5) DAN sektor custom yang sudah
DIHAPUS tenant dari daftar (baru) — kedua kasus sama-sama tersisip balik ke hasil supaya
Combobox tidak blank untuk entri lama.

`customBusinessFields` (§ 10.9) diperluas keyingnya dari `Partial<Record<BusinessSector,
string[]>>` jadi `Partial<Record<string, string[]>>` — supaya Sektor CUSTOM juga bisa jadi
induk untuk "Tambah Bidang Usaha Baru", bukan cuma 10 Sektor kanonik. `resolveBusiness
FieldSuggestions()` disesuaikan (`customMap[sector]` langsung, tanpa cast `as BusinessSector`
yang sekarang tidak perlu lagi karena key sudah `string`).

**Diverifikasi EMPIRIS** (disposable script, dihapus setelah) terhadap `customSectors:
["Riset & Inovasi", "Kuliner Halal Premium"]` + `sectorEnabled: {"Pertanian...": false}` +
`customBusinessFields: {"Kreatif": [...], "Riset & Inovasi": ["Lab Riset","Konsultan
Paten"]}`: `resolveSectorOptions()` → 11 opsi (9 kanonik aktif + 2 custom, "Pertanian..."
genuinely hilang dari opsi picker); fallback `currentValue` untuk sektor custom yang sudah
dihapus dari daftar → tetap disisipkan balik dengan value=label sama; `resolveBusinessField
Suggestions("Riset & Inovasi", ...)` → "Lab Riset"+"Konsultan Paten" di posisi 0-1, total 63
item (59 kanonik + 2 sektor ini di depan + 2 "Musik"/"Vokalis" milik sektor lain tetap ada di
belakang), nol duplikat (`Set` size = length).

Form pengaturan (`ekosistem-taksonomi-form.tsx`) — section BARU "Tambah Sektor Baru" ditaruh
setelah section "Label & Aktivasi Sektor" (10 kanonik), sebelum "Tambah Bidang Usaha Baru":
input teks + tombol Tambah (cek duplikat terhadap kanonik+custom existing, mirror validasi
`addCustomBidang`), list chip Sektor custom existing dengan tombol hapus per-item — SENGAJA
TANPA toggle enable/disable atau relabel terpisah untuk item custom (beda dari 10 kanonik):
menghapus SUDAH setara menonaktifkan (tidak lagi ditawarkan sebagai opsi baru, tapi entri lama
tetap tampil normal via fallback `currentValue`), dan relabel-nya cukup hapus+ketik ulang
karena tidak ada "nilai kanonik vs label" terpisah untuk item yang mereka ketik sendiri. Sektor
custom yang sudah DIHAPUS dari daftar TIDAK cascade-menghapus Bidang Usaha custom yang sudah
terlanjur dikaitkan ke sektor itu (`customBusinessFields[sektorLama]` tetap tersimpan apa
adanya) — item itu tetap muncul sebagai saran untuk SEMUA sektor lain (bukan "hilang", murni
tidak lagi diprioritaskan untuk sektor manapun) — konsisten prinsip "data tidak pernah hilang
diam-diam" yang sudah dikunci di § 9 (toggle modul ekosistem). Picker "Tambah Bidang Usaha
Baru" (`<Combobox options={...}>`) diperluas: `SECTOR_COMBOBOX_OPTIONS` (10 kanonik) DIGABUNG
`state.customSectors` (live dari form yang sedang diedit, BUKAN dari `defaultOverrides` yang
sudah tersimpan — admin bisa tambah Sektor lalu langsung tambah Bidang Usaha di bawahnya di
sesi edit yang sama SEBELUM klik Simpan). Iterasi list "Bidang Usaha custom dikelompokkan per
Sektor" diubah dari `BUSINESS_SECTOR_ENUM.map(...)` (HANYA 10 kanonik — bug laten: Bidang
Usaha yang dikaitkan ke Sektor custom TIDAK AKAN PERNAH tampil di list ini) jadi
`Object.entries(state.customBusinessFields).map(...)` (semua kunci yang genuinely punya item,
kanonik maupun custom).

**Verifikasi**: `tsc --noEmit` bersih di `apps/web` DAN `packages/db` (percobaan pertama, nol
error setelah edit 2 file: `lib/taxonomy-overrides.ts` + `ekosistem-taksonomi-form.tsx`).
`bun run build --filter=@jalajogja/web` genuine sukses (dev server dimatikan port 6202, `.next`
dibersihkan, `Cached: 0 cached, 1 total`, 49.34 detik, dev server direstart, `curl` 200 OK) —
route `/ekosistem/taksonomi` naik 4.47 kB → 6.47 kB (section baru), terkonfirmasi compile
bersih di build output. Nol migrasi DB (field JSONB baru di key `taxonomy_overrides` yang sudah
ada). **Belum di-commit/push ke git, belum dijalankan di VPS, belum diverifikasi visual di
browser** — user perlu coba: tambah Sektor baru (mis. "Riset & Inovasi") di `/ekosistem/
taksonomi`, konfirmasi langsung muncul sebagai opsi di picker Sektor form Usaha (self-service
`/akun/usaha` DAN admin wizard) dan sebagai pilihan induk "Tambah Bidang Usaha Baru"; tambah
Bidang Usaha di bawah Sektor custom itu, konfirmasi tersimpan+tampil terprioritaskan saat
Sektor custom itu dipilih; hapus Sektor custom dari daftar, konfirmasi entri usaha LAMA yang
sudah pakai sektor itu tetap tampil normal (tidak blank) di form edit.
