# Arsitektur Tanda Tangan Surat — jalajogja

**Status: DIIMPLEMENTASIKAN (2026-04) — lihat bagian "Status Implementasi" di bawah**

---

## Latar Belakang

Sistem TTD saat ini (2026-04) sangat sederhana: semua signer ditampilkan sejajar dalam `flex-wrap`,
tidak ada konsep layout. Surat resmi organisasi membutuhkan layout TTD yang bervariasi sesuai
kebutuhan (sendiri, berdua, bertiga, dengan kolom saksi) dan alur penandatanganan via URL agar
pengurus tidak perlu masuk dashboard.

**Kebutuhan tambahan**: blok TTD harus menjadi satu komponen terpusat. Saat ada perubahan
tampilan atau logika, cukup edit satu tempat — semua halaman yang menampilkannya ikut berubah.
Halaman yang menggunakan komponen TTD:
- `/letters/template` — preview tampilan TTD sesuai layout yang dipilih
- `/letters/keluar/[id]` — status TTD aktual per slot
- `/letters/nota/[id]` — status TTD aktual per slot
- `lib/letter-html.ts` — render untuk PDF (berbagi logika layout, bukan komponen React)

---

## 1. Layout TTD — 7 Varian

```
LAYOUT 1: single-center          LAYOUT 2: single-left
       [TTD]                      [TTD]
       Nama                       Nama
       Jabatan                    Jabatan

LAYOUT 3: single-right           LAYOUT 4: double
                [TTD]             [TTD Kiri]     [TTD Kanan]
                Nama              Nama 1         Nama 2
                Jabatan           Jabatan 1      Jabatan 2

LAYOUT 5: triple-row
[TTD Kiri]   [TTD Tengah]   [TTD Kanan]
Nama 1       Nama 2         Nama 3

LAYOUT 6: triple-pyramid
[TTD Kiri]              [TTD Kanan]
Nama 1                  Nama 2

        [TTD Tengah]
        Nama 3

LAYOUT 7: double-with-witnesses
[TTD Kiri]              [TTD Kanan]
Nama 1                  Nama 2

Saksi:
[Saksi 1]    [Saksi 2]    [Saksi 3]
[Saksi 4]    [Saksi 5]    [Saksi 6]
(3 kolom per baris, dinamis, tak terbatas)
```

### Opsi Tanggal di Blok TTD
Toggle boolean per surat: tampilkan / sembunyikan tanggal TTD di bawah nama penandatangan.
Default: tampil. Dapat dimatikan karena tanggal surat sudah ada di bagian atas.

**Penting:** toggle ini HANYA mengontrol tampil/tidak. Format tanggal (Masehi /
Masehi+Hijri, nama kota, offset Hijriah) selalu mengikuti **pengaturan surat** di
`/letters/pengaturan → Format Tanggal Surat` (`letter_config.date_format`,
`letter_config.letter_city`, `letter_config.hijri_offset`). Tidak ada setting format
tanggal terpisah di blok TTD.

---

## 2. Alur Penandatanganan via URL (Fitur Baru)

### Di Dashboard (Admin/Sekretaris)

1. Pilih layout TTD di sidebar form surat
2. Assign officer ke setiap slot di halaman detail surat
3. Salin link TTD per slot (`/sign/{token}`) → kirim manual via WhatsApp/email
4. Pantau status setiap slot: Menunggu / Sudah TTD

### Di Halaman Publik (Officer yang Dituju)

Officer buka link `/sign/{token}` — tidak perlu login:

```
┌─────────────────────────────────────────┐
│  📄 Undangan Tanda Tangan               │
│                                         │
│  Perihal : Undangan Rapat Tahunan       │
│  Nomor   : 001/IKPM/IV/2026             │
│  Tanggal : 17 April 2026                │
│                                         │
│  Anda diminta menandatangani sebagai:   │
│  ✍️  Penandatangan                       │
│                                         │
│  [Lihat Preview Surat ▼]                │
│                                         │
│  [ Tanda Tangani Sekarang ]             │
└─────────────────────────────────────────┘
```

