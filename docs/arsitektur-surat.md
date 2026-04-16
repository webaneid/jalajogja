# Arsitektur: Modul Surat — Identitas Surat, Tujuan Surat, dan Tanggal

## Status
> **PROPOSAL** — belum dieksekusi. Edit file ini sebelum implementasi dimulai.

---

## 0. Struktur Urutan Elemen Surat (PDF & View Publik)

Urutan elemen dari atas ke bawah dalam dokumen yang dirender:

```
┌─────────────────────────────────────────────────────────┐
│  [KOP SURAT]  — header image / nama organisasi          │
├─────────────────────────────────────────────────────────┤
│  [IDENTITAS SURAT]  — Nomor, Lampiran, Hal + Tanggal    │  ← Bagian 1
├─────────────────────────────────────────────────────────┤
│  [TUJUAN SURAT]  — Kepada Yth. + nama + jabatan + dst   │  ← Bagian 2 (BARU)
├─────────────────────────────────────────────────────────┤
│  [BODY SURAT]  — isi surat (Tiptap JSON → HTML)         │
├─────────────────────────────────────────────────────────┤
│  [PENANDATANGAN]  — nama, jabatan, QR Code              │
├─────────────────────────────────────────────────────────┤
│  [FOOTER]  — footer image (opsional)                    │
└─────────────────────────────────────────────────────────┘
```

**Field "Dari/Pengirim" TIDAK muncul di dokumen** — pengirim sudah teridentifikasi dari kop surat.
Ini hanya data internal untuk filter/pencarian di dashboard.

---

## 1. Konsep: Identitas Surat

**Identitas Surat** (juga disebut "Pokok Surat") adalah blok di bawah kop surat yang memuat
informasi identifikasi surat sebelum alamat tujuan. Bukan kop surat (logo/nama organisasi),
bukan isi surat — ini adalah "kartu identitas" surat itu sendiri.

Field yang terlibat:
| Field | Sumber Data |
|---|---|
| Nomor surat | `letters.letter_number` |
| Perihal / Hal | `letters.subject` |
| Lampiran | `letters.attachment_label` ← **field baru**, teks bebas ("1 berkas", "—") |
| Tanggal | `letters.letter_date` → diformat sesuai setting |
| Tempat | dari `settings.contact_address` atau override per surat |
| Nama jenis surat | `letter_types.name` (untuk Layout 3) |

---

## 2. Tiga Layout Identitas Surat

Layout dipilih **per jenis surat** (`letter_types.identitas_layout`).
Artinya: semua surat yang pakai jenis "Undangan" otomatis menggunakan layout yang
sudah dikonfigurasi di jenis surat tersebut — tidak perlu pilih tiap kali buat surat.

---

### Layout 1 — Dua Kolom / Klasik
Identitas surat di kiri, tanggal + tempat di kanan sejajar baris pertama.
Paling umum untuk surat keluar resmi.

```
┌─────────────────────────────────────────────────────────────┐
│                     [ KOP SURAT ]                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Nomor   : 001/IKPM/IV/2026        Yogyakarta, 16 April 2026│
│  Lampiran: 1 (satu) berkas                                  │
│  Hal     : Undangan Rapat Tahunan                           │
│                                                             │
│  Kepada                                                     │
│  Yth. ...                                                   │
└─────────────────────────────────────────────────────────────┘
```

---

### Layout 2 — Tanggal di Atas Kanan
Tanggal di pojok kanan atas terlebih dahulu, lalu identitas surat di kiri di bawahnya.
Sering dipakai di surat-surat pemerintahan modern.

```
┌─────────────────────────────────────────────────────────────┐
│                     [ KOP SURAT ]                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                               Yogyakarta, 16 April 2026     │
│                                                             │
│  Nomor   : 001/IKPM/IV/2026                                 │
│  Lampiran: —                                                │
│  Hal     : Permohonan Dukungan                              │
│                                                             │
│  Kepada                                                     │
│  Yth. ...                                                   │
└─────────────────────────────────────────────────────────────┘
```

---

### Layout 3 — Terpusat / Minimalis (Edaran, Pengumuman, Keputusan)
Nama jenis surat sebagai judul besar di tengah, nomor surat di bawahnya.
**Tidak ada label** "Nomor:" / "Hal:" — nomor langsung di bawah judul.
Tidak ada lampiran. Tanggal di bagian bawah dekat tanda tangan (bukan di atas).

