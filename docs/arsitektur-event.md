# Arsitektur Modul Event

> Status: **Step 1 (Schema) ✅ | Step 2 (UI + Actions) ✅ | Step 3 (Halaman Publik) ✅ | Step 4 (Pendaftaran Admin) ✅ | Step 5 (Check-in) ✅ | Step 6 (Sertifikat) ✅**

## Konsep

Modul Event adalah sistem manajemen kegiatan organisasi — seminar, halal bihalal, kajian, rapat, dll.
Peserta bisa mendaftar lewat halaman publik, memilih tiket (gratis atau berbayar), dan mendapat bukti pendaftaran.

### Perbedaan dengan Modul Donasi
| | Donasi | Event |
|---|---|---|
| Entitas utama | Campaign (penggalangan dana) | Event (kegiatan dengan jadwal) |
| Transaksi | Sumbangan bebas nominal | Tiket dengan harga tetap |
| Peserta | Donatur (anonim oke) | Pendaftar (butuh identitas) |
| Output | Sertifikat donasi (roadmap) | Sertifikat kehadiran (roadmap) |
| Akuntansi | Dana Titipan → Pendapatan manual | Langsung Pendapatan Event |

---

## Entitas Database

### 1. `event_categories` — Kategori event
```
id, name, slug, sort_order, created_at
```
CRUD inline oleh admin di `/event/kategori`.

### 2. `events` — Event utama
```
id, slug, title, description (Tiptap HTML)
category_id FK → event_categories
event_type: offline | online | hybrid
status: draft | published | cancelled | completed
starts_at, ends_at
location, location_detail  -- untuk offline/hybrid
maps_url                   -- Google Maps URL (opsional, offline/hybrid saja)
online_link                -- untuk online/hybrid
organizer_name             -- penyelenggara (bisa beda dari nama tenant)
max_capacity               -- null = tidak terbatas
show_attendee_list         -- tampilkan daftar peserta di halaman publik
show_ticket_count          -- tampilkan sisa kuota tiket
require_approval           -- pendaftaran perlu konfirmasi admin
cover_id FK → media
certificate_template_id    -- roadmap: FK ke letter_templates
11 kolom SEO (sama dengan posts/campaigns)
created_by FK → officers, created_at, updated_at
```

### 3. `event_tickets` — Jenis tiket per event
```
id, event_id FK → events (CASCADE DELETE)
name, description
price NUMERIC (0 = gratis)
quota INTEGER (null = tidak terbatas)
sort_order
is_active BOOLEAN
sale_starts_at, sale_ends_at  -- periode penjualan
created_at
```

### 4. `event_registrations` — Pendaftaran peserta
```
id, registration_number TEXT UNIQUE  -- EVT-YYYYMM-NNNNN
event_id FK → events (CASCADE DELETE)
ticket_id FK → event_tickets
member_id FK → public.members (nullable — publik tanpa akun)
attendee_name, attendee_phone, attendee_email
custom_fields JSONB  -- pertanyaan custom (roadmap)
status: pending | confirmed | cancelled | attended
checked_in_at, checked_in_by  -- check-in hari-H
certificate_url, certificate_sent_at  -- roadmap
created_at, updated_at
```

### 5. `event_registration_sequences` — Counter nomor EVT
```
id, year, month, counter
UNIQUE (year, month)
```

---

## Alur Pembayaran Tiket

```
Tiket gratis (price=0):
  → Daftar → status langsung "confirmed" (atau "pending" jika require_approval=true)
  → Tidak ada payments record

Tiket berbayar:
  → Daftar → INSERT event_registrations (status="pending")
  → INSERT payments (source_type='event_registration', source_id=registration.id)
  → Admin konfirmasi pembayaran → payments.status="paid"
  → Jurnal: Debit Kas / Kredit Pendapatan Event (4xxx)
  → registration.status → "confirmed"
```

**Akuntansi tiket berbayar:**
- Berbeda dengan donasi yang memakai Dana Titipan (2200)
- Event: langsung ke Pendapatan Event (4xxx) saat dikonfirmasi admin
- Alasan: tiket adalah layanan yang sudah "dikonsumsi" saat event berlangsung

---

## Nomor Pendaftaran

Format: `EVT-YYYYMM-NNNNN`
Contoh: `EVT-202604-00001`

Generator: `generateRegistrationNumber(tenantDb)` — atomic SELECT FOR UPDATE via `event_registration_sequences`.

---

## Struktur Route