Setelah klik "Tanda Tangani Sekarang":

```
  ✅ Tanda tangan berhasil direkam

  [QR Code muncul — link ke /{slug}/verify/{hash}]

  "Tanda tangan Anda telah tercatat.
   Sertifikasi dapat diverifikasi via QR di atas."
```

State halaman yang mungkin:
- `invalid` — token tidak ditemukan
- `expired` — token kadaluarsa (default: 30 hari)
- `already-signed` — sudah pernah TTD
- `pending` — menunggu konfirmasi
- `success` — setelah TTD berhasil

---

## 3. Perubahan Data Model

### Tabel `letters` — 2 kolom baru

```sql
signature_layout    TEXT    NOT NULL DEFAULT 'double'
  -- nilai: single-center | single-left | single-right |
  --        double | triple-row | triple-pyramid | double-with-witnesses

signature_show_date BOOLEAN NOT NULL DEFAULT true
```

### Tabel `letter_signatures` — perubahan struktural

**Kolom baru:**
```sql
slot_order      INTEGER  NOT NULL DEFAULT 1
  -- urutan slot dalam layout: 1=kiri, 2=kanan, 3=tengah, dst.

slot_section    TEXT     NULLABLE
  -- null   = slot utama (penandatangan/penyetuju)
  -- 'witnesses' = slot saksi (khusus layout double-with-witnesses)

signing_token   TEXT     UNIQUE NULLABLE
  -- UUID untuk URL publik /{slug}/sign/{token}
  -- null = tidak diundang via link (TTD langsung dari dashboard)
  -- dikosongkan setelah TTD berhasil (prevent reuse)
```

**Kolom yang diubah menjadi nullable** (saat ini NOT NULL):
```sql
signed_at           TIMESTAMP  NULLABLE  -- null = belum TTD
verification_hash   TEXT       NULLABLE  -- null = belum TTD
```

Ini memungkinkan slot di-assign (dengan officer + token) sebelum TTD dilakukan.

---

## 4. UI Dashboard — Implementasi Aktual

### Form surat (new/edit) — bawah body (letter-form.tsx)

Section TTD selalu tampil di bawah body editor — tidak di sidebar, tidak accordion.

```
┌─── Tanda Tangan ────────────────────────────────────────────────┐
│  Layout: [Dropdown ▼]      [☑] Tampilkan tanggal TTD            │
│                                                                   │
│  ┌─────────────────────────┐  ┌─────────────────────────┐       │
│  │ KIRI                    │  │ KANAN                   │       │
│  │ [Combobox: pilih officer│  │ [Combobox: pilih officer│       │
│  │  Ahmad Fauzi ▼        ] │  │  Mukhlis ▼            ] │       │
│  │                         │  │                         │       │
│  │  Preview: _____________ │  │  Preview: _____________ │       │
│  │  Jabatan                │  │  Jabatan                │       │
│  └─────────────────────────┘  └─────────────────────────┘       │
│                                                                   │
│  Assign pengurus ke tiap slot. Tanda tangan dan QR dilakukan    │
│  dari halaman detail.                                            │
└───────────────────────────────────────────────────────────────────┘
```

- Layout picker: dropdown 7 varian
- Toggle tanggal: checkbox
- Combobox per slot: nama **cetak tebal + garis bawah**, jabatan di bawah, divisi di bawah, badge role (ketua/sekretaris/dll)
- Preview `SignatureBlock mode="preview"` terupdate realtime saat layout berubah
- State slot (`SlotInput[]`) disimpan lokal; di-sync ke DB via `syncSignatureSlotsAction` saat surat disimpan

### Halaman detail surat — Status TTD (read-only + aksi terbatas)

