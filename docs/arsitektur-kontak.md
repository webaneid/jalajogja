# Arsitektur Kontak — jalakarta

> Status: **SELESAI** — audit ulang menyeluruh + fix konsistensi 2026-07-23 (lihat § "Audit
> Ulang 2026-07-23" di bawah). Refactoring E.164 pertama selesai 2026-05-13, tapi ternyata
> banyak form BARU yang dibangun setelah itu (invoice manual, payment manual, kontak surat,
> settings toko/kontak organisasi, dll) tidak mengikuti aturan ini — semua sudah ditutup.
> Dokumen ini adalah sumber kebenaran tunggal untuk semua hal terkait kontak (phone, WA, email).

---

## Prinsip Utama

> **Satu helper, satu komponen, satu format. Tidak ada pengecualian — termasuk untuk
> nomor kantor/landline dan kontak organisasi.**

Semua kontak di sistem — phone, WhatsApp, email — punya satu cara input, satu cara simpan,
dan satu cara tampil, di SEMUA form yang membutuhkannya, baik di dashboard admin maupun
front-end publik.

---

## Infrastruktur yang Sudah Ada (Jangan Diganti)

### Komponen Input

| Komponen | File | Dipakai untuk |
|----------|------|---------------|
| `PhoneInput` | `components/ui/phone-input.tsx` | **SEMUA** input phone + WA — anggota, akun publik, kontak organisasi, kontak surat, invoice manual, payment manual, dll |

**Aturan**: Semua input nomor telepon dan WhatsApp wajib pakai `PhoneInput`. Tidak ada
plain `<input type="tel">` untuk data yang disimpan ke DB — termasuk field yang "boleh
format lokal" (nomor kantor/landline). `PhoneInput` menghasilkan E.164 yang valid untuk
landline juga (mis. `+62274123456`) — hanya UX placeholder-nya condong ke mobile, pakai prop
`hint` untuk menjelaskan konteks landline jika perlu.

### Storage

**Anggota IKPM** — kontak tersimpan di `public.contacts` (tabel terpisah):
```
public.members.contact_id → public.contacts.id
public.contacts: phone, whatsapp, email, is_phone_public, is_whatsapp_public, is_email_public
```

**Akun Publik** — kontak tersimpan langsung di `public.profiles`:
```
public.profiles: phone, whatsapp, email
```

**Transaksi & snapshot** — kontak disimpan langsung di waktu terjadinya (tidak lookup ulang):
```
event_registrations: attendee_phone, attendee_email
donations:           donor_phone, donor_email
invoices:            customer_phone, customer_email
payments:            payer_phone, payer_email
contact_submissions: phone           (form "Hubungi Kami" publik)
letter_contacts:     phone           (kontak eksternal modul Surat)
```

**Settings organisasi & modul** — tersimpan di `tenant.settings` JSONB, value = JSON string scalar:
```
group="contact", key="contact_phone"     → nomor kantor/landline organisasi
group="contact", key="contact_whatsapp"  → WA resmi organisasi
group="toko",    key="toko_whatsapp"     → WA kontak bantuan toko
```

**Cart-flow JSON snapshot** — data peserta tiket event via cart universal disimpan sementara
sebagai JSON di `cart_items.notes` (`{attendeeName, attendeePhone, attendeeEmail, ...}`),
lalu di-parse ulang saat invoice lunas dan di-insert ke `event_registrations.attendee_phone`.
**Kedua titik (tulis JSON di cart, DAN parse-insert ke event_registrations) wajib
`normalizePhone()`** — bukan cukup salah satu, karena JSON blob tidak dijamin selalu berasal
dari jalur yang sudah menormalisasi.

### API Self-Service

| Endpoint | Dipakai oleh |
|----------|-------------|
| `PATCH /api/akun/member-contact` | Anggota IKPM edit kontak |
| `PATCH /api/akun/profile-data` | Akun publik edit kontak (`/akun/data`) |
| `PATCH /api/akun/profil` | **HANYA** nama tampilan ("Info Login", `/akun/profil`) — TIDAK menerima phone/whatsapp/alamat sama sekali (lihat § "Dua Endpoint Profil" di bawah) |

---

## Format Penyimpanan: E.164

Semua nomor telepon dan WhatsApp di DB disimpan dalam format **E.164**:

```
+[kode negara][nomor tanpa awalan nol lokal]

Benar:  +6281234567890   (Indonesia)
        +60123456789     (Malaysia)
        +62274123456     (landline Yogyakarta, kode area tanpa 0 di depan)
        NULL             (tidak diisi)

Salah:  08123456789      (format lokal — tidak boleh)
        +62 812-3456     (ada spasi/tanda baca — tidak boleh)
        6281234567890    (tanpa + — tidak boleh)
```

Default negara: **Indonesia (+62)**. User bisa pilih negara lain di `PhoneInput`.

---

## `PhoneInput` — Cara Kerja (Sudah Benar, Jangan Diubah)

- **Output**: E.164 lengkap (`+628...`) via prop `onChange`
- **Input**: digit saja, country flag+selector di kiri
- **Load**: `parseE164(value)` — parse `08xxx` → Indonesia E.164 otomatis
- **Country default**: Indonesia (+62), bisa diubah user
- Props penting: `label`, `value` (E.164), `onChange` (callback → E.164), `hint`, `optional`, `required`, `disabled`
- **Controlled component murni** — tidak punya `name` attribute untuk native `FormData`
  extraction. Kalau form pemanggil pakai `FormData`/`fd.get(...)`, WAJIB lift nomor ke
  `useState` terpisah dan kirim value itu langsung ke server action (bukan lewat `FormData`).

---

## Helper `lib/phone.ts`

```typescript
// lib/phone.ts

// Normalisasi server-side (defense in depth — bukan pengganti PhoneInput)
export function normalizePhone(raw: string | null | undefined): string | null { ... }

// Display: +628xxx → 0812-xxx (lebih enak dibaca orang Indonesia)
export function displayPhone(e164: string | null | undefined): string { ... }

// Format digit-saja untuk wa.me/api.whatsapp.com link dan GOWA send API — WAJIB
// dipanggil dengan nilai E.164 ASLI, BUKAN hasil displayPhone() (lihat § bug di bawah).
export function toWaDigits(raw: string | null | undefined): string {
  const normalized = normalizePhone(raw);
  return normalized ? normalized.replace(/^\+/, "") : "";
}
```

**Tiga aturan baku, tidak boleh dilanggar:**
1. **Semua input phone/WA** → pakai `<PhoneInput>`
2. **Semua server insert/update phone/WA** → panggil `normalizePhone()`
3. **Semua display phone/WA** → panggil `displayPhone()`
4. **Semua link `wa.me`/`api.whatsapp.com`** → bangun dari nilai E.164 ASLI via `toWaDigits()`,
   **JANGAN PERNAH** dari hasil `displayPhone()` (lihat bug § di bawah)

### `packages/db` — duplikasi minimal, disengaja

`packages/db/src/helpers/billing.ts` (`createLinkedInvoice()` — dipakai bersama oleh
Toko/Donasi/Event untuk membuat invoice universal) butuh normalisasi phone juga, tapi
`packages/db` **tidak boleh** mengimpor `apps/web/lib/phone.ts` — package itu harus tetap
zero-dependency ke `@jalajogja/db` supaya aman dipakai client component (lihat lesson
`tenant-timezone.ts` di CLAUDE.md soal Postgres client bocor ke client bundle).

Solusinya: `packages/db/src/helpers/phone.ts` — duplikasi minimal `normalizePhone()` SAJA
(bukan `displayPhone`/`toWaDigits`, karena `packages/db` tidak butuh itu), dipakai hanya
internal oleh `createLinkedInvoice()`. Pola yang sama dengan `generateEventRegNumber`/
`formatEventDateWib` yang sudah lebih dulu diduplikasi demi isolasi antar package.

**Efek "single choke point"**: karena `createLinkedInvoice()` menormalisasi `customerPhone`
di satu tempat, SEMUA pemanggilnya (Toko `createOrderAction`, Donasi `createDonationAction`,
Event `registerForEventAction`) otomatis terlindungi tanpa perlu disentuh satu-satu.

---

## Bug yang Pernah Terjadi: `wa.me` Link Dibangun dari `displayPhone()`, Bukan E.164 Asli

**Gejala**: Link WhatsApp di halaman publik (`/anggota`, `/usaha/[id]`, `/pesantren/[id]`,
`/profesional/[id]`) menghasilkan `https://wa.me/081234567890` — **hilang kode negara**,
link rusak total.

**Root cause**: Nilai `whatsapp` yang sampai ke komponen tampilan SUDAH melewati
`displayPhone()` di server (`+6281234567890` → `081234567890`, format lokal untuk dibaca
orang Indonesia). Kode lama melakukan `whatsapp.replace(/\D/g, "")` pada nilai yang SUDAH
dilokalkan itu — hasilnya `081234567890` (leading zero, tanpa kode negara), bukan
`6281234567890` yang valid untuk `wa.me`.

**Fix**: setiap titik yang membangun link `wa.me` sekarang menyimpan **dua variabel
terpisah** — satu untuk teks tampilan (`displayPhone()`), satu untuk link
(`toWaDigits()` dipanggil pada nilai E.164 ASLI, SEBELUM di-`displayPhone()`):
```typescript
if (c.isWhatsappPublic) {
  whatsapp       = displayPhone(c.whatsapp);              // teks: "0812xxx"
  whatsappWaLink = `https://wa.me/${toWaDigits(c.whatsapp)}`; // link: dari E.164 asli
}
```
Untuk API yang mengirim data lintas client-server (`/api/member-public/[id]`), field
`whatsappWaLink` (URL wa.me lengkap, sudah jadi) dikirim SEBAGAI FIELD TERPISAH di response
JSON — bukan cuma `whatsapp` (yang sudah ter-`displayPhone()`) — supaya client tidak perlu
(dan tidak bisa) membangun ulang link dari nilai yang sudah terlanjur dilokalkan.

**Aturan berlaku selamanya**: begitu sebuah nilai phone/WA sudah dilewatkan `displayPhone()`,
JANGAN PERNAH proses ulang nilainya untuk keperluan LAIN (link, kalkulasi, dsb) — `displayPhone()`
adalah fungsi TERMINAL, hasilnya hanya untuk ditampilkan sebagai teks. Kalau butuh representasi
lain dari nomor yang sama, selalu turunkan dari nilai E.164 ASLI, bukan dari hasil `displayPhone()`.

---

## Dua Endpoint Profil — `/api/akun/profil` vs `/api/akun/profile-data`

Sempat ada DUA endpoint PATCH yang tumpang tindih menangani `phone`/`whatsapp`/alamat untuk
akun publik — keduanya live (dipanggil dua halaman berbeda: `/akun/profil` dan `/akun/data`),
tapi hanya SATU (`/api/akun/profile-data`) yang benar-benar dipakai kliennya untuk field itu.
`/api/akun/profil` (halaman "Info Login" — nama, email read-only, ganti password) menerima
`phone`/`whatsapp`/alamat di PATCH handler-nya tapi kliennya **tidak pernah mengirim field itu**
— kode mati yang tetap jadi attack surface (bisa dipanggil langsung via curl, unnormalized).

**Fix**: `/api/akun/profil` PATCH sekarang HANYA menerima `{ name }` — field phone/whatsapp/
alamat dihapus total dari GET response dan PATCH handler-nya. `/api/akun/profile-data` adalah
**satu-satunya** endpoint yang boleh mengubah kontak/alamat akun publik.

---

## Status Implementasi

### Fase 1–5 (2026-05-13) — Refactoring awal ✅
Helper, normalisasi server, input forms utama, display utama, backfill data lama saat itu.

### Audit Ulang 2026-07-23 — Konsistensi Menyeluruh ✅

Audit menyeluruh (semua form admin + publik, semua write site, semua display site, semua
link `wa.me`) menemukan form-form BARU yang dibangun setelah Fase 1–5 tidak mengikuti
aturan ini. Semua ditutup dalam satu sesi:

**Input form → `PhoneInput`** (9 file, 1 di antaranya dihapus karena dead code):
`toko-settings-form.tsx`, `accounts/new/akun-form-client.tsx`, `contact-settings-form.tsx`,
`payment-form.tsx` (2 field), `invoice-create-form.tsx`, `donation-form.tsx`,
`order-create-client.tsx`, `letter-contact-manage-client.tsx`, `contact-template.tsx`.
`qurban-order-form.tsx` + `createQurbanOrderAction` **dihapus** (dead code — sudah
digantikan `campaign-detail-client.tsx` yang benar sejak awal).

**Write-side `normalizePhone()`**: `saveTokoSettingsAction`, `createProfileAction` (+fix
dedup-check yang bandingkan nilai ter-normalisasi vs tidak), `saveContactSettingsAction`,
`createLinkedPaymentAction` (payer+donor), `createInvoiceAction`, `createDonationAction`
(2 write site dalam 1 fungsi), `submitContactFormAction`, `createLetterContactAction`/
`updateLetterContactAction`, `createLinkedInvoice()` (shared helper, `packages/db`),
cart-flow JSON snapshot write (`addEventTicketToCartAction`) + parse-insert
(`confirmInvoicePaymentAction`/`verifySubmittedPaymentAction`, 2 titik).

**Display-side `displayPhone()`**: 24 titik render mentah ditutup — admin (pesan masuk,
accounts list+detail, donasi/toko/billing invoice detail, payment detail, voucher detail,
bulk letter recipient picker, letter contacts list) dan publik (event registration
already-registered card + QR payload, akun event list, self-service usaha/pesantren/
profesional summary card, 3 footer design, contact-template, landing "Info Kontak").

**Konsolidasi helper duplikat** — 3 implementasi berbeda disatukan ke `lib/phone.ts`:
- `lib/whatsapp.ts:toE164()` (dipakai 3 route OTP) → dihapus, diganti `normalizePhone()`
- 3× fungsi lokal `normalizePhone()` di `dark-footer.tsx`/`light-footer.tsx`/`modern-footer.tsx`
  (dipakai untuk bangun link `wa.me`) → dihapus, diganti `toWaDigits()` baru

**Bug fungsional ditemukan+difix** (§ di atas): 4 titik `wa.me` link dibangun dari nilai
`displayPhone()` (rusak, hilang kode negara) — `anggota-directory-client.tsx` +
`/api/member-public/[id]`, dan 3 halaman detail publik (profesional/usaha/pesantren).

**Backfill data lama**: `packages/db/migrations/0041_backfill_phone_normalization.sql` —
menormalisasi `public.profiles.{phone,whatsapp}` + per-tenant
`{donations.donor_phone, payments.payer_phone, invoices.customer_phone,
event_registrations.attendee_phone, contact_submissions.phone, letter_contacts.phone}` +
settings JSONB (`contact_phone`, `contact_whatsapp`, `toko_whatsapp`). Idempotent (aman
dijalankan ulang), pakai `COALESCE` supaya tidak pernah menulis NULL ke kolom
`settings.value` JSONB NOT NULL. **Sudah dijalankan & diverifikasi di lokal** — ditemukan
1 baris `letter_contacts.phone` dan 2 baris settings (`contact_phone`/`contact_whatsapp`)
yang berhasil dinormalisasi (`contact_phone` bahkan sempat tersimpan sebagai JSON *number*,
bukan string — migration sekaligus membetulkan tipe datanya). **Belum dijalankan di VPS.**

---

## Aturan Baku (Tidak Boleh Dilanggar)

1. **Semua input phone/WA** → pakai `<PhoneInput>` dari `components/ui/phone-input.tsx` —
   tidak ada pengecualian untuk field "boleh format lokal"/landline/kontak organisasi
2. **Semua server insert/update phone/WA** → panggil `normalizePhone()` dari `lib/phone.ts`
   (atau `packages/db/src/helpers/phone.ts` untuk kode yang hidup di package itu)
3. **Semua display phone/WA** → panggil `displayPhone()` dari `lib/phone.ts`
4. **Semua link `wa.me`/`api.whatsapp.com`** → bangun dari E.164 asli via `toWaDigits()`,
   JANGAN PERNAH dari hasil `displayPhone()`
5. **Format DB** → E.164 atau NULL. Tidak ada format lain.
6. **Default negara** → Indonesia (+62). User yang punya nomor luar negeri pilih manual.
7. **Email** → simpan lowercase `.trim()`, tidak perlu konversi lain.
8. **Satu fungsi normalisasi per konteks** — jangan buat implementasi lokal baru
   (`function normalizePhone(...)` di dalam komponen) sekalipun terlihat sepele — itulah
   yang menyebabkan 3 implementasi kompetitif sempat ada di codebase ini.

---

## Yang TIDAK Diubah

- Arsitektur tabel `public.contacts` — sudah benar
- Behaviour `PhoneInput` component — sudah benar
- `step2-contact.tsx`, `step4-business.tsx`, `step5-pesantren.tsx` — sudah pakai PhoneInput dengan benar sejak awal
- `akun/data/page.tsx`, `akun/lengkapi/page.tsx` Step 2 — sudah pakai PhoneInput dengan benar sejak awal
- `register-form.tsx`, `event-register-form.tsx`, `checkout-form.tsx`, `campaign-detail-client.tsx` — sudah benar sejak Fase 1–5
