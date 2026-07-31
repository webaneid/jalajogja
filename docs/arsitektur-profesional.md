# Arsitektur Data Profesional — jalakarta

> **Status: 📋 PERENCANAAN SELESAI, SIAP EKSEKUSI — belum diimplementasikan.**
> Semua keputusan desain sudah dikunci (lihat § 12), termasuk struktur 3 level kategori/jenis/spesialisasi
> (§ 2.4–2.5) hasil diskusi 2026-07-12. Tinggal eksekusi sesuai urutan di § 13.

> **Dokumen terkait:**
> - `docs/arsitektur-medialibrary.md` — Member Media Library (`CoverImageField`, `MemberMediaPicker`)
> - `docs/arsitektur-pesantren.md` — pola `member_owned_pesantren` yang direplikasi di sini
> - `docs/arsitektur-direktori-publik.md` — pola direktori publik (Anggota/Pesantren/Usaha) yang direplikasi
> - `docs/arsitektur-kontak.md` — aturan phone/WA (`PhoneInput`, `normalizePhone`, `displayPhone`)

---

## 1. Konsep Utama

Anggota IKPM Gontor punya beragam jenis kontribusi profesional di luar "punya usaha"
(`member_businesses`) dan "punya/kelola pesantren" (`member_owned_pesantren`): dokter,
pengacara, konsultan, akuntan, arsitek, insinyur, dosen, dst. Data ini **belum punya rumah** —
saat ini hanya ada `members.profession_id` (satu tag umum, dipakai di statistik & profil dasar).