```
┌─── Penandatangan ───────────────────────────────────────────────┐
│                                                                   │
│  [Preview SignatureBlock mode="live"]                            │
│                                                                   │
│  ┌──────────────────────────────────┐  ┌────────────────────┐   │
│  │ KIRI                   ⏳ Menunggu│  │ KANAN      ✅ TTD  │   │
│  │ Ahmad Fauzi                       │  │ Mukhlis            │   │
│  │ Ketua Umum                        │  │ Sekretaris         │   │
│  │                                   │  │                    │   │
│  │ [✍️ TTD Sekarang]  (jika loginnya │  │ [🔍 QR ▼]         │   │
│  │                    officer tsb.)  │  │ [Hapus TTD] (adm)  │   │
│  │                                   │  └────────────────────┘   │
│  │ Link TTD — kirim ke penandatangan:│                           │
│  │ ┌────────────────────────────┐[📋]│                           │
│  │ │ app.../sign/uuid-token...  │    │                           │
│  │ └────────────────────────────┘    │                           │
│  │ [Batalkan] (admin)                │                           │
│  └──────────────────────────────────┘                           │
│                                                                   │
│  (Jika slot belum punya token — slot lama / edge case:)          │
│  │ [✏️ Buat Link TTD] (admin)                                    │
└───────────────────────────────────────────────────────────────────┘
```

**Aturan tampilan link TTD di detail mode:**
- Jika slot memiliki `signingToken` → tampil sebagai text input read-only berisi URL lengkap
  `{APP_URL}/{slug}/sign/{token}` + tombol copy di sebelahnya (klik field → select-all otomatis)
- Jika slot **tidak** memiliki token dan belum TTD → tombol **"Buat Link TTD"** (admin only),
  memanggil `generateSigningTokenAction` on-demand. Token muncul di UI tanpa perlu refresh.
- Jika sudah TTD → link TTD tersembunyi, digantikan QR verifikasi

Tidak ada combobox assign di detail page. Assignment dilakukan di edit page.

---

## 5. Halaman Publik `/sign/[token]` (Baru)

**Route:** `/(public)/[tenant]/sign/[token]/page.tsx`

- Tidak butuh login (di luar route group `(dashboard)`)
- Pattern sama dengan `/(public)/[tenant]/verify/[hash]` yang sudah ada
- Tampilkan: nama organisasi, perihal surat, nomor, tanggal, nama officer yang diundang, peran
- Accordion "Lihat Preview Surat" — render body surat via `renderBody()`
- Tombol "Tanda Tangani Sekarang" → panggil `signByTokenAction`
- Setelah success: tampilkan QR verifikasi + pesan konfirmasi

**Files:**
- `app/(public)/[tenant]/sign/[token]/page.tsx` — server component (state: invalid, expired, already-signed, pending)
- `components/letters/signing-page-client.tsx` — tombol TTD + QR setelah berhasil
- `signByTokenAction` ada di `letters/actions.ts` (bukan file terpisah)

---

## 6. Perubahan PDF Rendering (letter-html.ts)

Saat ini: semua signer dalam `flex-wrap` sejajar.
Perlu: render berdasarkan `signature_layout`.

| Layout | Struktur HTML/CSS |
|---|---|
| `single-center` | flex, `justify-content: center` |
| `single-left` | flex, `justify-content: flex-start` |
| `single-right` | flex, `justify-content: flex-end` |
| `double` | flex, `justify-content: space-between`, max 2 slot |
| `triple-row` | flex, `justify-content: space-between`, 3 slot sejajar |
| `triple-pyramid` | 2 div baris: baris atas 2 slot (space-between) + baris bawah 1 slot (center) |
| `double-with-witnesses` | baris utama 2 slot + label "Saksi:" + grid 3 kolom untuk witness slots |

**Aturan render slot di PDF:**
- Slot yang sudah `signed_at IS NOT NULL` → tampilkan QR + nama + jabatan + tanggal (jika `signature_show_date`)
- Slot yang belum TTD → tampilkan nama + jabatan, spasi kosong sebagai pengganti QR (garis `___`)

