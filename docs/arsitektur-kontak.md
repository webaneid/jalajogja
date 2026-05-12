# Arsitektur Kontak — jalajogja

> Status: **PERENCANAAN** — fondasi sudah ada, refactoring konsistensi belum dikerjakan.
> Dokumen ini adalah sumber kebenaran tunggal untuk semua hal terkait kontak (phone, WA, email).

---

## Prinsip Utama

> **Satu helper, satu komponen, satu format.**

Semua kontak di sistem — phone, WhatsApp, email — punya satu cara input, satu cara simpan,
dan satu cara tampil. Tidak ada pengecualian.

---

## Infrastruktur yang Sudah Ada (Jangan Diganti)

### Komponen Input

| Komponen | File | Dipakai untuk |
|----------|------|---------------|
| `PhoneInput` | `components/ui/phone-input.tsx` | Semua input phone + WA |
| `step2-contact.tsx` | `components/members/wizard/step2-contact.tsx` | Form kontak anggota IKPM (admin + self-service) |
| `AkunDataPage` | `app/(public)/[tenant]/akun/data/page.tsx` | Form kontak akun publik |

**Aturan**: Semua input nomor telepon dan WhatsApp wajib pakai `PhoneInput`. Tidak ada
plain `<input type="tel">` untuk data yang disimpan ke DB.

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

**Transaksi** — snapshot kontak di waktu transaksi, disimpan langsung:
```
event_registrations: attendee_phone, attendee_email
donations: donor_phone, donor_email
invoices: customer_phone, customer_email
```

### API Self-Service

| Endpoint | Dipakai oleh |
|----------|-------------|
| `PATCH /api/akun/member-contact` | Anggota IKPM edit kontak |
| `PATCH /api/akun/profile-data` | Akun publik edit kontak |

---

## Format Penyimpanan: E.164

Semua nomor telepon dan WhatsApp di DB disimpan dalam format **E.164**:

```
+[kode negara][nomor tanpa awalan nol lokal]

Benar:  +6281234567890   (Indonesia)
        +60123456789     (Malaysia)
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
- Props penting: `label`, `value` (E.164), `onChange` (callback → E.164), `hint`, `optional`, `disabled`

---

## Helper `lib/phone.ts` — Perlu Dibuat

```typescript
// lib/phone.ts

// Normalisasi server-side (defense in depth — bukan pengganti PhoneInput)
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim().replace(/\s+/g, "");
  if (!s) return null;
  if (s.startsWith("+")) return s;           // sudah E.164
  if (s.startsWith("0"))  return "+62" + s.slice(1);   // lokal Indonesia
  if (s.startsWith("62")) return "+" + s;   // tanpa +
  return "+62" + s;                           // fallback Indonesia
}

// Display: +628xxx → 0812-xxx (lebih enak dibaca orang Indonesia)
export function displayPhone(e164: string | null | undefined): string {
  if (!e164) return "—";
  if (e164.startsWith("+62")) return "0" + e164.slice(3);
  return e164;  // internasional tampil apa adanya
}
```

---

## Peta Inkonsistensi Saat Ini

### Form Input yang Belum Pakai PhoneInput

| File | Masalah |
|------|---------|
| `register-form.tsx` | Plain `<input type="tel">`, simpan raw `08xxx` |
| `event-register-form.tsx` | Plain `<input>` untuk phone peserta |

### API/Action yang Belum Normalize

| File | Masalah |
|------|---------|
| `app/api/akun/register/route.ts` | Tidak normalize sebelum INSERT profiles |
| `app/api/akun/profile-data/route.ts` | Tidak normalize saat PATCH |
| `app/api/akun/member-contact/route.ts` | Tidak normalize, hanya `.trim()` |
| `members/actions.ts` → `upsertMemberContactAction` | Tidak normalize |
| `event/actions.ts` → `registerForEventAction` | Tidak normalize `attendeePhone` |

### Display yang Belum Format

| File | Masalah |
|------|---------|
| `anggota/[id]/page.tsx` | Render `contact.phone` langsung |
| Dashboard member detail | Render phone langsung |
| Event registration list | Render `attendeePhone` langsung |

---

## Rencana Refactoring (Urutan Eksekusi)

### Phase 1 — Helper (fondasi)
- [ ] Buat `lib/phone.ts` (`normalizePhone` + `displayPhone`)

### Phase 2 — Server Normalisasi (cegah data kotor masuk)
- [ ] `app/api/akun/register/route.ts`
- [ ] `app/api/akun/profile-data/route.ts`
- [ ] `app/api/akun/member-contact/route.ts`
- [ ] `members/actions.ts` (upsertMemberContactAction)
- [ ] `event/actions.ts` (registerForEventAction)

### Phase 3 — Input Forms
- [ ] `register-form.tsx` → ganti input phone + WA ke `<PhoneInput>`
- [ ] `event-register-form.tsx` → ganti input phone ke `<PhoneInput>`
- [ ] Audit: checkout form, donasi form

### Phase 4 — Display
- [ ] `anggota/[id]/page.tsx` → `displayPhone()`
- [ ] Dashboard member detail → `displayPhone()`
- [ ] Event registration list → `displayPhone()`

### Phase 5 — Backfill Data Lama
```sql
-- contacts
UPDATE public.contacts SET phone    = '+62' || SUBSTRING(phone    FROM 2) WHERE phone    LIKE '0%' AND phone    NOT LIKE '+%';
UPDATE public.contacts SET whatsapp = '+62' || SUBSTRING(whatsapp FROM 2) WHERE whatsapp LIKE '0%' AND whatsapp NOT LIKE '+%';

-- profiles
UPDATE public.profiles SET phone    = '+62' || SUBSTRING(phone    FROM 2) WHERE phone    LIKE '0%' AND phone    NOT LIKE '+%';
UPDATE public.profiles SET whatsapp = '+62' || SUBSTRING(whatsapp FROM 2) WHERE whatsapp LIKE '0%' AND whatsapp NOT LIKE '+%';

-- tenant tables (per tenant)
UPDATE "tenant_{slug}".event_registrations
SET attendee_phone = '+62' || SUBSTRING(attendee_phone FROM 2)
WHERE attendee_phone LIKE '0%' AND attendee_phone NOT LIKE '+%';
```

---

## Aturan Baku (Tidak Boleh Dilanggar)

1. **Semua input phone/WA** → pakai `<PhoneInput>` dari `components/ui/phone-input.tsx`
2. **Semua server insert/update phone/WA** → panggil `normalizePhone()` dari `lib/phone.ts`
3. **Semua display phone/WA** → panggil `displayPhone()` dari `lib/phone.ts`
4. **Format DB** → E.164 atau NULL. Tidak ada format lain.
5. **Default negara** → Indonesia (+62). User yang punya nomor luar negeri pilih manual.
6. **Email** → simpan lowercase `.trim()`, tidak perlu konversi lain.

---

## Yang TIDAK Diubah

- Arsitektur tabel `public.contacts` — sudah benar
- Behaviour `PhoneInput` component — sudah benar
- `step2-contact.tsx` — sudah pakai PhoneInput dengan benar
- `akun/data/page.tsx` — sudah pakai PhoneInput dengan benar
- `akun/lengkapi/page.tsx` Step 2 — sudah pakai PhoneInput dengan benar