**Kenapa tidak cukup pakai `members.profession_id` saja:**
- Cuma satu nilai flat (misal "Dokter") — tidak ada ruang untuk spesialisasi ("Dokter Spesialis
  Anak"), nomor izin praktik (STR/No. Advokat), institusi tempat bekerja, atau tahun mulai praktik
- Tidak bisa jadi entri direktori publik yang bisa dicari/difilter (beda tujuan — `profession_id`
  untuk tag ringkas di profil, bukan listing "cari dokter alumni IKPM di Yogyakarta")

**Kenapa tidak cukup numpang di `member_businesses` (category="Profesional"):**
- `member_businesses` didesain untuk **usaha** — field seperti `revenue`, `employees`, `branches`,
  `legality` (PT/CV/Yayasan) tidak relevan untuk profesional yang **berkarir sebagai karyawan**
  (dokter di RSUD, associate di firma hukum, dosen PNS) — mereka bukan pemilik usaha
- Semantik "usaha" memaksa framing "saya punya bisnis", padahal banyak profesional justru bekerja
  untuk institusi orang lain

**Keputusan**: entitas baru `public.member_professionals` — **pola identik** dengan
`member_businesses` dan `member_owned_pesantren` (satu row per entri, self-reported, helper FK
opsional ke `contacts`/`addresses`/`social_medias`). Anggota bisa punya 0, 1, atau banyak entri
(dokter yang juga buka usaha bisa isi keduanya: satu `member_professionals` untuk kredensial medis,
satu `member_businesses` untuk klinik jika berbadan usaha).

**`members.profession_id` TIDAK dihapus/diubah** — tetap tag ringkas di profil dasar & statistik.
Dua sistem ini melayani tujuan berbeda dan boleh tidak sinkron (member isi profesi umum di Step 1
wizard, lalu opsional lengkapi detail profesional di `/akun/profesional` seperti pola pesantren/usaha).

---

## 2. Riset BPS RI — Klasifikasi Baku Jenis/Jabatan Indonesia (KBJI)

**Sumber acuan resmi**: KBJI 2014, diterbitkan BPS, mengadopsi struktur **ISCO-08**
(International Standard Classification of Occupations 2008, terbitan ILO). Ini adalah standar
klasifikasi pekerjaan nasional yang dipakai BPS untuk Sakernas (Survei Angkatan Kerja Nasional)
dan sensus — sumber paling otoritatif untuk taksonomi pekerjaan di Indonesia.

### 2.1 Struktur Hierarkis KBJI 2014

```
Golongan Pokok    (1 digit)  — 10 kategori besar
  └─ Subgolongan Pokok (2 digit) — 43 total
       └─ Golongan     (3 digit) — 130 total
            └─ Subgolongan (4 digit) — 446 total (paling rinci)
```

### 2.2 Sepuluh Golongan Pokok (Level 1)

| Kode | Golongan Pokok |
|------|-----------------|
| 0 | TNI dan POLRI |
| 1 | Manajer (Pejabat Lembaga, Legislatif, Pejabat Tinggi dan Manajer) |
| **2** | **Profesional** |
| 3 | Teknisi dan Asisten Profesional |
| 4 | Tenaga Tata Usaha |
| 5 | Tenaga Usaha Jasa dan Tenaga Penjualan |
| 6 | Pekerja Terampil Pertanian, Kehutanan, dan Perikanan |
| 7 | Pekerja Pengolahan, Kerajinan, dan YBDI |
| 8 | Operator dan Perakit Mesin |
| 9 | Pekerja Kasar |

**Golongan Pokok 2 "Profesional"** adalah scope yang relevan untuk fitur ini — deskripsi resminya:
pekerjaan yang tugasnya terkait **pengembangan dan penerapan konsep pengetahuan ilmiah dan
praktis** (dokter, pengacara, akuntan, insinyur, dosen, dll). Golongan Pokok 3 ("Teknisi dan
Asisten Profesional") sengaja dipisah oleh BPS — **di luar scope** fitur ini (level keahlian
lebih rendah, misal teknisi lab, asisten paramedis).

### 2.3 Enam Subgolongan Pokok di Bawah "Profesional" (mengikuti struktur ISCO-08)

KBJI 2014 eksplisit mengikuti struktur ISCO-08 (dikonfirmasi BPS sendiri), sehingga 6
subgolongan pokok di bawah Golongan Pokok 2 mengikuti pembagian internasional ini:

| Kode | Subgolongan Pokok (ISCO-08 asli) | Terjemahan konteks Indonesia |
|------|-----------------------------------|-------------------------------|
| 21 | Science and Engineering Professionals | Sains, Teknik & Rekayasa (insinyur, arsitek, ilmuwan) |
| 22 | Health Professionals | Kesehatan (dokter, dokter gigi, apoteker, dokter hewan) |
| 23 | Teaching Professionals | Pendidikan & Akademik (dosen, guru, peneliti) |
| 24 | Business and Administration Professionals | Bisnis, Keuangan & Manajemen (akuntan, analis keuangan) |
| 25 | Information and Communications Technology Professionals | Teknologi Informasi (developer, analis sistem) |
| 26 | Legal, Social and Cultural Professionals | Hukum, Sosial & Budaya (pengacara, notaris, jurnalis, psikolog) |

> ⚠️ **Catatan akurasi**: kode 3–4 digit paling rinci (mis. kode spesifik untuk "Dokter" atau
> "Advokat") tidak berhasil diverifikasi dari dokumen PDF resmi BPS saat riset ini dibuat (file
> terenkripsi/tidak bisa di-parse). Tabel di atas berdasarkan struktur ISCO-08 yang **dikonfirmasi
> BPS sendiri sebagai basis KBJI 2014** (sumber: ppid.bps.go.id, sirusa.bps.go.id) — cukup solid
> untuk keperluan kategorisasi di level aplikasi ini, tapi **bukan salinan literal** dokumen KBJI.
> Jika suatu saat perlu kode resmi 4 digit (misal untuk pelaporan ke instansi), unduh PDF asli dari
> `sirusa.bps.go.id` atau `ppid.bps.go.id` dan verifikasi manual — jangan andalkan tabel ini sebagai
> sumber legal/resmi.

### 2.4 Keputusan Desain: 3 Level, Bukan Replikasi Penuh 446 Entri

446 subgolongan level-4 KBJI **jauh berlebihan** untuk platform alumni. Tapi lumping kasar juga
salah — feedback eksplisit dari diskusi (2026-07-12): **"Pengacara" dan "Notaris" itu dua profesi
berbeda, begitu juga "Dokter" vs "Perawat" vs "Bidan", "Akuntan" vs "Konsultan"** — semua ini
memang profesi terpisah secara KBJI (masing-masing punya kode Golongan 3-digit sendiri), jangan
disatukan seperti `ref_professions` yang melumpingnya jadi "Dokter / Tenaga Kesehatan" dsb.

**Keputusan: struktur 3 level**, bukan 2 level seperti draf awal:

1. **`professionCategory`** (enum, 7 nilai — 6 subgolongan pokok KBJI Golongan 2 + "Lainnya") —
   dropdown wajib, level paling kasar, dipakai untuk filter utama direktori publik & statistik
2. **`professionType`** (teks, wajib) — **jenis profesi spesifik** setingkat Golongan KBJI (3-digit),
   mis. "Dokter", "Perawat", "Bidan", "Pengacara", "Notaris", "Akuntan", "Konsultan Pajak" — masing-
   masing entitas terpisah, TIDAK dilumping. Diisi via **combobox dengan daftar kurasi per kategori**
   (§ 2.5) + tetap bisa ketik bebas kalau profesinya belum ada di daftar (pattern sama dengan
   TagInput comma-creation yang sudah ada di post editor — pilih existing ATAU buat baru)
3. **`specialization`** (teks, opsional) — detail lebih spesifik lagi di dalam satu jenis profesi,
   mis. profession Type="Dokter" → specialization="Spesialis Anak (Sp.A)"; Type="Notaris" →
   specialization="Notaris & PPAT Wilayah Sleman"

Ini menyeimbangkan dua kebutuhan: **konsistensi data** (kebanyakan orang pilih dari daftar kurasi,
memudahkan filter/search "cari semua Notaris") sekaligus **fleksibilitas penuh** (profesi langka
yang belum ada di daftar tetap bisa diisi manual, tidak terkunci ke closed enum 446 entri KBJI).

### 2.5 Daftar Kurasi `professionType` per Kategori (usulan awal)

Bukan tabel database — daftar suggestion di kode (`lib/professional-types.ts`), gampang ditambah
tanpa migration. Disusun dari profesi yang lazim di Golongan KBJI terkait (3-digit level), + 4
entri `ref_professions` kategori "Profesional" yang sudah ada di-split jadi entitas masing-masing:

| `professionCategory` | Contoh `professionType` (bisa ditambah) |
|---|---|
| Kesehatan | Dokter Umum, Dokter Spesialis, Dokter Gigi, Perawat, Bidan, Apoteker, Dokter Hewan, Ahli Gizi, Fisioterapis |
| Hukum, Sosial & Budaya | Pengacara / Advokat, Notaris, Hakim, Jaksa, Psikolog, Jurnalis / Wartawan, Penulis, Pekerja Sosial |
| Sains, Teknik & Rekayasa | Insinyur Sipil, Insinyur Mesin, Insinyur Elektro, Insinyur Industri, Arsitek, Perencana Wilayah & Kota, Peneliti Sains |
| Bisnis, Keuangan & Manajemen | Akuntan, Konsultan Manajemen, Konsultan Pajak, Analis Keuangan, Aktuaris, Auditor |
| Pendidikan & Akademik | Guru, Dosen, Peneliti / Akademisi, Instruktur / Trainer |
| Teknologi Informasi | Software Engineer / Developer, Data Scientist / Analyst, System Analyst, IT Consultant, Cyber Security Specialist |
| Lainnya | *(langsung ketik bebas, tidak ada suggestion)* |

Daftar ini **usulan awal untuk didiskusikan**, bukan final — gampang direvisi karena hidup di kode
(constant array), bukan skema DB atau data production seperti `ref_professions`.

---

## 3. Schema Database

### 3.1 Tabel Baru: `public.member_professionals`

Pola **identik** dengan `member_businesses` / `member_owned_pesantren` — satu row per entri
profesional, self-reported, tidak perlu verifikasi admin, helper FK opsional (null jika kosong).

```sql
CREATE TABLE public.member_professionals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,

  -- Identitas profesional
  title             TEXT,           -- gelar/sebutan, mis. "dr.", "Ir.", opsional (nama dasar dari members.name)
  profession_category TEXT NOT NULL CHECK (profession_category IN (
    'Sains, Teknik & Rekayasa', 'Kesehatan', 'Pendidikan & Akademik',
    'Bisnis, Keuangan & Manajemen', 'Teknologi Informasi', 'Hukum, Sosial & Budaya', 'Lainnya'
  )),
  profession_type   TEXT NOT NULL,  -- jenis profesi spesifik, mis. "Dokter", "Notaris", "Perawat" (§2.5)
  specialization    TEXT,           -- detail lebih lanjut, mis. "Spesialis Anak (Sp.A)" — opsional
  description       TEXT,           -- bio singkat / layanan yang ditawarkan

  -- Kredensial (opsional, publik by default — bangun kepercayaan, bukan data sensitif)
  license_type      TEXT,           -- mis. "STR", "No. Advokat PERADI", "Sertifikat CPA"
  license_number    TEXT,

  -- Konteks kerja
  employment_type   TEXT CHECK (employment_type IN (
    'Praktik Mandiri', 'Karyawan/Pegawai', 'Pemilik Firma/Klinik/Kantor', 'Freelance/Konsultan Lepas'
  )),
  institution       TEXT,           -- tempat praktik/bekerja, mis. "RSUD dr. Sardjito", "Freelance"
  start_year        INTEGER,        -- tahun mulai berkarir di bidang ini (opsional)

  -- Foto (pola member media library — sama dengan usaha/pesantren)
  cover_url         TEXT,           -- URL langsung dari member media library, bukan FK

  -- Helper FKs (kondisional, null jika kosong) — REUSE tabel yang sudah ada
  contact_id      UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  address_id      UUID REFERENCES public.addresses(id) ON DELETE SET NULL,
  social_media_id UUID REFERENCES public.social_medias(id) ON DELETE SET NULL,

  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_member_professionals_member_id ON public.member_professionals(member_id);
CREATE INDEX idx_member_professionals_category  ON public.member_professionals(profession_category);
CREATE INDEX idx_member_professionals_type      ON public.member_professionals(profession_type);
```

**Kenapa `employment_type` penting** (beda dengan `member_businesses` yang asumsikan pemilik usaha):
membedakan anggota yang **bekerja untuk institusi** (dokter RSUD, dosen PNS, associate firma
hukum) dari yang **membuka praktik sendiri** — dua kelompok ini sama-sama valid masuk direktori,
tapi field yang relevan beda (institusi vs nama praktik).

### 3.2 Drizzle Schema — `packages/db/src/schema/public/member-professionals.ts`

```typescript
import {
  pgTable, uuid, text, integer, boolean, timestamp, index,
} from "drizzle-orm/pg-core";
import { members }      from "./members";
import { addresses }    from "./addresses";
import { contacts }     from "./contacts";
import { socialMedias } from "./social-medias";

// ─── Data profesional anggota IKPM (dokter, pengacara, konsultan, dll) ───────
// Self-reported, tidak butuh verifikasi admin.
// Pola identik dengan member_businesses & member_owned_pesantren.
export const memberProfessionals = pgTable("member_professionals", {
  id:       uuid("id").primaryKey().defaultRandom(),
  memberId: uuid("member_id").notNull()
              .references(() => members.id, { onDelete: "cascade" }),

  // ── Identitas profesional ─────────────────────────────────────────────────
  title: text("title"), // gelar/sebutan, mis. "dr.", "Ir." — opsional

  professionCategory: text("profession_category", {
    enum: [
      "Sains, Teknik & Rekayasa", "Kesehatan", "Pendidikan & Akademik",
      "Bisnis, Keuangan & Manajemen", "Teknologi Informasi",
      "Hukum, Sosial & Budaya", "Lainnya",
    ],
  }).notNull(),

  professionType: text("profession_type").notNull(), // mis. "Dokter", "Notaris", "Perawat" (§2.5) — combobox kurasi + custom
  specialization: text("specialization"),             // detail lanjut, mis. "Spesialis Anak (Sp.A)" — opsional
  description:    text("description"),               // bio singkat / layanan

  // ── Kredensial (opsional, publik by default) ─────────────────────────────
  licenseType:   text("license_type"),     // mis. "STR", "No. Advokat PERADI"
  licenseNumber: text("license_number"),

  // ── Konteks kerja ──────────────────────────────────────────────────────────
  employmentType: text("employment_type", {
    enum: ["Praktik Mandiri", "Karyawan/Pegawai", "Pemilik Firma/Klinik/Kantor", "Freelance/Konsultan Lepas"],
  }),
  institution: text("institution"),   // tempat praktik/bekerja
  startYear:   integer("start_year"), // tahun mulai berkarir (opsional)

  // ── Foto profil profesional ────────────────────────────────────────────────
  coverUrl: text("cover_url"),   // URL dari member media library (bukan FK — cross-schema)

  // ── Helper FKs (kondisional, null jika kosong) ────────────────────────────
  contactId:     uuid("contact_id")
                   .references(() => contacts.id,     { onDelete: "set null" }),
  addressId:     uuid("address_id")
                   .references(() => addresses.id,    { onDelete: "set null" }),
  socialMediaId: uuid("social_media_id")
                   .references(() => socialMedias.id, { onDelete: "set null" }),

  isActive:  boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  memberIdx:   index("idx_member_professionals_member_id").on(t.memberId),
  categoryIdx: index("idx_member_professionals_category").on(t.professionCategory),
  typeIdx:     index("idx_member_professionals_type").on(t.professionType),
}));

export type MemberProfessional    = typeof memberProfessionals.$inferSelect;
export type NewMemberProfessional = typeof memberProfessionals.$inferInsert;
```

Daftar ke `packages/db/src/schema/public/index.ts` (barrel export) + `packages/db/src/index.ts`
seperti tabel public lain.

---

## 4. Komponen yang Direuse — Audit Kesiapan

> Sesuai instruksi: setiap field kontak/alamat/sosmed WAJIB pakai komponen dinamis yang sudah ada,
> bukan bikin baru. Berikut audit tiap komponen yang dibutuhkan fitur ini:

| Kebutuhan | Komponen/Helper Existing | Siap Pakai? | Catatan |
|-----------|---------------------------|:---:|---------|
| Input No. HP / WhatsApp | `components/ui/phone-input.tsx` (`<PhoneInput>`) | ✅ | Format E.164 otomatis, flag negara — sama seperti di form usaha/pesantren |
| Normalisasi HP di server | `lib/phone.ts` → `normalizePhone()` | ✅ | Wajib dipanggil di API route saat insert `contacts` |
| Display HP di publik | `lib/phone.ts` → `displayPhone()` | ✅ | Dipakai di halaman detail publik |
| Toggle visibilitas kontak | `contacts.is_phone_public` / `is_whatsapp_public` / `is_email_public` | ✅ | Kolom sudah ada di tabel `contacts`, tinggal reuse |
| Alamat (provinsi→desa + luar negeri) | `components/ui/wilayah-select.tsx` (`<WilayahSelect>`) + tabel `addresses` | ✅ | `addresses.label` cuma TS-level enum (`"rumah"\|"kantor"\|"usaha"`), **tidak ada DB CHECK constraint** — tambah `"profesional"` ke enum di Drizzle schema itu perubahan aditif, tidak perlu migration |
| Sosial media (7 platform) | `components/ui/social-media-input.tsx` (`<SocialMediaInput>`) | ✅ | Reuse langsung, tidak perlu modifikasi |
| Foto profil/cover | `components/media/member-media-picker.tsx` (`<CoverImageField>` + `MemberMediaPicker`) | ✅ | Module `"akun"` sudah ada di `MODULE_VARIANTS`, tinggal pakai |
| Kategori profesi (dropdown, 7 nilai) | **BARU** — tidak reuse `ref_professions` (lihat § 6) | ⚠️ | Enum baru `profession_category`, dropdown biasa (7 nilai tetap, tidak butuh combobox) |
| Jenis profesi spesifik (creatable combobox) | **BARU (kecil)** — komponen `ProfessionTypeCombobox` | ⚠️ | Reuse `<Combobox>` (`components/ui/combobox.tsx`) + tambah affordance "buat baru" — pola interaksi sama dengan TagInput comma-creation yang sudah ada (§ 2.5) |
| Pattern self-service API | `/api/akun/member-business/route.ts` (GET + POST replace-all) | ✅ | Struktur di-copy, ganti nama tabel + field |
| Pattern three-view UX | `usaha-client.tsx` (list/detail/edit via state, tanpa router) | ✅ | Struktur di-copy 1:1 |
| Pattern direktori publik | `(public)/[tenant]/usaha/page.tsx` + `[id]/page.tsx` | ✅ | Struktur di-copy, sesuaikan filter kategori |

**Kesimpulan**: **tidak ada komponen baru yang perlu dibuat** untuk kontak/alamat/sosmed/foto —
semuanya reuse 100% dari infrastruktur yang sudah matang. Satu-satunya elemen baru murni data
(bukan komponen UI) adalah enum `profession_category`.

---

## 5. Reconciliation dengan Data Existing

| Sumber data profesi | Tujuan | Perubahan? |
|----------------------|--------|------------|
| `members.profession_id → ref_professions` | Tag ringkas profesi di profil dasar & statistik anggota (`/statistik`) | **Tidak berubah** |
| `member_businesses.category = "Profesional"` | Usaha berbadan hukum yang bergerak di jasa profesional (klinik, firma hukum sbg entitas bisnis) | **Tidak berubah** — tetap valid untuk kasus itu |
| **`member_professionals` (baru)** | Kredensial & praktik profesional individual — baik karyawan maupun praktik mandiri | Entitas baru, coexist dengan dua di atas |

Anggota yang mengisi ketiganya sekaligus adalah kasus valid (dokter dengan klinik sendiri): profil
dasar isi "Dokter" di `profession_id`, `member_professionals` isi kredensial medis + spesialisasi,
`member_businesses` isi klinik sebagai entitas usaha jika berbadan hukum.

---

## 6. Keputusan: `profession_category` Enum Baru, Bukan Reuse `ref_professions`

**Data aktual `ref_professions`** (dicek langsung di production, 2026-07-12; +1 entri 2026-07-17 —
migration `0032_ref_profession_ojek_online.sql`) — 26 entri, 11 kategori:

| Kategori | Entri |
|----------|-------|
| Agama & Dakwah | Kyai/Ulama, Ustadz/Dai, Imam Masjid |
| BUMN/BUMD | Karyawan BUMN/BUMD |
| Kreatif | Seniman / Konten Kreator |
| Lainnya | Mahasiswa, Ibu Rumah Tangga, Belum Bekerja, Lainnya |
| Pemerintahan | ASN/PNS, TNI, Polri |
| Pendidikan | Guru, Dosen/Peneliti |
| Pertanian | Petani, Nelayan, Peternak |
| Politik & Sosial | Politisi/Anggota DPRD-DPR, Aktivis/LSM |
| **Profesional** | **Dokter/Tenaga Kesehatan, Pengacara/Notaris, Arsitek/Insinyur, Akuntan/Konsultan** |
| Swasta | Karyawan Swasta |
| Wirausaha | Pengusaha/Wiraswasta, **Ojek Online / Driver Online** |

**Temuan kunci**: kategori `"Profesional"` yang sudah ada (4 entri) **cocok persis** dengan 4 dari 6
subgolongan KBJI Golongan Pokok 2 yang diusulkan di § 2.3 — validasi bahwa skema 7-kategori di
dokumen ini konsisten dengan pola yang organisasi sudah pakai, bukan taksonomi asing:

| Entri `ref_professions` (kategori "Profesional") | → `profession_category` (§2.3) | → `profession_type` (§2.5, di-split) |
|-----|-----|-----|
| Dokter / Tenaga Kesehatan | Kesehatan | Dokter Umum, Dokter Spesialis, Perawat, Bidan, dll — **dipisah**, bukan satu nilai gabungan |
| Pengacara / Notaris | Hukum, Sosial & Budaya | Pengacara / Advokat, Notaris — **dipisah**, dua profesi berbeda |
| Arsitek / Insinyur | Sains, Teknik & Rekayasa | Arsitek, Insinyur Sipil, Insinyur Mesin, dll — **dipisah** |
| Akuntan / Konsultan | Bisnis, Keuangan & Manajemen | Akuntan, Konsultan Manajemen, Konsultan Pajak, dll — **dipisah** |

`ref_professions` melumping 2 profesi jadi 1 entri karena tujuannya cuma tag ringkas di profil dasar
(cukup granularitas kasar). `member_professionals.profession_type` sengaja **tidak** mewarisi
lumping ini — setiap profesi jadi entitas combobox terpisah (§ 2.4–2.5), sesuai feedback bahwa
Direktori Profesional butuh presisi lebih tinggi untuk filter/search yang berguna.

**Dua celah yang diisi dokumen ini** (dikonfirmasi dengan user 2026-07-12):
1. **"Pendidikan"** (Guru, Dosen/Peneliti) saat ini kategori TERPISAH dari "Profesional" di
   `ref_professions` — keputusan: tetap dimasukkan sebagai kategori "Pendidikan & Akademik" di
   Direktori Profesional, karena secara KBJI resmi dosen/guru memang Golongan Pokok 2. Pemisahan di
   `ref_professions` hanya untuk kemudahan filter simpel di form profil dasar, bukan penilaian bahwa
   mereka "bukan profesional"
2. **Teknologi Informasi** — sama sekali tidak ada representasi di `ref_professions` manapun.
   Keputusan: tetap masuk sebagai kategori ke-7 karena KBJI resmi punya Golongan Pokok 2.5 khusus
   TI, dan cukup besar kemungkinan ada alumni IKPM di bidang ini yang belum terwakili sama sekali

**Kenapa tetap enum baru, bukan reuse `ref_professions` langsung**:
1. `ref_professions` dirancang untuk **semua anggota** (termasuk non-profesional: petani, ASN,
   mahasiswa) — field `professionId` di `members` itu general-purpose, bukan filter direktori
2. Filter direktori publik butuh granularitas **lebih kasar & konsisten** (7 kategori) untuk UX —
   25 entri `ref_professions` terlalu banyak & campur-baur untuk dropdown filter direktori
3. `ref_professions` tidak lengkap untuk scope KBJI Golongan 2 (lihat 2 celah di atas)

**Rekomendasi final**: `profession_category` sebagai enum tetap di kolom (7 nilai, § 2.3),
`profession_type` sebagai combobox kurasi+custom untuk profesi spesifik (§ 2.5), `specialization`
sebagai teks bebas untuk detail tambahan. `profession_category` konsisten dengan pola field enum
lain di `member_businesses` (`sector`, `category` juga enum tetap, bukan tabel referensi terpisah).
`ref_professions` (dan `members.profession_id`) **tidak diubah sama sekali** — dua sistem tetap
berjalan independen (lihat § 5).

---

## 7. API Routes — Self-Service (`/api/akun/member-professional`)

Pola **identik** dengan `/api/akun/member-business` — replace-all per member, auth via
`members.better_auth_user_id === session.user.id` (bukan `getTenantAccess`, karena ini self-service
front-end, bukan dashboard admin tenant).

### `GET /api/akun/member-professional`
Return semua entri profesional milik member yang login, JOIN `contacts`/`addresses`/`social_medias`
+ resolve nama wilayah (province/regency/district/village name) — sama seperti response
`member-business`.

### `POST /api/akun/member-professional` (replace-all)
```typescript
type Body = {
  entries: {
    title?: string;
    professionCategory: string;   // wajib, salah satu dari 7 enum
    professionType: string;       // wajib, dari combobox kurasi ATAU custom (§2.5)
    specialization?: string;      // opsional, detail lanjut
    description?: string;
    licenseType?: string;
    licenseNumber?: string;
    employmentType?: string;
    institution?: string;
    startYear?: number;
    coverUrl?: string;
    // Kontak
    phone?: string; whatsapp?: string; email?: string;
    isPhonePublic?: boolean; isWhatsappPublic?: boolean; isEmailPublic?: boolean;
    // Alamat
    addressCountry?: string; addressProvinceId?: number; addressRegencyId?: number;
    addressDistrictId?: number; addressVillageId?: number;
    addressDetail?: string; addressPostalCode?: string;
    // Sosmed
    instagram?: string; facebook?: string; linkedin?: string;
    twitter?: string; youtube?: string; tiktok?: string; website?: string;
  }[];
};
```
Validasi minimum: `professionType` dan `professionCategory` wajib diisi (baris dengan salah satu
kosong di-skip, sama seperti `member_businesses` skip baris tanpa `name`).

Implementasi: **copy struktur `member-business/route.ts` baris-per-baris**, ganti nama tabel/field
— tidak ada logic baru yang perlu didesain, murni replikasi pola yang sudah terbukti jalan.

---

## 8. UX Frontend — Three-View Pattern

Halaman: `/{slug}/akun/profesional` — pola **identik** `usaha-client.tsx` / `pesantren-client.tsx`:

- **List view** (default): card/tabel ringkas (nama, kategori, spesialisasi) + aksi [Detail] [Edit] [Hapus]
- **Detail view**: dialog popup — semua field lengkap
- **Edit view**: form penuh menggantikan halaman, breadcrumb "← Data Profesional / {nama entri}"
- State via `useState`, bukan routing terpisah — batal pada entry baru → hapus dari list; batal pada
  entry existing → kembalikan ke list tanpa perubahan

### Form Layout (Edit View) — 7 Section

1. **Identitas Profesional** — Gelar (opsional), Kategori Profesi (dropdown 7 nilai, wajib), Jenis
   Profesi (combobox kurasi per kategori + custom, wajib — dependent dropdown dari Kategori),
   Spesialisasi (teks bebas, opsional), Deskripsi/Bio
2. **Kredensial** — Jenis Izin (teks bebas, mis. "STR"), Nomor Izin (teks bebas) — keduanya opsional
3. **Konteks Kerja** — Status Kerja (dropdown 4 nilai), Institusi/Tempat Praktik, Tahun Mulai
4. **Kontak** — `<PhoneInput>` HP + WA, Email + 3 toggle visibilitas — identik section kontak usaha
5. **Alamat** — `<WilayahSelect>` + opsi luar negeri — identik section alamat usaha
6. **Sosial Media** — `<SocialMediaInput>` — identik
7. **Foto Profil** — `<CoverImageField>` — identik

Dashboard `/akun` tambah satu card baru (pola sama dengan Pesantren/Usaha di baris menu):
```typescript
{ href: `${baseUrl}/akun/profesional`, icon: Briefcase, label: "Profesional", desc: "Data profesi & kredensial" }
```

---

## 9. Halaman Publik — Direktori Profesional

### 9.1 URL
```
/{slug}/profesional              → arsip (list + filter kategori + search + pagination)
/{slug}/profesional/{id}         → detail
```
Cek route conflict: tidak ada `(dashboard)/[tenant]/profesional` — aman, tidak perlu rename
(lihat aturan "URL Naming Pattern" di `CLAUDE.md`).

### 9.2 Scope Query
Wajib JOIN `tenant_memberships WHERE tenant_id = {tenantId} AND status IN ('active','alumni')` —
sama seperti direktori usaha/pesantren, hanya tampilkan anggota cabang ini.

### 9.3 Filter
- Kategori profesi (7 nilai, dropdown) — filter kasar
- Jenis profesi (`professionType`, dropdown dinamis berdasarkan kategori terpilih) — filter presisi,
  ini yang bikin "cari semua Notaris" atau "cari semua Perawat" jadi mungkin, bukan cuma "cari semua
  Hukum, Sosial & Budaya" atau "cari semua Kesehatan"
- Provinsi (dari `addresses.province_id`)
- Search by nama/spesialisasi

### 9.4 Aturan Visibilitas (konsisten dengan § 1c `arsitektur-direktori-publik.md`)

**Selalu tampil publik:**
| Field | Catatan |
|-------|---------|
| `title` + nama anggota | Dari `members.name`, gelar dari `member_professionals.title` |
| `professionCategory`, `professionType`, `specialization` | Untuk filter & display |
| `description` | Bio/layanan |
| `licenseType` + `licenseNumber` | **Publik by default** — kredensial profesional lazim dipublikasikan untuk membangun kepercayaan (beda dengan data finansial `revenue` usaha yang sensitif) |
| `employmentType`, `institution` | Konteks kerja |
| `coverUrl` | Foto |
| Alamat (provinsi + kabupaten saja) | Dari `addresses.*` |
| Social media | Semua platform yang diisi |
| Pemilik | Link ke profil anggota IKPM (`/anggota/{memberId}`) |

**Tampil berdasarkan toggle:**
| Field | Kontrol |
|-------|---------|
| HP | `contacts.is_phone_public` |
| WhatsApp | `contacts.is_whatsapp_public` |
| Email | `contacts.is_email_public` |

**Tidak pernah tampil publik:**
| Field | Alasan |
|-------|--------|
| Detail alamat (jalan, kecamatan, desa) | Cukup provinsi + kabupaten — konsisten dengan usaha/pesantren |

> **Catatan berbeda dari `member_businesses`**: di sana `revenue` sengaja disembunyikan (data
> finansial sensitif). Di `member_professionals` **tidak ada field finansial sama sekali** —
> `licenseNumber` publik by default karena secara profesi memang lazim dipublikasikan (dokter,
> pengacara, notaris semua menampilkan nomor izin di depan umum). Jika admin/anggota keberatan,
> pertimbangkan Phase 2: tambah toggle `isLicensePublic` (belum di scope Phase 1 — lihat § 12).

---

## 10. File yang Perlu Dibuat / Diubah

### Baru
```
packages/db/src/schema/public/member-professionals.ts
packages/db/migrations/00XX_member_professionals.sql
apps/web/app/api/akun/member-professional/route.ts
apps/web/app/(public)/[tenant]/akun/profesional/page.tsx
apps/web/app/(public)/[tenant]/akun/profesional/profesional-client.tsx
apps/web/app/(public)/[tenant]/profesional/page.tsx              (direktori publik)
apps/web/app/(public)/[tenant]/profesional/[id]/page.tsx         (detail publik)
apps/web/components/profesional/professional-filters-client.tsx  (filter kategori+provinsi, pola sama anggota-filters-client.tsx)
```

### Diubah
```
packages/db/src/schema/public/index.ts        → export memberProfessionals
packages/db/src/index.ts                       → re-export
apps/web/app/(public)/[tenant]/akun/page.tsx  → tambah card "Profesional"
apps/web/app/(public)/[tenant]/statistik/page.tsx → tambah breakdown "Profesional per Kategori" (Phase 1, § 12)
docs/arsitektur-direktori-publik.md            → tambah § 1d Data Profesional + entri tabel halaman
```

---

## 11. Migration untuk Tenant Existing

Tabel ini di `public` schema (bukan tenant schema) — satu migration global, bukan per-tenant loop:
```sql
-- packages/db/migrations/00XX_member_professionals.sql
CREATE TABLE IF NOT EXISTS public.member_professionals ( ... );
CREATE INDEX IF NOT EXISTS idx_member_professionals_member_id ON public.member_professionals(member_id);
CREATE INDEX IF NOT EXISTS idx_member_professionals_category ON public.member_professionals(profession_category);
CREATE INDEX IF NOT EXISTS idx_member_professionals_type ON public.member_professionals(profession_type);
```
Jalankan sekali di VPS (`docker compose exec -T postgres psql -U jalakarta -d jalakarta < ...`),
tidak perlu loop `tenant_{slug}` karena bukan tenant-schema table.

---

## 12. Open Questions — ✅ SEMUA SUDAH DIPUTUSKAN (2026-07-12)

1. ~~Isi 25 entri `ref_professions`~~ — **SELESAI DICEK** (lihat § 6). Skema 7-kategori dikonfirmasi
   konsisten + 2 celah (Pendidikan & Akademik, Teknologi Informasi) diputuskan masuk sebagai
   kategori tersendiri di `member_professionals`.
2. ~~`licenseNumber` publik by default atau toggle?~~ — **KEPUTUSAN: publik otomatis**, tidak perlu
   toggle tambahan (`isLicensePublic`). Konsisten dengan kebiasaan profesi — dokter/pengacara/notaris
   memang lazim publikasikan nomor izin untuk membangun kepercayaan publik, beda dengan kontak
   pribadi (HP/email) yang defaultnya privat.
3. ~~Perlu halaman admin tenant untuk moderasi?~~ — **KEPUTUSAN: tidak perlu**. Ikuti pola
   `member_businesses`/`member_owned_pesantren` yang juga fully self-service tanpa moderasi admin
   sama sekali — konsisten, dan belum pernah jadi masalah di dua fitur itu.
4. ~~Perlu breakdown "Profesional per Kategori" di `/statistik`?~~ — **KEPUTUSAN: ya, masuk Phase 1**
   (bukan opsional/fase terpisah) — query-nya sederhana, mirip breakdown profesi yang sudah ada.
5. ~~Nama URL final?~~ — **KEPUTUSAN: `/profesional`** dikonfirmasi, tidak ada perubahan.

---

## 13. Urutan Eksekusi (usulan, belum dieksekusi)

```
Step 1 — Schema: member-professionals.ts + migration + barrel export
Step 2 — Curated list: lib/professional-types.ts (§ 2.5) + ProfessionTypeCombobox (§ 4)
Step 3 — API: /api/akun/member-professional (copy pola member-business)
Step 4 — Self-service UI: /akun/profesional (three-view, copy pola usaha-client.tsx)
Step 5 — Dashboard /akun: tambah card menu
Step 6 — Direktori publik: /profesional (list) + /profesional/[id] (detail)
Step 7 — Nav menu / header: tambah link direktori jika relevan
Step 8 — Statistik: breakdown "Profesional per Kategori" di /statistik
```

Setiap step sebaiknya dikerjakan + di-review terpisah (bukan satu commit besar), mengikuti pola
`member_owned_pesantren` yang sukses sebelumnya. Dokumen ini sekarang **siap eksekusi** — semua
keputusan desain sudah dikunci, tidak ada open question tersisa.

---

## 14. Kategori Baru "Kreatif" (2026-07-24)

Ditambahkan atas permintaan user — tenant forum "Forcreator" (menaungi kreator & pekerja seni)
punya struktur 9 "Bidang Usaha" (Kaligrafi, Desain Komunikasi Visual, Interior & Arsitektur,
Teater & Sastra, Media Rekam, Seni Lukis & Ilustrasi, Seni Musik, Seni Instalasi & Kontemporer,
Seni Kriya) dari kepengurusan mereka (koordinator bidang seni per Korbid). Diminta didiskusikan
dulu sebelum eksekusi ("kira-kira profesi Kreatif ini apa saja jenis profesinya?").

**Klarifikasi level yang penting** (user sempat menanyakan ulang untuk konfirmasi): "Bidang
Usaha" BUKAN level tersendiri di sistem 3-level yang sudah ada (kategori → jenis profesi →
spesialisasi) — itu murni DATA ACUAN untuk menurunkan `professionType`. "Kreatif" sendiri
adalah SATU kategori baru (Level 1, `PROFESSION_CATEGORIES`), sejajar dengan 7 kategori yang
sudah ada. TIDAK ditambah level ke-4 (sub-kategori) hanya untuk kategori ini — akan membuat
struktur data tidak seragam tanpa manfaat besar.