```
app/(dashboard)/[tenant]/event/
├── layout.tsx              → event shell: EventNav (sub-nav kiri) + slot konten kanan
├── page.tsx                → redirect ke /event/acara
├── acara/
│   ├── page.tsx            → list event: tabel + filter + search
│   ├── new/page.tsx        → form buat event baru (create-on-save)
│   └── [id]/
│       ├── page.tsx        → detail event: stats + list pendaftaran + konfirmasi
│       ├── edit/page.tsx   → full editor: EventForm (Tiptap + TicketManager + SeoPanel)
│       └── checkin/page.tsx → check-in hari-H (EventCheckinClient)
└── kategori/
    └── page.tsx            → CRUD inline kategori event

app/(public)/[tenant]/event/[slug]/page.tsx  → halaman publik event + form pendaftaran

app/api/events/[id]/certificate/[regId]/route.ts  → POST: generate PDF sertifikat
```

---

## Server Actions (event/actions.ts)

```typescript
// Event
createEventAction(slug, data: EventData)               → buat event + tiket awal
updateEventAction(slug, eventId, data: EventData)      → update event + sync tiket (diff)
deleteEventAction(slug, eventId)                       → guard: no registrations, delete tiket dulu

// Kategori
createEventCategoryAction(slug, { name, slug })
updateEventCategoryAction(slug, categoryId, { name, slug })
deleteEventCategoryAction(slug, categoryId)            → guard: no events in category

// Registrasi (PUBLIC — tanpa auth)
registerForEventAction(slug, data: RegisterData)              → insert registration + payment (jika berbayar)

// Registrasi admin
confirmRegistrationPaymentAction(slug, paymentId)             → konfirmasi bayar → recordIncome → status confirmed
approveRegistrationAction(slug, registrationId)               → setujui pending (requireApproval)
cancelRegistrationAction(slug, registrationId)                → batalkan + cancel payment jika belum bayar
checkInRegistrationAction(slug, registrationId)               → status → attended + checkedInAt
```

---

## Komponen

```
components/event/
├── event-nav.tsx                    → sub-nav kiri: Acara, Kategori
├── event-form.tsx                   → full editor (Tiptap + TicketManager + SeoPanel + sidebar)
├── event-list-client.tsx            → CreateEventButton + EventTable (+ Eye link ke detail)
├── event-category-manage-client.tsx → inline CRUD kategori
├── event-register-form.tsx          → form publik: pilih tiket, data peserta, metode bayar, konfirmasi
├── event-registration-list.tsx      → admin: list pendaftar + konfirmasi bayar + setujui + batalkan + sertifikat
├── event-checkin-client.tsx         → check-in hari-H: search + tombol check-in + flash sukses
└── event-certificate-button.tsx     → generate + buka PDF sertifikat kehadiran
```

### EventForm Layout
```
[Header: ← Acara | StatusBadge | Batalkan | Simpan | Publikasikan]
[Main area]                     [Sidebar 288px]
  Judul                           Kategori (Combobox)
  Slug                            ──────
  ── Detail Event ──              Cover Image (MediaPicker)
  Jenis: pill (Offline/Online/
    Hybrid)
  Waktu Mulai + Selesai
  Lokasi (jika offline/hybrid)
  Alamat Lokasi
  Link Google Maps (opsional)
  Link Online (jika online/hybrid)
  Penyelenggara
  Kapasitas Maks
  ── Deskripsi ──
  TiptapEditor
  ── Pengaturan Tampilan ──
  showAttendeeList toggle
  showTicketCount toggle
  requireApproval toggle
  ── Tiket ──
  TicketManager (dynamic list):
    Per tiket: nama, toggle Gratis/
    Berbayar, input harga (disabled
    saat Gratis), kuota, aktif/
    nonaktif, periode jual,
    expand/collapse
  ── SEO ──
  SeoPanel (contentType="event")
```

### TicketManager
- Local state `tickets: TicketLocal[]` — setiap item punya `_key` (React key lokal), `_expanded` (UI toggle), dan `_isGratis` (toggle harga)
- Tiket baru: `id: null` → `createEventAction` INSERT baru; default `_expanded: true, _isGratis: true`
- Tiket lama: `id: string` → `updateEventAction` UPDATE existing; `_isGratis = price === 0` saat load
- Tiket dihapus: hilang dari array → `syncTickets` DELETE di DB (guard: no registrations)
- Diff logic di `syncTickets(tenantDb, eventId, tickets)` — helper di actions.ts