**Aturan format tanggal di blok TTD:**
Format tanggal TTD **tidak punya setting sendiri** — selalu pakai `letter_config` dari pengaturan surat:
- `date_format = "masehi"` → `17 April 2026`
- `date_format = "masehi_hijri"` → `17 April 2026 / 27 Syawal 1447 H`
- Kota tidak ditampilkan di blok TTD (kota hanya untuk bagian atas surat)
- `hijri_offset` diterapkan sama seperti di header surat

Fungsi render tanggal TTD memanggil helper yang sama dengan tanggal surat:
```typescript
// lib/letter-html.ts
formatSignatureDate(signedAt, letterConfig)
// → menggunakan letter_config.date_format + letter_config.hijri_offset
// → tanpa letter_config.letter_city (kota tidak relevan di blok TTD)
```

---

## 7. Arsitektur Komponen — 4 Layer

Blok TTD dipisah menjadi 4 layer agar perubahan cukup di satu tempat:

```
┌─────────────────────────────────────────────────────────────────────┐
│  Layer 1: Shared Logic                                              │
│  lib/letter-signature-layout.ts                                     │
│  ─────────────────────────────                                      │
│  • Definisi 7 layout (nama, jumlah slot, posisi kiri/kanan/tengah) │
│  • Types: SignatureLayout, SignatureSlot, SlotSection               │
│  • Pure functions: getLayoutSlots(), getSlotLabel()                 │
│  • Tidak ada import React, tidak ada DOM — bisa dipakai di server   │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ import
           ┌───────────────────┼───────────────────┐
           ▼                   ▼                   ▼
┌──────────────────┐  ┌─────────────────┐  ┌──────────────────────┐
│  Layer 2:        │  │  Layer 3:       │  │  Layer 4:            │
│  SignatureBlock  │  │  SignatureSlot  │  │  letter-html.ts      │
│  (Read-only)     │  │  Manager       │  │  (PDF Generator)     │
│                  │  │  (Interaktif)  │  │                      │
│  React component │  │  React client  │  │  HTML string builder │
│  server-safe     │  │  component     │  │  bukan React         │
│                  │  │                │  │                      │
│  Mode "preview": │  │  Wraps Layer 2 │  │  renderSignature     │
│  placeholder     │  │  + tambah:     │  │  BlockHtml(layout,   │
│  officer dummy   │  │  - combobox    │  │  slots, config)      │
│                  │  │    assign      │  │                      │
│  Mode "live":    │  │  - copy link   │  │  Sama logika layout, │
│  data nyata +    │  │  - QR viewer   │  │  output HTML string  │
│  QR codes        │  │  - revoke      │  │  bukan JSX           │
└──────────────────┘  └─────────────────┘  └──────────────────────┘
```

### Layer 1 — `lib/letter-signature-layout.ts` (shared, baru)

```typescript
export const SIGNATURE_LAYOUTS = {
  "single-center":        { label: "1 TTD — Tengah",       mainSlots: 1 },
  "single-left":          { label: "1 TTD — Kiri",         mainSlots: 1 },
  "single-right":         { label: "1 TTD — Kanan",        mainSlots: 1 },
  "double":               { label: "2 TTD — Kiri & Kanan", mainSlots: 2 },
  "triple-row":           { label: "3 TTD — Sejajar",      mainSlots: 3 },
  "triple-pyramid":       { label: "3 TTD — Piramid",      mainSlots: 3 },
  "double-with-witnesses":{ label: "2 TTD + Kolom Saksi",  mainSlots: 2 },
} as const;

export type SignatureLayout = keyof typeof SIGNATURE_LAYOUTS;

export type SignatureSlot = {
  order:       number;           // 1, 2, 3...
  section:     "main" | "witnesses";
  officerName: string | null;    // null = slot kosong (belum di-assign)
  position:    string | null;
  division:    string | null;
  role:        "signer" | "approver" | "witness" | null;
  signedAt:    Date | null;      // null = belum TTD
  qrDataUrl:   string | null;    // null = belum TTD atau optimistic
  verifyUrl:   string | null;
};
```