**Pemetaan 9 Bidang Usaha → jenis profesi (`PROFESSION_TYPES_BY_CATEGORY["Kreatif"]`)** — pola
sama "setiap profesi entitas terpisah kalau memang beda pekerjaan" (§ 2.4, contoh existing:
Dokter≠Perawat≠Bidan): beberapa bidang usaha dipecah jadi 2-3 profesi berbeda (mis. "Media
Rekam" → Fotografer / Videografer-Sutradara Film / Editor Video-Audio; "Teater & Sastra" →
Aktor/Aktris Teater / Penulis Sastra-Sastrawan; "Seni Lukis & Ilustrasi" → Pelukis / Ilustrator;
"Seni Musik" → Musisi / Vokalis-Penyanyi / Komposer-Arranger), sementara yang lain tetap 1
profesi ("Kaligrafi" → Kaligrafer, "Seni Kriya" → Perajin/Pengrajin Kriya, dst). "Interior &
Arsitektur" sengaja TIDAK menduplikasi "Arsitek" (sudah ada di kategori "Sains, Teknik &
Rekayasa" sejak awal) — hanya sisi "Desainer Interior" yang murni kreatif yang ditambahkan di
sini. "Koordinator Event" dari daftar kepengurusan TIDAK dimasukkan — itu jabatan struktural
forum (posisi kepengurusan), bukan profesi personal anggota (beda konsep dari `/akun/
profesional`, yang merekam identitas karier pribadi, bukan jabatan organisasi).