```
┌─────────────────────────────────────────────────────────────┐
│                     [ KOP SURAT ]                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                    SURAT EDARAN                             │
│               Nomor: 001/SE/IKPM/IV/2026                    │
│                                                             │
│  [isi surat ...]                                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

Contoh lain Layout 3:
- `SURAT KEPUTUSAN` + nomor SK
- `PENGUMUMAN` + nomor
- `MAKLUMAT` + nomor

---

## 3. Format Tanggal & Tempat

Berlaku untuk Layout 1 dan Layout 2. Dipilih per jenis surat (`letter_types.date_format`).

### 3a. Opsi Format Tanggal

Dua pilihan saja — tidak ada nama hari:

| Value | Contoh Output (dengan kota) | Keterangan |
|---|---|---|
| `masehi` | Yogyakarta, 16 April 2026 | Default |
| `masehi_hijri` | Yogyakarta, 16 April 2026 M ─ 27 Syawal 1447 H | Dua baris + garis pemisah |

Format `masehi_hijri` menghasilkan dua baris dengan garis pemisah tipis (`<hr>`):
```
Yogyakarta, 16 April 2026 M
──────────────────────────
27 Syawal 1447 H
```
Garis: `<hr style="border:none;border-top:0.5px solid currentColor;opacity:0.4;margin:2px 0;">`

**Sumber kota** — prioritas:
1. `settings.letter_config.letter_city` — override manual di `/letters/pengaturan`
2. `settings.contact_address.regencyId` — otomatis dari kota/kabupaten alamat kontak
3. Kosong — tampil tanggal saja tanpa kota

Strip prefix: query kolom `type` dari `ref_regencies` → `"kabupaten"` strip `"Kabupaten "`, `"kota"` strip `"Kota "`.
**Tidak ada override kota per surat** — kota adalah identitas organisasi, bukan per-surat.

### 3b. Hierarki Default Format Tanggal

Format tanggal punya dua level:

1. **Global default** → disimpan di `settings`: `key="letter_date_format", group="general"`, value `"masehi"` atau `"masehi_hijri"`. Dikonfigurasi di `/letters/pengaturan` → section "Format Tanggal".
2. **Override per jenis surat** → `letter_types.date_format`. Jika `NULL` → gunakan global default.

Artinya: admin set default sekali, jenis surat tertentu bisa pakai format berbeda jika perlu.

### 3c. Merge Fields Tanggal

Merge fields yang tersedia di body surat (selain blok identitas):

| Variable | Contoh Output |
|---|---|
| `{{today}}` | 16/04/2026 |
| `{{today.id}}` | 16 April 2026 |
| `{{today.roman}}` | IV |
| `{{today.year}}` | 2026 |
| `{{today.hijri}}` | 27 Syawal 1447 H |

Tidak ada `{{today.day}}` — nama hari tidak dipakai.

> Semua variabel `{{today.*}}` di-resolve **server-side** saat render halaman detail atau generate PDF.

### 3d. Kalender Hijriah

**Library**: `Intl.DateTimeFormat` bawaan Node.js/Bun — zero dependency.
**Algoritma base**: `islamic-umalqura` (Umm al-Qura, Saudi Arabia) — paling umum sebagai dasar kalkulasi.

**Offset adjustment** — karena kalender pemerintah Indonesia kadang berbeda ±1 hari dari kalkulasi internasional:
- Disimpan di `settings`: `key="letter_hijri_offset", group="general", value=0` (default)
- Nilai: `-1` | `0` | `+1`
- Dikonfigurasi di `/letters/pengaturan` → section "Format Tanggal"
- `buildTodayVars(hijriOffset?: number)` menerima offset, default `0`

**Nama bulan Hijriah (Indonesia)**:
```
1. Muharram    5. Jumadil Awal   9. Ramadan
2. Safar       6. Jumadil Akhir 10. Syawal
3. Rabiul Awal 7. Rajab         11. Dzulqa'dah
4. Rabiul Akhir 8. Sya'ban      12. Dzulhijjah
```

**Nama hari (Indonesia)**:
```
0. Ahad (Minggu)  3. Rabu   6. Sabtu
1. Senin          4. Kamis
2. Selasa         5. Jumat
```

### 3e. Implementasi `buildTodayVars()`

```typescript
// Tambah parameter hijriOffset opsional
function buildTodayVars(hijriOffset = 0): Record<string, string> {
  const now = new Date();
  const dd   = now.getDate();
  const mm   = now.getMonth(); // 0-indexed
  const yyyy = now.getFullYear();

  // Hijriah via Intl — shift sesuai offset sebelum konversi
  const shifted = new Date(now);
  shifted.setDate(shifted.getDate() + hijriOffset);
  const hijriParts = new Intl.DateTimeFormat("id-ID-u-ca-islamic-umalqura", {
    year: "numeric", month: "numeric", day: "numeric",
  }).formatToParts(shifted);
  const hDay   = Number(hijriParts.find(p => p.type === "day")?.value);
  const hMonth = Number(hijriParts.find(p => p.type === "month")?.value);
  const hYear  = Number(hijriParts.find(p => p.type === "year")?.value);

  return {
    "today":       `${String(dd).padStart(2,"0")}/${String(mm+1).padStart(2,"0")}/${yyyy}`,
    "today.id":    `${dd} ${ID_MONTHS[mm]} ${yyyy}`,
    "today.roman": ROMAN_MONTHS[mm],
    "today.year":  String(yyyy),
    "today.hijri": `${hDay} ${HIJRI_MONTHS[hMonth-1]} ${hYear} H`,
  };
}
```

### 3f. Format dua-baris M/H di Identitas Surat

Format `masehi_hijri` di-render langsung di `formatLetterDate()` → `renderIdentitasSurat()` — **bukan** via merge fields body surat.
HTML yang dihasilkan:
```html
Yogyakarta, 16 April 2026 M
<hr style="border:none;border-top:0.5px solid currentColor;opacity:0.4;margin:2px 0;">
27 Syawal 1447 H
```
Ini hanya berlaku di blok Identitas Surat (Layout 1 & 2).
Di body surat gunakan `{{today.hijri}}` secara terpisah jika perlu.

---

## 4. Perubahan Schema yang Dibutuhkan

### 4a. Tabel `letter_types` — tambah kolom

```typescript
// Tambah di createLetterTypesTable()
identitasLayout: text("identitas_layout", {
  enum: ["layout1", "layout2", "layout3"]
}).notNull().default("layout1"),