### Layer 2 — `components/letters/signature-block.tsx` (read-only display, baru)

```typescript
type SignatureBlockProps = {
  layout:          SignatureLayout;
  slots:           SignatureSlot[];
  showDate:        boolean;
  letterConfig:    { date_format: string; hijri_offset: number };
  mode:            "preview" | "live";
  // "preview" → tampilkan slot kosong dengan placeholder (nama "___", QR placeholder)
  // "live"    → tampilkan data nyata, slot kosong = "Menunggu TTD"
};
```

**Dipakai di:**
- `template/page.tsx` — mode `"preview"`, layout sesuai default, tidak ada data nyata
- `keluar/[id]/page.tsx` — mode `"live"`, data dari DB
- `nota/[id]/page.tsx` — mode `"live"`, data dari DB

### Layer 3 — `components/letters/signature-slot-manager.tsx` (interaktif)

Membungkus `<SignatureBlock>` + menambahkan kontrol admin. Dua mode:

**`mode="form"`** — dipakai di edit/new page:
- State lokal (`SlotInput[]`), tidak langsung ke DB
- Combobox assign officer per slot (search by name/position, badge role berwarna)
- Officer di combobox: nama **cetak tebal + garis bawah**, jabatan di bawah, divisi di bawah
- `onChange` callback — emit `SlotInput[]` ke parent form
- Preview `SignatureBlock mode="preview"` realtime
- Save via parent: `syncSignatureSlotsAction` dipanggil saat `handleSave`

**`mode="detail"`** — dipakai di halaman detail surat:
- Tidak ada combobox assign (slot sudah final dari DB)
- Jika slot punya `signingToken` → URL lengkap dalam text input read-only + tombol copy
- Jika slot tidak punya token + belum TTD → tombol **"Buat Link TTD"** (admin) →
  panggil `generateSigningTokenAction` → token muncul langsung tanpa refresh
- Tombol "✍️ TTD Sekarang" untuk officer yang sedang login (jika `isCurrentUser`)
- Toggle QR viewer untuk slot yang sudah TTD
- Tombol "Batalkan" / "Hapus TTD" untuk admin

**`AvailableOfficer` type:**
```typescript
export type AvailableOfficer = {
  officerId:     string;
  name:          string;
  position:      string;
  division:      string | null;    // nama divisi (bukan kode)
  userRole:      string | null;    // ketua|sekretaris|bendahara|custom|owner — dari tenant.users
  canSign:       boolean;
  isCurrentUser: boolean;          // untuk tombol "TTD Sekarang" di detail mode
};
```

`userRole` di-fetch via JOIN: `officers.memberId → public.members.id ← tenant_users.memberId`.

### Layer 4 — `lib/letter-html.ts` (PDF, sudah ada, diupdate)

Tidak menggunakan React — tetap generate HTML string.
Import `SIGNATURE_LAYOUTS` dan helpers dari `lib/letter-signature-layout.ts` agar logika
layout tetap konsisten dengan yang ditampilkan di UI:

```typescript
import { renderSignatureBlockHtml } from "@/lib/letter-signature-layout";
// → menggantikan `signSection` yang hardcoded saat ini
```

---

## 8. Penggunaan di Setiap Halaman

### `/letters/template` — Preview Layout TTD

Halaman template menampilkan preview blok TTD (dummy, tanpa data nyata):
```tsx
<SignatureBlock mode="preview" layout={selectedLayout} slots={[]} showDate={true} ... />
```
Ketika admin ganti layout di dropdown → preview langsung berubah (client-side).

### `/letters/keluar/[id]/edit` dan `/letters/nota/[id]/edit` — Assign Officer