**Bug ditemukan+difix saat implementasi**: `packages/db/src/schema/public/member-
professionals.ts`'s kolom `profession_category` punya `text(..., {enum: [...]})` TERPISAH dari
`PROFESSION_CATEGORIES` di `lib/professional-types.ts` — dua daftar independen yang harus tetap
sinkron manual (bukan reference satu sama lain). Menambah "Kreatif" HANYA di
`professional-types.ts` menyebabkan TypeScript error di `profesional/page.tsx` (query
`eq(member_professionals.professionCategory, ...)` — union type Drizzle tidak match). Selain
tipe, ada juga **CHECK constraint PostgreSQL sungguhan** (`member_professionals_profession_
category_check`, dari migration `0027_member_professionals.sql`, DDL inline `CHECK (... IN
(...))` — bukan `pgEnum`, konsisten aturan project) yang juga perlu diupdate, atau INSERT
`professionCategory: "Kreatif"` akan ditolak di level DB meski TypeScript tidak protes lagi.

**Fix — 2 titik**: (1) Drizzle schema enum ditambah `"Kreatif"`; (2) migration baru
`0043_member_professionals_kreatif_category.sql` — `DROP CONSTRAINT` + `ADD CONSTRAINT` dengan
list baru. **`member_professionals` ada di PUBLIC schema (bukan per-tenant)** — migration ini
jalan SEKALI saja, BUKAN loop `DO $$ ... LOOP` per tenant seperti migration `settings.group`
(0031/0042) yang per-tenant-schema. Dijalankan lokal via `psql` langsung, dikonfirmasi via `\d
public.member_professionals` bahwa constraint sudah mencakup `'Kreatif'`.