showLampiran: boolean("show_lampiran").notNull().default(true),
// Layout 3 otomatis false, Layout 1 & 2 default true

// dateFormat nullable — NULL berarti ikut global default dari settings
dateFormat: text("date_format", {
  enum: ["masehi", "masehi_hijri"]
}),
// NULL         = ikut global default (settings.letter_date_format)
// "masehi"     = "Yogyakarta, 16 April 2026"
// "masehi_hijri" = dua baris: "Yogyakarta, 16 April 2026 M" + "27 Syawal 1447 H"
```

### 4b. Tabel `letters` — tambah kolom

```typescript
// Field teks lampiran — berbeda dari attachment_urls (file path)
// Contoh nilai: "1 (satu) berkas", "—", "2 lembar"
attachmentLabel: text("attachment_label"),
```

### 4c. ALTER TABLE untuk tenant yang sudah ada

```sql
-- letter_types
ALTER TABLE "tenant_{slug}".letter_types
  ADD COLUMN IF NOT EXISTS identitas_layout TEXT NOT NULL DEFAULT 'layout1',
  ADD COLUMN IF NOT EXISTS show_lampiran    BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS date_format      TEXT;  -- NULL = ikut global default

-- letters
ALTER TABLE "tenant_{slug}".letters
  ADD COLUMN IF NOT EXISTS attachment_label TEXT;

-- settings (untuk hijri offset — jalankan 1x per tenant)
-- (disimpan di settings table, bukan ALTER TABLE)
-- INSERT INTO "tenant_{slug}".settings (key, group, value)
--   VALUES ('letter_hijri_offset', 'general', '0')
--   ON CONFLICT (key, group) DO NOTHING;
```

---

## 5. Konfigurasi di Form Jenis Surat

Saat user membuat/mengedit **Jenis Surat** (`/letters/template` bagian LetterTypeManageClient),
tambah section **"Format Identitas Surat"**:

```
[ Layout Identitas Surat ]
  ○ Layout 1 — Dua Kolom (identitas kiri, tanggal kanan)    [preview mini]
  ○ Layout 2 — Tanggal di Atas (tanggal pojok kanan, identitas di bawah)
  ○ Layout 3 — Terpusat (SE, SK, Pengumuman)

[ Format Tanggal ]
  ○ Default (ikut pengaturan global)
  ○ Masehi saja      → Yogyakarta, 16 April 2026
  ○ Masehi + Hijriah → Yogyakarta, 16 April 2026 M
                        27 Syawal 1447 H
  (Layout 3 tidak menampilkan tanggal di atas — tanggal di bawah dekat TTD)