```tsx
// Edit page fetch: availableOfficers (dengan userRole), initialSlots dari DB
<LetterForm
  availableOfficers={availableOfficers}
  initialSlots={initialSlots}   // SlotInput[] dari letter_signatures
  ...
/>

// Di dalam LetterForm:
<SignatureSlotManager
  mode="form"
  layout={form.signatureLayout}
  initialSlots={toDisplaySlots(slots)}   // konversi SlotInput[] → SignatureSlot[]
  availableOfficers={availableOfficers}
  onChange={(newSlots) => setSlots(newSlots)}
/>

// handleSave: await syncSignatureSlotsAction(slug, letterId, slots)
```

### `/letters/keluar/[id]` dan `/letters/nota/[id]` — Status Aktual

```tsx
// Detail page — tidak ada combobox, hanya status + aksi signing
<SignatureSlotManager
  mode="detail"
  layout={signatureLayout}
  initialSlots={slots}         // SignatureSlot[] lengkap dari DB + QR
  availableOfficers={availableOfficers}  // untuk isCurrentUser detection
  appUrl={appUrl}              // untuk copy signing link
  isAdmin={isAdmin}
/>
```

---

## 9. Daftar File (Status Aktual)

| File | Status | Deskripsi |
|---|---|---|
| `lib/letter-signature-layout.ts` | ✅ Selesai | Layer 1 — types, 7 layout config, `renderSignatureBlockHtml()` |
| `components/letters/signature-block.tsx` | ✅ Selesai | Layer 2 — read-only display, mode preview/live |
| `components/letters/signature-slot-manager.tsx` | ✅ Selesai | Layer 3 — mode "form" (assign) + mode "detail" (status/QR/signing) |
| `components/letters/letter-signing-section.tsx` | ✅ Dihapus | Digantikan `SignatureSlotManager` |
| `components/letters/letter-template-form.tsx` | ✅ Selesai | Preview TTD (Layer 2, mode preview) |
| `components/letters/signing-page-client.tsx` | ✅ Selesai | UI publik signing — tombol TTD + QR setelah berhasil |
| `lib/letter-html.ts` | ✅ Selesai | Layer 4 — pakai `renderSignatureBlockHtml()` dari Layer 1 |
| `packages/db/src/schema/tenant/officers.ts` | ✅ Selesai | `slotOrder`, `slotSection`, `signingToken`, `signingTokenExpiresAt`, nullable signed fields |
| `packages/db/src/schema/tenant/letters.ts` | ✅ Selesai | `signatureLayout`, `signatureShowDate` |
| `packages/db/src/helpers/create-tenant-schema.ts` | ✅ Selesai | DDL tenant baru lengkap dengan kolom baru |
| `letters/actions.ts` | ✅ Selesai | `signLetterAction`, `removeSignatureAction`, `signByTokenAction`, `syncSignatureSlotsAction`, `generateSigningTokenAction`, `SlotInput` type |
| `app/(public)/[tenant]/sign/[token]/page.tsx` | ✅ Selesai | Halaman publik TTD — state: invalid, expired, already-signed, pending |
| `components/letters/letter-form.tsx` | ✅ Selesai | Layout picker + date toggle di bawah body + `SignatureSlotManager mode="form"` |
| `keluar/[id]/edit/page.tsx` | ✅ Selesai | Fetch `availableOfficers` (dengan userRole) + `initialSlots`, pass ke LetterForm |
| `nota/[id]/edit/page.tsx` | ✅ Selesai | Sama seperti keluar edit |
| `keluar/new/page.tsx` | ✅ Selesai | Fetch `availableOfficers`, pass `initialSlots=[]` |
| `nota/new/page.tsx` | ✅ Selesai | Sama seperti keluar new |
| `keluar/[id]/page.tsx` | ✅ Selesai | `SignatureSlotManager mode="detail"` + fetch `userRole` via tenant.users JOIN |
| `nota/[id]/page.tsx` | ✅ Selesai | Sama seperti keluar detail |
| `docs/migration-tandatangan.sql` | ✅ Selesai | Idempotent SQL untuk tenant existing |

---

## 10. Status Implementasi (2026-04) — SELESAI SEMUA