**Aturan yang ditegaskan**: setiap kali sebuah kolom `text(..., {enum:[...]})` PUBLIC-schema
punya "kembaran" konseptual di sebuah file konstanta terpisah (`lib/professional-types.ts` di
sini) — KEDUANYA harus diupdate bersamaan, DAN kalau kolom itu dibuat via migration SQL manual
(bukan generate otomatis drizzle-kit), migration itu KEMUNGKINAN BESAR juga punya CHECK
constraint sungguhan di DB yang perlu di-ALTER terpisah — jangan asumsikan mengubah TypeScript
enum saja sudah cukup, `tsc` akan menangkap SEBAGIAN masalah (union type mismatch di consumer
lain seperti query filter) tapi TIDAK PERNAH menangkap CHECK constraint DB yang sudah ketinggalan.

**Verifikasi**: `tsc --noEmit` bersih di `apps/web` DAN `packages/db` + `bun run build
--filter=@jalajogja/web` sukses (dev server dimatikan dulu, `.next` dibersihkan, direstart).
Migration `0043` dijalankan+diverifikasi di lokal. **Belum dijalankan di VPS. Belum
diverifikasi visual di browser** — user diminta coba tambah profesional dengan kategori
"Kreatif" di `/akun/profesional` untuk konfirmasi combobox + jenis profesi muncul benar.