[ Tampilkan Lampiran ]  ☑  (disable otomatis jika Layout 3)
```

### Pengaturan Global di `/letters/pengaturan`

Section **"Format Tanggal"**:
```
[ Default Format Tanggal ]
  ○ Masehi saja      → Yogyakarta, 16 April 2026
  ○ Masehi + Hijriah → Yogyakarta, 16 April 2026 M
                        27 Syawal 1447 H

[ Penyesuaian Hijriah ]
  Selisih hari: [ -1 | 0 | +1 ]
  Keterangan: Sesuaikan jika kalender pemerintah Indonesia berbeda
              dari kalkulasi internasional (Umm al-Qura)
```

Disimpan di settings:
- `key="letter_date_format", group="general"` → `"masehi"` atau `"masehi_hijri"`
- `key="letter_hijri_offset", group="general"` → `-1`, `0`, atau `1`

---

## 6. Tujuan Surat

**Tujuan Surat** adalah blok alamat penerima — tampil di antara Identitas Surat dan body surat.
Hanya muncul di PDF dan halaman view publik, **tidak ada** di form editor.

### 6a. Format Default

```
Kepada Yth.
[Nama Penerima]
[Jabatan]
[Instansi / Organisasi]
di Tempat
```

Contoh terisi:
```
Kepada Yth.
Bapak Ahmad Fauzan
Direktur Utama
PT Karya Mandiri Nusantara
di Tempat
```

### 6b. Sumber Data

| Baris | Sumber | Wajib? |
|---|---|---|
| `Kepada Yth.` | Teks literal | Selalu tampil |
| Nama penerima | `letters.recipient` | Wajib — jika kosong seluruh blok tidak tampil |
| Jabatan | `letters.merge_fields.recipient_title` | Opsional — jika kosong, baris dilewati |
| Instansi | `letters.merge_fields.recipient_organization` | Opsional — jika kosong, baris dilewati |
| `di Tempat` | Teks literal | Selalu tampil jika blok tampil |

### 6c. Aturan Tampil/Sembunyikan

- Jika `letters.recipient` kosong → seluruh blok Tujuan Surat tidak ditampilkan
- Jabatan dan instansi bersifat opsional — baris kosong dilewati (tidak menambah spasi kosong)
- `di Tempat` selalu literal — tidak menggunakan alamat penerima dari `recipient_address`
  (alamat lengkap hanya dipakai untuk merge fields di body surat, misal `{{recipient.address}}`)

### 6d. Layout 3 — Tidak ada Tujuan Surat

Layout 3 (Terpusat: SE, SK, Pengumuman) **tidak menampilkan** blok Tujuan Surat.
Surat jenis ini ditujukan kepada umum / semua pihak, bukan satu penerima spesifik.

### 6e. Fungsi Render

```typescript
// Di lib/letter-html.ts
function renderTujuanSurat(params: {
  recipientName:         string | null;
  recipientTitle:        string | null;
  recipientOrganization: string | null;
  showTujuan:            boolean;  // false untuk Layout 3
}): string {
  if (!params.showTujuan || !params.recipientName) return "";

  const lines = [
    "Kepada Yth.",
    params.recipientName,
    params.recipientTitle        || null,
    params.recipientOrganization || null,
    "di Tempat",
  ].filter(Boolean);

  return `<div class="tujuan-surat">${lines.map(l => `<p>${l}</p>`).join("")}</div>`;
}
```

---

## 7. Render di PDF & Detail View

Di `lib/letter-html.ts` → fungsi `buildLetterHtml()`:

```typescript
// Saat ini: identitas surat hardcoded sebagai satu blok
// Setelah perubahan: render berbeda tergantung identitasLayout

function renderIdentitasSurat(params: {
  identitasLayout: "layout1" | "layout2" | "layout3";
  dateFormat:      "masehi" | "masehi_hijri";
  letterNumber:    string | null;
  subject:         string;
  attachmentLabel: string | null;
  showLampiran:    boolean;
  letterDate:      Date;    // raw Date object — diformat di dalam fungsi sesuai dateFormat
  hijriOffset:     number;  // dari settings, default 0
  orgCity:         string;  // dari settings.contact_address
  letterTypeName:  string;  // untuk Layout 3
}): string { ... }