Semua fitur arsitektur TTD telah diimplementasikan. Tidak ada item yang pending.

### Ringkasan Implementasi per Layer

| Layer | Komponen | Status |
|---|---|---|
| Layer 1 | `lib/letter-signature-layout.ts` | ✅ Types, 7 layout, `renderSignatureBlockHtml()` |
| Layer 2 | `components/letters/signature-block.tsx` | ✅ Mode preview/live, semua 7 varian |
| Layer 3 | `components/letters/signature-slot-manager.tsx` | ✅ Mode "form" (edit page) + mode "detail" (detail page) |
| Layer 4 | `lib/letter-html.ts` | ✅ PDF pakai `renderSignatureBlockHtml()` dari Layer 1 |

### Alur Data Lengkap

```
[Edit/New Page]
  → LetterForm: slots: SlotInput[] (state lokal)
  → SignatureSlotManager mode="form": combobox assign officer
  → handleSave → syncSignatureSlotsAction(slug, letterId, slots)
     → INSERT/UPDATE/DELETE di letter_signatures (skip signed slots)
     → generate signing_token per slot (UUID, 30 hari)

[Detail Page]
  → fetch letter_signatures → SignatureSlot[]
  → fetch availableOfficers (dengan userRole dari tenant.users)
  → SignatureSlotManager mode="detail": status + copy link + QR

[Officer Sign via URL]
  → /(public)/[tenant]/sign/[token]
  → signByTokenAction: cek expiry → insert hash → clear token
  → QR verify URL muncul setelah TTD

[PDF Generate]
  → lib/letter-html.ts: renderSignatureBlockHtml(layout, slots, config)
  → Layout sama persis dengan yang ditampilkan di UI
```

### Keputusan yang Dikunci

- **Slot saksi**: bebas tambah tak terbatas (tidak ada batas max)
- **Token expiry**: 30 hari sejak `syncSignatureSlotsAction`
- **Identifikasi via link**: siapapun yang punya token bisa TTD (no login, no extra confirm)
- **Slot belum TTD di PDF**: nama + jabatan + garis `___` sebagai pengganti QR
- **Assignment di edit page, bukan detail page**: detail hanya tampilkan status + aksi signing
- **Layout picker di bawah body**: bukan accordion sidebar — selalu tampil
- **`userRole` di combobox**: badge berwarna — dari JOIN `tenant.users` via `memberId`
- **`syncSignatureSlotsAction` token-stable**: token hanya di-regenerate jika officer berubah ATAU token null — link yang sudah dikirim tetap valid meski surat disimpan ulang berkali-kali
- **`syncSignatureSlotsAction` idempotent**: aman dipanggil berulang — signed slots tidak pernah diubah
- **`generateSigningTokenAction` idempotent**: jika token sudah ada kembalikan yang lama; hanya generate baru jika memang null
- **Link TTD tampil sebagai URL penuh**: bukan tombol "Salin" kecil — text input read-only berisi `{APP_URL}/{slug}/sign/{token}`, klik field → select-all, tombol copy di sebelahnya

---

## 11. Pertanyaan Terbuka

1. **Accordion "Lihat Preview Surat" di halaman publik `/sign/[token]`** — saat ini tidak ada preview isi surat. Tambahkan jika diperlukan.

---

## Referensi

- Sistem QR verifikasi: `docs/arsitektur-surat-detail.md`
- Halaman publik pattern: `app/(public)/[tenant]/verify/[hash]/page.tsx`
- Schema letter_signatures: `packages/db/src/schema/tenant/index.ts`
- Render PDF: `apps/web/lib/letter-html.ts`
- Pengaturan format tanggal: `apps/web/components/letters/letter-config-client.tsx`
  - `letter_config.date_format` — "masehi" | "masehi_hijri"
  - `letter_config.letter_city` — kota (tidak dipakai di blok TTD)
  - `letter_config.hijri_offset` — penyesuaian kalender Hijriah