---

## 14. Aturan Validasi Field Wajib & Integrasi Tag Ekosistem (Mandatory Fields & Tag Rule)

Sesuai keputusan arsitektur (2026-07-30), data profesional anggota (`public.member_professionals`) mewajibkan kelengkapan **6 Field Data Utama** saat disimpan di form self-service (`/akun/profesional`) dan backend API (`/api/akun/member-professional`).

### Daftar 6 Field Wajib Profesional:
1. **Kategori Profesi** (`professionCategory`): Wajib dipilih (`Kategori profesi wajib dipilih.`).
2. **Jenis Profesi** (`professionType`): Wajib diisi (`Jenis profesi wajib diisi.`).
3. **Deskripsi / Bio** (`description`): Wajib diisi penjelasan layanan/pengalaman (`Deskripsi / bio profesional wajib diisi.`).
4. **Tahun Mulai Berkarir** (`startYear`): Wajib diisi tahun mulai berkarir/praktik (`Tahun mulai berkarir wajib diisi.`).
5. **Alamat Praktik (Min. Kecamatan)**:
   - Mode Indonesia: Wajib terisi Provinsi, Kab/Kota, dan Kecamatan (`addressDistrictId`) (`Alamat praktik wajib diisi minimal sampai tingkat Kecamatan.`).
   - Mode Luar Negeri: Wajib terisi Nama Negara (`addressCountry`) (`Negara alamat praktik wajib diisi.`).