### Gratis / Berbayar Toggle
- `_isGratis: true` → price dikirim sebagai `0`, tidak ada payments record
- `_isGratis: false` → price input aktif, validasi `price >= 1`
- Input harga **selalu tampil** (disabled jika Gratis) — tidak disembunyikan saat Gratis dipilih. Alasan: jika disembunyikan, user tidak tahu di mana mengisi harga setelah toggle ke Berbayar
- Field `_isGratis`, `_key`, `_expanded` di-strip di `buildData()` — tidak dikirim ke server

---

## Status Event

```
draft → published → completed
draft → published → cancelled
cancelled/completed → draft (reopen)
```

| Status | Aksi Tersedia |
|--------|--------------|
| `draft` | "Simpan Draft" + "Publikasikan" |
| `published` | "Simpan Perubahan" + "Selesaikan" + "Batalkan" |
| `cancelled` / `completed` | "Jadikan Draft" |

---

## SEO

- `contentType="event"` di SeoPanel
- Schema options: `["Event", "WebPage"]` (dari `SCHEMA_ORG_TYPES.event`)
- Default `schemaType: "Event"` (berbeda dari campaign yang default "WebPage")
- Semua 11 kolom SEO identik dengan posts/campaigns

---

## Sidebar Navigation

Event masuk ke sidebar utama setelah Donasi:
```
...
Donasi     → /donasi
Event      → /event      ← CalendarDays icon
Toko       → /toko
...
```

---

## Implementasi yang Sudah Selesai

- [x] **Step 1 — Schema**: 5 tabel baru, enums, index, DDL, ALTER TABLE tenant existing
- [x] **Step 2 — UI + Actions**: EventForm, TicketManager, EventNav, list, CRUD kategori, sidebar
- [x] **Step 3 — Halaman Publik**: `/(public)/[tenant]/event/[slug]` — EventRegisterForm: pilih tiket, isi data peserta, pilih metode bayar, konfirmasi
- [x] **Step 4 — Pendaftaran Admin**: `event/acara/[id]` — stats, list pendaftaran, konfirmasi pembayaran, setujui, batalkan
- [x] **Step 5 — Check-in**: `event/acara/[id]/checkin` — EventCheckinClient: search real-time, satu tombol check-in, flash konfirmasi
- [x] **Step 6 — Sertifikat PDF**: `POST /api/events/[id]/certificate/[regId]` — HTML landscape A4, upload MinIO, EventCertificateButton di list pendaftaran

---

## Lessons Learned

### TicketManager: diff tidak delete-all
Sync tiket pakai diff (delete yang hilang, update yang ada, insert baru) — tidak delete-all + insert-all.
Alasan: tiket yang sudah ada pendaftaran tidak boleh dihapus. Guard via `count(event_registrations WHERE ticket_id IN toDeleteIds)`.

### Public action tanpa auth
`registerForEventAction` tidak punya `getTenantAccess()` guard — siapapun bisa mendaftar event. Validasi tetap dilakukan: cek event published, tiket aktif + periode jual, kuota.

### ticketId nullable di registrations
Kolom `ticket_id` di `event_registrations` dideklarasikan tanpa `notNull()` → tipe TypeScript `string | null`. Selalu guard dengan `r.ticketId ?? ""` sebelum pakai sebagai Map key atau argumen `eq()`.

### Ticket gratis vs berbayar
`price = 0` = gratis → tidak perlu payments record. Cukup insert registration dengan status "confirmed" langsung.
Validasi dilakukan di halaman publik (Step 3), bukan di EventForm admin.

### Input conditional: selalu tampil, disabled bukan hidden
Untuk input yang bergantung pada toggle (Gratis/Berbayar), jangan sembunyikan input saat kondisi off —
tampilkan tapi disable. User tidak tahu di mana mengisi nilai jika inputnya tidak kelihatan sama sekali.
Pattern yang salah: `{!isGratis && <Input ... />}` → user bingung.
Pattern yang benar: `<Input disabled={isGratis} placeholder={isGratis ? "0 (Gratis)" : "Masukkan harga"} />`
Berlaku untuk semua input conditional di seluruh aplikasi.

### payments.source_type
Drizzle enum `PAYMENT_SOURCE_TYPES` DAN DDL CHECK constraint di `create-tenant-schema.ts` harus diperbarui bersamaan saat menambah source_type baru. Jika hanya update salah satu → runtime error saat insert.