// Format tanggal di dalam fungsi:
// masehi       → "Yogyakarta, 16 April 2026"
// masehi_hijri → dua baris HTML: "Yogyakarta, 16 April 2026 M<br>27 Syawal 1447 H"
```

**Layout 3** membutuhkan `letter_types.name` — perlu di-fetch saat generate PDF.
Saat ini PDF route tidak fetch `letter_types`. Perlu ditambah.

---

## 8. Render di Detail View (Web)

Di `keluar/[id]/page.tsx` dan `nota/[id]/page.tsx`:
- Ambil `identitasLayout`, `dateFormat` dari `letterType` (sudah di-fetch)
- Ambil `hijriOffset` dari settings
- Pass ke `renderIdentitasSurat()` dan `renderTujuanSurat()`

---

## 8. Pertanyaan Terbuka (perlu keputusan sebelum eksekusi)

### Q1: Format tanggal ✅ SELESAI
- Per jenis surat (`letter_types.date_format`, nullable) — `NULL` ikut global default dari settings
- Global default di `/letters/pengaturan`: `letter_date_format` = `"masehi"` | `"masehi_hijri"`
- Tidak ada nama hari, tidak ada override kota per surat

### Q2: Layout 3 — nama jenis surat CAPS otomatis atau manual? ✅ SELESAI
- **CSS `text-transform: uppercase` otomatis** — user input `Surat Edaran` tampil `SURAT EDARAN`
- Tidak perlu field tambahan, tidak tergantung input user

### Q3: `attachment_label` default ✅ SELESAI
- **Selalu manual** — user isi sendiri teks lampiran ("1 berkas", "2 lembar", "—")
- Tidak ada default otomatis berdasarkan file upload
- Alasan: jumlah file ≠ deskripsi lampiran (3 file bisa = "1 bundel")

### Q4: Kota ✅ SELESAI
- Prioritas: `letter_config.letter_city` (override manual) → `contact_address.regencyId` (otomatis) → kosong
- Override manual dikonfigurasi di `/letters/pengaturan` field "Kota Surat"
- Strip prefix: query `ref_regencies.type` → strip `"Kabupaten "` atau `"Kota "` (kata penuh, bukan singkatan)
- Tidak ada override kota per surat — kota adalah setting organisasi

### Q5: Kalender Hijriah ✅ SELESAI
- Base: `islamic-umalqura` via `Intl.DateTimeFormat` bawaan Node.js/Bun — zero dependency
- Offset ±1 hari: `settings.letter_hijri_offset`, dikonfigurasi di `/letters/pengaturan`

---

## 9. Urutan Implementasi (setelah proposal disetujui)

```
Step 1 — Schema
  ├─ Update createLetterTypesTable() — tambah identitas_layout, show_lampiran, date_format
  ├─ Update createLettersTable() — tambah attachment_label (+ letter_city jika Q4 disetujui)
  ├─ Update create-tenant-schema.ts (DDL)
  └─ ALTER TABLE untuk tenant existing (ikpm)

Step 2 — Kalender Hijriah + buildTodayVars
  ├─ Update lib/letter-merge.ts → buildTodayVars(hijriOffset)
  │    tambah: today.day, today.full_id, today.hijri
  │    ID_DAYS array (Ahad–Sabtu)
  │    HIJRI_MONTHS array (Muharram–Dzulhijjah)
  │    Intl.DateTimeFormat islamic-umalqura parsing
  └─ Update semua caller buildMergeContext → pass hijriOffset dari settings

Step 3 — Form Jenis Surat
  └─ Tambah di LetterTypeManageClient:
     - Radio group: layout (3 opsi)
     - Radio group: format tanggal (3 opsi, disable jika Layout 3)
     - Checkbox: tampilkan lampiran

Step 4 — Form Surat + Pengaturan
  ├─ Tambah field "Lampiran" (teks) di letter-form.tsx
  └─ Tambah section "Kalender Hijriah" di letter-config-client.tsx
     (hijri_offset: -1/0/+1)

Step 5 — Render PDF (letter-html.ts)
  ├─ renderIdentitasSurat() per layout + dateFormat
  ├─ renderTujuanSurat() — Kepada Yth. + nama + jabatan + instansi + di Tempat
  └─ Fetch hijriOffset + letterType dari settings di generate-pdf/route.ts

Step 6 — Render Detail View
  └─ Update keluar/[id]/page.tsx + nota/[id]/page.tsx
     (renderIdentitasSurat + renderTujuanSurat + body)
```