6. **Nomor WhatsApp** (`whatsapp`): Wajib diisi nomor WhatsApp valid atau centang *"Sama dengan nomor telepon"* (`Nomor WhatsApp wajib diisi.`).

### Integrasi Tag Sinergi Ekosistem (`offeredTags` / `neededTags`):
Field **Menawarkan** (`offeredTags`) dan **Membutuhkan** (`neededTags`) diintegrasikan dengan komponen `TagMultiSelect` berbasis `ECOSYSTEM_TAG_SUGGESTIONS` (`apps/web/lib/ecosystem-tags.ts`), seragam dengan modul **Usaha** dan **Pesantren**. Hal ini memungkinkan sinergi pasokan dan kebutuhan antar-anggota lintas modul ekosistem.

---

## 15. Kategori Baru "Pemerintahan, Keamanan & Militer" (2026-08-01)

User tanya (eksploratif, bukan langsung minta eksekusi): "ada profesi seperti polisi, TNI atau
apalagi ya, kira-kira masuk mana ya?" — dicek ke 8 kategori yang sudah ada
(`PROFESSION_CATEGORIES`), tidak satu pun cocok. Alasan strukturalnya: seluruh 8 kategori itu
turunan BPS KBJI 2014 "Golongan Pokok 2: Profesional" (§ 2), sementara TNI/Polri di
klasifikasi KBJI/ISCO-08 sesungguhnya masuk **Golongan Pokok TERPISAH** ("Angkatan Bersenjata" /
Armed Forces Occupations, Major Group 0) — bukan bagian dari "Profesional" sama sekali. Memaksa
masukkan ke salah satu 6 kategori profesional yang ada, atau ke "Lainnya" (catch-all generik),
sama-sama kurang tepat mengingat kemungkinan banyak alumni Gontor berkarier di jalur ini.

