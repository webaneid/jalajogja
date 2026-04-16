# Arsitektur Modul Event

> Status: **Step 1 (Schema) ✅ | Step 2 (UI + Actions) ✅**

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
│   └── [id]/edit/page.tsx  → full editor: EventForm (Tiptap + TicketManager + SeoPanel)
└── kategori/
    └── page.tsx            → CRUD inline kategori event
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

// Registrasi (roadmap — Step 3)
// createRegistrationAction(slug, eventId, ticketId, data)
// confirmRegistrationAction(slug, registrationId)
// checkInRegistrationAction(slug, registrationId)
```

---

## Komponen

```
components/event/
├── event-nav.tsx                    → sub-nav kiri: Acara, Kategori
├── event-form.tsx                   → full editor (Tiptap + TicketManager + SeoPanel + sidebar)
├── event-list-client.tsx            → CreateEventButton + EventTable
└── event-category-manage-client.tsx → inline CRUD kategori
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
    Per tiket: nama, harga, kuota,
    aktif/nonaktif, periode jual,
    expand/collapse
  ── SEO ──
  SeoPanel (contentType="event")
```

### TicketManager
- Local state `tickets: TicketLocal[]` — setiap item punya `_key` (React key lokal) dan `_expanded` (UI toggle)
- Tiket baru: `id: null` → `createEventAction` INSERT baru
- Tiket lama: `id: string` → `updateEventAction` UPDATE existing
- Tiket dihapus: hilang dari array → `syncTickets` DELETE di DB (guard: no registrations)
- Diff logic di `syncTickets(tenantDb, eventId, tickets)` — helper di actions.ts

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

## Roadmap (Belum Diimplementasikan)

- [ ] **Step 3 — Halaman Publik**: `/(public)/[tenant]/event/[slug]` — form pendaftaran publik
- [ ] **Step 4 — Pendaftaran Admin**: manual entry registrasi dari dashboard + konfirmasi pembayaran tiket berbayar
- [ ] **Step 5 — Check-in**: QR scan / list kehadiran hari-H
- [ ] **Step 6 — Sertifikat**: generate PDF sertifikat kehadiran (pakai letter template)

---

## Lessons Learned

### TicketManager: diff tidak delete-all
Sync tiket pakai diff (delete yang hilang, update yang ada, insert baru) — tidak delete-all + insert-all.
Alasan: tiket yang sudah ada pendaftaran tidak boleh dihapus. Guard via `count(event_registrations WHERE ticket_id IN toDeleteIds)`.

### Ticket gratis vs berbayar
`price = 0` = gratis → tidak perlu payments record. Cukup insert registration dengan status "confirmed" langsung.
Validasi dilakukan di halaman publik (Step 3), bukan di EventForm admin.

### payments.source_type
Drizzle enum `PAYMENT_SOURCE_TYPES` DAN DDL CHECK constraint di `create-tenant-schema.ts` harus diperbarui bersamaan saat menambah source_type baru. Jika hanya update salah satu → runtime error saat insert.
