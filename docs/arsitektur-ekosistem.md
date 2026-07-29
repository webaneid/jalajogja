# Arsitektur Ekosistem Sinergi Anggota — Interkoneksi Usaha, Profesional & Pesantren

> **Status: 🔴 DRAFT AWAL DIKRITISI TOTAL (2026-07-29) — Rencana Eksekusi Ditulis Ulang, Bertahap, Berbasis Fondasi Nyata**
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
autocomplete dipusatkan di **`lib/ecosystem-tags.ts`** (baru) — TAPI file ini bukan taksonomi
independen ketiga seperti yang dikritik § 3.2: isinya murni **aggregator flat `string[]`** yang
di-*seed* dari `BUSINESS_FIELD_SUGGESTIONS` (`lib/business-fields.ts`) + tambahan kebutuhan
lintas-domain yang belum tercakup vocabulary manapun (mis. "Guru Bahasa Inggris", "Konsultan
Legalitas Yayasan", "Pengadaan Beras/Sembako", "Kelebihan Lahan/Aset Menganggur") — TIDAK ada
`categoryId`/synonym-mapping/struktur objek seperti draft asli. Tetap konsisten Prinsip §4 poin 3
("perpanjangan dari vocabulary yang sudah ada, bukan sistem independen baru").

- **Usaha**: `offeredTags`/`neededTags` ditambahkan ke `member_businesses`, reuse suggestion
  dari `lib/ecosystem-tags.ts` (yang sudah mengandung seluruh isi `BUSINESS_FIELD_SUGGESTIONS`).
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

### Fase 2 — Pencarian Lintas-Direktori (TANPA hub baru, TANPA algoritma matching)
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