**Keputusan dikonfirmasi user**: buat kategori BARU (bukan pakai "Lainnya"), sejajar 8 kategori
lain — konsisten pola yang sama dengan penambahan "Kreatif" di § 14 (kategori baru dibuat kalau
memang tidak cocok dipaksakan ke yang sudah ada, bukan cuma "cukup detail lebih jauh").

**Cakupan "apa lagi selain TNI/Polri"** — didiskusikan dulu sebelum eksekusi (bukan langsung
ditebak), hasil brainstorm dikonfirmasi user tanpa perubahan:
```
TNI Angkatan Darat, TNI Angkatan Laut, TNI Angkatan Udara, Polisi (POLRI),
Kepala Desa / Perangkat Desa, Anggota Legislatif (DPR/DPRD/DPD),
Kepala Daerah / Wakil Kepala Daerah, Aparatur Sipil Negara (ASN) / Pejabat Struktural,
Diplomat, Petugas Imigrasi, Petugas Bea Cukai, Petugas Pemasyarakatan,
Satpol PP, Pemadam Kebakaran, Politikus / Fungsionaris Partai Politik
```
**Susulan giliran sama**: user tanya lagi "Politikus, ini gmn?" — dijawab: masuk KE SINI sebagai
jenis profesi tambahan (bukan kategori terpisah), beda dari "Anggota Legislatif" (yang spesifik
untuk yang SEDANG menjabat DPR/DPRD/DPD) — "Politikus / Fungsionaris Partai Politik" mencakup
karier politik tanpa/di luar jabatan legislatif spesifik (pengurus partai, kader, kandidat).
Ditambahkan langsung ke `PROFESSION_TYPES_BY_CATEGORY` — **TANPA migration**, karena
`professionType` (beda dari `professionCategory`) adalah `text()` polos tanpa CHECK constraint
DB sama sekali, murni combobox suggestion (anggota tetap bisa ketik bebas apa pun, § 2.5) — nol
DDL yang perlu diubah.

**Hakim dan Jaksa SENGAJA TIDAK diduplikasi ke sini** — keduanya sudah ada di kategori "Hukum,
Sosial & Budaya" sejak awal (§ 2.4 daftar profesi), dipertahankan di sana karena keahliannya
memang hukum — persis pola "Arsitek" yang tidak diduplikasi ke "Kreatif" saat kategori itu
ditambah (§ 14). "Aparatur Sipil Negara (ASN) / Pejabat Struktural" sengaja generik (bukan per-
kementerian) — PNS dengan profesi teknis (guru/dokter/insinyur PNS) tetap masuk kategori
masing-masing, BUKAN sini; kategori ini khusus untuk birokrat struktural yang tidak punya
profesi teknis spesifik.

**Fix — 3 titik, pola PERSIS § 14 (Kreatif)**: (1) `PROFESSION_CATEGORIES` (`lib/professional-
types.ts`) ditambah `"Pemerintahan, Keamanan & Militer"` + `PROFESSION_TYPES_BY_CATEGORY` diisi
14 jenis profesi di atas; (2) Drizzle schema enum (`packages/db/src/schema/public/member-
professionals.ts`) ditambah nilai yang sama; (3) migration baru
`0056_member_professionals_pemerintahan_category.sql` — `DROP CONSTRAINT` + `ADD CONSTRAINT`
CHECK dengan 9 nilai (sekali jalan, PUBLIC schema, bukan loop per tenant — sama seperti § 14).

**Verifikasi**: `tsc --noEmit` bersih di `apps/web` DAN `packages/db` (percobaan pertama) +
`bun run build --filter=@jalajogja/web` genuine sukses (`Cached: 0 cached`, 47.35s, dev server
dimatikan+`.next` dibersihkan+direstart). Migration `0056` dijalankan+diverifikasi lokal (`\d
public.member_professionals` mengonfirmasi 9 nilai termasuk kategori baru). **Belum di-commit/
push (user eksplisit minta "mode hemat", tunda push), belum dijalankan di VPS, belum
diverifikasi visual di browser** — user perlu coba tambah profesional dengan kategori
"Pemerintahan, Keamanan & Militer" di `/akun/profesional`, konfirmasi combobox + 14 jenis
profesi muncul benar.
